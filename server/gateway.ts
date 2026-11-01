import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, count, desc, eq, gt, ne, sql } from 'drizzle-orm';
import { user } from './db/auth-schema';
import type { Db } from './db/client';
import { agents, runs, type AgentRow, type RunStatus } from './db/schema';
import { readCapped } from './audit/net';
import { withTimeout } from './audit/util';

export const RUN_LIMITS = {
  perCallerPerMinute: 60,
  perCallerPerDay: 500,
  perAgentPerDay: 2000,
  requestBytes: 256 * 1024,
  responseBytes: 1024 * 1024,
  upstreamTimeoutMs: 20_000,
  /** Reject signed requests older than this when verifying (echo endpoint, docs recipe). */
  signatureSkewMs: 5 * 60 * 1000,
};

export const newGatewaySecret = () => `ahgw_${randomBytes(24).toString('base64url')}`;

export function signRun(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifyRunSignature(secret: string, timestamp: string, body: string, signature: string, now = Date.now()): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > RUN_LIMITS.signatureSkewMs) return false;
  const expected = Buffer.from(signRun(secret, timestamp, body), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface Caller {
  id: string;
  login: string;
  via: 'api-key' | 'session' | 'benchmark';
}

export const SYSTEM_CALLER: Caller = { id: 'system-benchmark', login: 'agenthive-benchmark', via: 'benchmark' };

/** The benchmark runs as a system user so its calls are logged with a real foreign key. */
export async function ensureSystemUser(db: Db): Promise<void> {
  const now = new Date();
  await db.insert(user).values({ id: SYSTEM_CALLER.id, name: SYSTEM_CALLER.login, login: SYSTEM_CALLER.login, email: 'benchmark@system.agenthive.sh', emailVerified: true, createdAt: now, updatedAt: now }).onConflictDoNothing();
}

export type RunOutcome =
  | { kind: 'response'; runId: string; status: number; body: string; latencyMs: number }
  | { kind: 'rejected'; status: 401 | 409 | 413 | 429 | 400; error: string; retryAfterMs?: number }
  | { kind: 'failed'; runId: string; status: 502 | 504; error: string; latencyMs: number };

export interface GatewayDeps {
  fetch: typeof fetch;
  now?: () => number;
}

/** Quota check from the runs table; cheap thanks to the (caller, created_at) and (agent, created_at) indexes. */
async function quotaExceeded(db: Db, agentId: string, callerId: string, now: Date): Promise<{ error: string; retryAfterMs: number } | null> {
  const minuteAgo = new Date(now.getTime() - 60_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [[m], [cd], [ad]] = await Promise.all([
    db.select({ n: count() }).from(runs).where(and(eq(runs.callerId, callerId), gt(runs.createdAt, minuteAgo))),
    db.select({ n: count() }).from(runs).where(and(eq(runs.callerId, callerId), gt(runs.createdAt, dayAgo))),
    db.select({ n: count() }).from(runs).where(and(eq(runs.agentId, agentId), gt(runs.createdAt, dayAgo), ne(runs.via, 'benchmark'))),
  ]);
  if (Number(m.n) >= RUN_LIMITS.perCallerPerMinute) return { error: `rate limited: ${RUN_LIMITS.perCallerPerMinute} runs per minute per caller`, retryAfterMs: 60_000 };
  if (Number(cd.n) >= RUN_LIMITS.perCallerPerDay) return { error: `daily quota reached: ${RUN_LIMITS.perCallerPerDay} runs per caller`, retryAfterMs: 86_400_000 };
  if (Number(ad.n) >= RUN_LIMITS.perAgentPerDay) return { error: `this agent reached its daily quota of ${RUN_LIMITS.perAgentPerDay} runs`, retryAfterMs: 86_400_000 };
  return null;
}

/** Why an agent cannot be called through the gateway, or null. */
export function runnableReason(a: AgentRow): string | null {
  if (a.isSeed) return 'seed agents are illustrative and have no real endpoint';
  if (a.transport !== 'a2a/http+json') return `transport ${a.transport} is not callable over http; only a2a/http+json agents run through the gateway`;
  if (!a.endpoint) return 'this agent declares no endpoint';
  return null;
}

/**
 * Forwards one call to the agent's endpoint and logs it. The body is forwarded
 * verbatim; the caller never chooses the destination.
 */
export async function runAgent(db: Db, deps: GatewayDeps, agent: AgentRow, caller: Caller, body: string): Promise<RunOutcome> {
  const now = deps.now ?? (() => Date.now());
  const reason = runnableReason(agent);
  if (reason) return { kind: 'rejected', status: 409, error: reason };
  if (Buffer.byteLength(body, 'utf8') > RUN_LIMITS.requestBytes) return { kind: 'rejected', status: 413, error: `request larger than ${RUN_LIMITS.requestBytes / 1024} KiB` };
  try {
    const parsed: unknown = JSON.parse(body || 'null');
    if (typeof parsed !== 'object' || parsed === null) return { kind: 'rejected', status: 400, error: 'request body must be a JSON object or array' };
  } catch {
    return { kind: 'rejected', status: 400, error: 'request body must be valid JSON' };
  }
  if (caller.via !== 'benchmark') {
    const quota = await quotaExceeded(db, agent.id, caller.id, new Date(now()));
    if (quota) return { kind: 'rejected', status: 429, ...quota };
  }

  const secret = agent.gatewaySecret ?? (await ensureSecret(db, agent.id));
  const runId = randomUUID();
  const timestamp = String(now());
  const started = now();
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    'user-agent': 'agenthive-gateway/1',
    'x-agenthive-run-id': runId,
    'x-agenthive-caller': caller.login,
    'x-agenthive-agent': `${agent.name}@${agent.latestVersion}`,
    'x-agenthive-timestamp': timestamp,
    'x-agenthive-signature': signRun(secret, timestamp, body),
  };
  const log = async (status: RunStatus, httpStatus: number | null, responseBytes: number, error: string | null) => {
    await db.insert(runs).values({
      id: runId,
      agentId: agent.id,
      agentVersion: agent.latestVersion,
      callerId: caller.id,
      callerLogin: caller.login,
      via: caller.via,
      status,
      httpStatus,
      latencyMs: Math.max(0, Math.round(now() - started)),
      requestBytes: Buffer.byteLength(body, 'utf8'),
      responseBytes,
      error,
    });
  };

  let res: Response;
  try {
    res = await withTimeout(deps.fetch(agent.endpoint!, { method: 'POST', headers, body, redirect: 'manual' }), RUN_LIMITS.upstreamTimeoutMs, 'upstream');
  } catch (e) {
    const msg = (e as Error).message;
    const timeout = /timed out/i.test(msg);
    const blocked = /blocked/i.test(msg);
    await log(timeout ? 'timeout' : blocked ? 'blocked' : 'upstream_error', null, 0, msg);
    return { kind: 'failed', runId, status: timeout ? 504 : 502, error: timeout ? 'upstream timed out' : `upstream unreachable: ${msg}`, latencyMs: now() - started };
  }
  let text: string;
  try {
    text = await readCapped(res, RUN_LIMITS.responseBytes);
  } catch (e) {
    await log('upstream_error', res.status, 0, (e as Error).message);
    return { kind: 'failed', runId, status: 502, error: `upstream response rejected: ${(e as Error).message}`, latencyMs: now() - started };
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  if (!isJson) {
    await log('upstream_error', res.status, text.length, 'non-json response');
    return { kind: 'failed', runId, status: 502, error: `upstream returned non-json (${res.status})`, latencyMs: now() - started };
  }
  await log(res.ok ? 'ok' : 'upstream_error', res.status, Buffer.byteLength(text, 'utf8'), res.ok ? null : `upstream ${res.status}`);
  return { kind: 'response', runId, status: res.status, body: text, latencyMs: now() - started };
}

export async function ensureSecret(db: Db, agentId: string): Promise<string> {
  const secret = newGatewaySecret();
  await db.update(agents).set({ gatewaySecret: secret }).where(and(eq(agents.id, agentId), sql`${agents.gatewaySecret} is null`));
  const row = await db.query.agents.findFirst({ where: eq(agents.id, agentId), columns: { gatewaySecret: true } });
  return row?.gatewaySecret ?? secret;
}

export async function rotateSecret(db: Db, agentId: string): Promise<string> {
  const secret = newGatewaySecret();
  await db.update(agents).set({ gatewaySecret: secret, updatedAt: new Date() }).where(eq(agents.id, agentId));
  return secret;
}

export interface Measured {
  runs30d: number;
  successRate: number | null;
  avgLatencyMs: number | null;
}

export const MIN_RUNS_FOR_RATE = 20;

/** Measured over the gateway, last 30 days. One grouped query for the whole catalog. */
export async function measuredMetrics(db: Db, now = new Date()): Promise<Map<string, Measured>> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const rows = await db
    .select({
      agentId: runs.agentId,
      total: count(),
      ok: sql<number>`sum(case when ${runs.status} = 'ok' then 1 else 0 end)`,
      avgOkLatency: sql<number | null>`avg(case when ${runs.status} = 'ok' then ${runs.latencyMs} end)`,
    })
    .from(runs)
    .where(and(gt(runs.createdAt, since), ne(runs.via, 'benchmark')))
    .groupBy(runs.agentId);
  const out = new Map<string, Measured>();
  for (const r of rows) {
    const total = Number(r.total);
    const ok = Number(r.ok);
    out.set(r.agentId, {
      runs30d: total,
      successRate: total >= MIN_RUNS_FOR_RATE ? Math.round((ok / total) * 1000) / 10 : null,
      avgLatencyMs: r.avgOkLatency === null ? null : Math.round(Number(r.avgOkLatency)),
    });
  }
  return out;
}

export async function recentRuns(db: Db, where: { agentId?: string; callerId?: string }, limit = 100) {
  const cond = where.agentId ? eq(runs.agentId, where.agentId) : eq(runs.callerId, where.callerId!);
  return db
    .select({
      id: runs.id,
      agentId: runs.agentId,
      agentName: agents.name,
      agentVersion: runs.agentVersion,
      callerLogin: runs.callerLogin,
      via: runs.via,
      status: runs.status,
      httpStatus: runs.httpStatus,
      latencyMs: runs.latencyMs,
      requestBytes: runs.requestBytes,
      responseBytes: runs.responseBytes,
      error: runs.error,
      createdAt: runs.createdAt,
    })
    .from(runs)
    .innerJoin(agents, eq(agents.id, runs.agentId))
    .where(cond)
    .orderBy(desc(runs.createdAt))
    .limit(limit);
}
