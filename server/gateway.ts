import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, count, desc, eq, gt, inArray, lt, ne, sql } from 'drizzle-orm';
import { user } from './db/auth-schema';
import type { Db } from './db/client';
import { agents, runs, webhookSecrets, type AgentRow, type RunStatus } from './db/schema';
import { readCapped } from './audit/net';
import { withTimeout } from './audit/util';

export const RUN_LIMITS = {
  perCallerPerMinute: 60,
  perCallerPerDay: 500,
  perAgentPerDay: 2000,
  requestBytes: 256 * 1024,
  responseBytes: 1024 * 1024,
  upstreamTimeoutMs: 20_000,
  asyncUpstreamTimeoutMs: 50_000,
  /** Async outputs kept this long, then the body is purged (the log row stays). */
  outputRetentionMs: 7 * 86_400_000,
  /** A run still running after this is reported lost (the instance died). */
  lostAfterMs: 3 * 60_000,
  storedBodyBytes: 256 * 1024,
  webhookTimeoutMs: 8_000,
  webhookBackoffMs: [0, 2000, 8000],
  /** Reject signed requests older than this when verifying (echo endpoint, docs recipe). */
  signatureSkewMs: 5 * 60 * 1000,
};

export const newGatewaySecret = () => `ahgw_${randomBytes(24).toString('base64url')}`;
export const newWebhookSecret = () => `ahwh_${randomBytes(24).toString('base64url')}`;

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
  /** Per-call upstream timeout override (the benchmark bounds it by its remaining budget). */
  timeoutMs?: number;
}

export interface RunOptions {
  mode?: 'sync' | 'async';
  /** Pre-allocated run id (async: handed to the caller before the call starts). */
  runId?: string;
  webhookUrl?: string | null;
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
/** Everything that can refuse a run before any upstream traffic: runnable agent, body shape and size, quotas. */
export async function precheckRun(db: Db, deps: GatewayDeps, agent: AgentRow, caller: Caller, body: string, webhookUrl?: string | null): Promise<Extract<RunOutcome, { kind: 'rejected' }> | null> {
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
  if (webhookUrl) {
    let u: URL;
    try {
      u = new URL(webhookUrl);
    } catch {
      return { kind: 'rejected', status: 400, error: 'webhook must be an absolute https url' };
    }
    if (u.protocol !== 'https:' || u.username || u.password || webhookUrl.length > 2048) return { kind: 'rejected', status: 400, error: 'webhook must be a public https url without credentials' };
  }
  if (caller.via !== 'benchmark') {
    const quota = await quotaExceeded(db, agent.id, caller.id, new Date(now()));
    if (quota) return { kind: 'rejected', status: 429, ...quota };
  }
  return null;
}

export async function runAgent(db: Db, deps: GatewayDeps, agent: AgentRow, caller: Caller, body: string, opts: RunOptions = {}): Promise<RunOutcome> {
  const now = deps.now ?? (() => Date.now());
  const rejected = await precheckRun(db, deps, agent, caller, body, opts.webhookUrl);
  if (rejected) return rejected;

  const secret = agent.gatewaySecret ?? (await ensureSecret(db, agent.id));
  const runId = opts.runId ?? randomUUID();
  const mode = opts.mode ?? 'sync';
  const timestamp = String(now());
  const started = now();
  // The row exists before the upstream call so an async caller can poll it and a dead instance leaves a visible trace.
  await db
    .insert(runs)
    .values({ id: runId, agentId: agent.id, agentVersion: agent.latestVersion, callerId: caller.id, callerLogin: caller.login, via: caller.via, status: 'running', latencyMs: 0, requestBytes: Buffer.byteLength(body, 'utf8'), mode, webhookUrl: opts.webhookUrl ?? null })
    .onConflictDoUpdate({ target: runs.id, set: { status: 'running' } });
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
  const log = async (status: RunStatus, httpStatus: number | null, responseBytes: number, error: string | null, responseBody: string | null = null) => {
    await db
      .update(runs)
      .set({
        status,
        httpStatus,
        latencyMs: Math.max(0, Math.round(now() - started)),
        responseBytes,
        error,
        completedAt: new Date(now()),
        responseBody: mode === 'async' && responseBody !== null ? responseBody.slice(0, RUN_LIMITS.storedBodyBytes) : null,
      })
      .where(eq(runs.id, runId));
  };

  const cap = mode === 'async' ? RUN_LIMITS.asyncUpstreamTimeoutMs : RUN_LIMITS.upstreamTimeoutMs;
  let res: Response;
  try {
    res = await withTimeout(deps.fetch(agent.endpoint!, { method: 'POST', headers, body, redirect: 'manual' }), Math.min(deps.timeoutMs ?? cap, cap), 'upstream');
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
  await log(res.ok ? 'ok' : 'upstream_error', res.status, Buffer.byteLength(text, 'utf8'), res.ok ? null : `upstream ${res.status}`, text);
  return { kind: 'response', runId, status: res.status, body: text, latencyMs: now() - started };
}

export interface RunView {
  runId: string;
  agent: string;
  version: string;
  mode: string;
  status: RunStatus;
  httpStatus: number | null;
  latencyMs: number;
  output: unknown;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  webhook: { url: string; status: string | null; attempts: number } | null;
}

/** Caller view of one run; a run still running past the lost threshold is reported (and marked) lost. */
export async function getRun(db: Db, runId: string, callerId: string, now = Date.now()): Promise<RunView | null> {
  const row = await db.select({ r: runs, name: agents.name }).from(runs).innerJoin(agents, eq(agents.id, runs.agentId)).where(and(eq(runs.id, runId), eq(runs.callerId, callerId))).limit(1);
  if (row.length === 0) return null;
  let { r } = row[0];
  if ((r.status === 'running' || r.status === 'queued') && now - r.createdAt.getTime() > RUN_LIMITS.lostAfterMs) {
    await db.update(runs).set({ status: 'lost', error: 'the gateway stopped before the run finished; retry it', completedAt: new Date(now) }).where(and(eq(runs.id, runId), eq(runs.status, r.status)));
    r = { ...r, status: 'lost', error: 'the gateway stopped before the run finished; retry it' };
  }
  let output: unknown = null;
  if (r.responseBody !== null) {
    try {
      output = JSON.parse(r.responseBody);
    } catch {
      output = r.responseBody;
    }
  }
  return {
    runId: r.id,
    agent: row[0].name,
    version: r.agentVersion,
    mode: r.mode,
    status: r.status,
    httpStatus: r.httpStatus,
    latencyMs: r.latencyMs,
    output,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    webhook: r.webhookUrl ? { url: r.webhookUrl, status: r.webhookStatus, attempts: r.webhookAttempts } : null,
  };
}

export async function ensureWebhookSecret(db: Db, userId: string): Promise<string> {
  await db.insert(webhookSecrets).values({ userId, secret: newWebhookSecret() }).onConflictDoNothing();
  const row = await db.query.webhookSecrets.findFirst({ where: eq(webhookSecrets.userId, userId) });
  return row!.secret;
}

export async function rotateWebhookSecret(db: Db, userId: string): Promise<string> {
  const secret = newWebhookSecret();
  await db.insert(webhookSecrets).values({ userId, secret }).onConflictDoUpdate({ target: webhookSecrets.userId, set: { secret, rotatedAt: new Date() } });
  return secret;
}

/** Delivers the completed run to the caller's webhook, signed with the caller's secret, with bounded retries. */
export async function deliverWebhook(db: Db, deps: GatewayDeps, runId: string, callerId: string): Promise<void> {
  const view = await getRun(db, runId, callerId);
  if (!view?.webhook) return;
  const secret = await ensureWebhookSecret(db, callerId);
  const body = JSON.stringify({ runId: view.runId, agent: view.agent, version: view.version, status: view.status, httpStatus: view.httpStatus, latencyMs: view.latencyMs, output: view.output, error: view.error, completedAt: view.completedAt });
  const now = deps.now ?? (() => Date.now());
  let attempts = 0;
  let delivered = false;
  for (const wait of RUN_LIMITS.webhookBackoffMs) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    attempts++;
    const timestamp = String(now());
    try {
      const res = await withTimeout(
        deps.fetch(view.webhook.url, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'content-type': 'application/json', 'user-agent': 'agenthive-gateway/1', 'x-agenthive-run-id': runId, 'x-agenthive-timestamp': timestamp, 'x-agenthive-signature': signRun(secret, timestamp, body) },
          body,
        }),
        RUN_LIMITS.webhookTimeoutMs,
        'webhook',
      );
      if (res.ok) {
        delivered = true;
        break;
      }
    } catch {
      /* retry */
    }
  }
  await db.update(runs).set({ webhookStatus: delivered ? 'delivered' : 'failed', webhookAttempts: attempts }).where(eq(runs.id, runId));
}

/** Housekeeping for the cron: mark stale runs lost and purge async outputs past retention. */
export async function sweepRuns(db: Db, now = Date.now()): Promise<{ lost: number; purged: number }> {
  const lostCutoff = new Date(now - RUN_LIMITS.lostAfterMs);
  const lost = await db
    .update(runs)
    .set({ status: 'lost', error: 'the gateway stopped before the run finished; retry it', completedAt: new Date(now) })
    .where(and(inArray(runs.status, ['queued', 'running']), lt(runs.createdAt, lostCutoff)))
    .returning({ id: runs.id });
  const purged = await db
    .update(runs)
    .set({ responseBody: null })
    .where(and(sql`${runs.responseBody} is not null`, lt(runs.createdAt, new Date(now - RUN_LIMITS.outputRetentionMs))))
    .returning({ id: runs.id });
  return { lost: lost.length, purged: purged.length };
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
    .where(and(gt(runs.createdAt, since), ne(runs.via, 'benchmark'), inArray(runs.status, ['ok', 'upstream_error', 'timeout', 'blocked', 'lost'])))
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
      mode: runs.mode,
      webhookStatus: runs.webhookStatus,
      createdAt: runs.createdAt,
    })
    .from(runs)
    .innerJoin(agents, eq(agents.id, runs.agentId))
    .where(cond)
    .orderBy(desc(runs.createdAt))
    .limit(limit);
}
