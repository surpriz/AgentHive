import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, gt, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import type { Db } from './db/client';
import { agents, agentVersions, benchmarks, type AgentRow } from './db/schema';
import { parseManifest, type Manifest } from './manifest';
import { runAgent, runnableReason, SYSTEM_CALLER, type GatewayDeps } from './gateway';

export const BENCHMARK_LIMITS = {
  caseTimeoutMs: 10_000,
  totalBudgetMs: 45_000,
  maxCases: 10,
  /** Minimum gap between benchmarks of one agent for publish and owner triggers (cron is exempt). */
  minGapMs: 60 * 60 * 1000,
  /** Benchmarks per owner per day across their agents, all triggers except cron. */
  perOwnerPerDay: 24,
  reasonChars: 300,
  keepReports: 20,
};

export type BenchmarkTrigger = 'publish' | 'owner' | 'cron';

export interface CaseResult {
  name: string;
  kind: 'probe' | 'case';
  passed: boolean;
  latencyMs: number;
  status: number | null;
  reason: string | null;
}

export interface BenchmarkReport {
  version: string;
  trigger: BenchmarkTrigger;
  ranAt: string;
  passed: number;
  total: number;
  /** Over the author-declared cases when there are any, otherwise over the registry probes. */
  passRate: number;
  /** How many author-declared cases ran; 0 means the rate reflects probes only. */
  cases: number;
  results: CaseResult[];
  /** Set when nothing could run (agent not runnable, or rate limited). */
  skipped?: string;
}

type TestCase = NonNullable<Manifest['spec']['tests']>[number];

/** Dotted path lookup with `.length` support, e.g. `suggestions.length` or `data.items.0.id`. */
export function jsonPath(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const key of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    if (key === 'length' && (Array.isArray(cur) || typeof cur === 'string')) {
      cur = cur.length;
      continue;
    }
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
const clean = (t: string) => t.replace(CONTROL, '');
const clip = (v: unknown, n = 80) => {
  const t = clean(typeof v === 'string' ? v : (JSON.stringify(v) ?? 'undefined'));
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const reasonOf = (r: string | null) => (r === null ? null : clip(r, BENCHMARK_LIMITS.reasonChars));

function judge(c: TestCase, status: number, output: unknown, latencyMs: number): string | null {
  const e = c.expect;
  if (e.status !== undefined ? status !== e.status : status < 200 || status >= 300) return `expected status ${e.status ?? '2xx'}, got ${status}`;
  if (e.maxLatencyMs !== undefined && latencyMs > e.maxLatencyMs) return `took ${latencyMs}ms, limit ${e.maxLatencyMs}ms`;
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  if (e.contains !== undefined && !text.includes(e.contains)) return `output does not contain "${e.contains}"`;
  if (e.jsonPath) {
    const v = jsonPath(output, e.jsonPath.path);
    if (v === undefined) return `path ${e.jsonPath.path} missing`;
    if (e.jsonPath.min !== undefined && !(typeof v === 'number' && v >= e.jsonPath.min)) return `path ${e.jsonPath.path} is ${clip(v)}, expected ≥ ${e.jsonPath.min}`;
    if (e.jsonPath.equals !== undefined && JSON.stringify(v) !== JSON.stringify(e.jsonPath.equals)) return `path ${e.jsonPath.path} is ${clip(v)}, expected ${clip(e.jsonPath.equals)}`;
  }
  return null;
}

/**
 * Gate for publish and owner triggers: a daily budget per owner, then an atomic
 * reservation of the hourly slot (`benchmark_at` is the last start, claimed in
 * one conditional UPDATE so two concurrent triggers cannot both pass).
 */
export async function benchmarkGate(db: Db, agent: AgentRow, trigger: BenchmarkTrigger, now = new Date()): Promise<{ error: string; retryAfterMs: number } | null> {
  if (trigger === 'cron') return null;
  const owned = db.select({ id: agents.id }).from(agents).where(eq(agents.ownerId, agent.ownerId));
  const [{ n }] = await db
    .select({ n: count() })
    .from(benchmarks)
    .where(and(inArray(benchmarks.agentId, owned), ne(benchmarks.trigger, 'cron'), gt(benchmarks.createdAt, new Date(now.getTime() - 86_400_000))));
  if (Number(n) >= BENCHMARK_LIMITS.perOwnerPerDay) return { error: `daily benchmark budget reached (${BENCHMARK_LIMITS.perOwnerPerDay} per owner)`, retryAfterMs: 86_400_000 };
  const cutoff = new Date(now.getTime() - BENCHMARK_LIMITS.minGapMs);
  const claimed = await db
    .update(agents)
    .set({ benchmarkAt: now })
    .where(and(eq(agents.id, agent.id), or(isNull(agents.benchmarkAt), lt(agents.benchmarkAt, cutoff))))
    .returning({ id: agents.id });
  if (claimed.length === 0) {
    const row = await db.query.agents.findFirst({ where: eq(agents.id, agent.id), columns: { benchmarkAt: true } });
    const elapsed = row?.benchmarkAt ? now.getTime() - row.benchmarkAt.getTime() : 0;
    return { error: 'benchmark already ran recently', retryAfterMs: Math.max(1000, BENCHMARK_LIMITS.minGapMs - elapsed) };
  }
  return null;
}

/** A new version invalidates the published score until it is measured again. */
export async function resetBenchmark(db: Db, agentId: string): Promise<void> {
  await db.update(agents).set({ benchmarkPassRate: null, benchmarkAt: null }).where(eq(agents.id, agentId));
}

/**
 * Runs the registry probes and the author's declared cases through the gateway
 * and stores the result. Never throws; an unrunnable or rate-limited agent yields a skipped report.
 */
export async function runBenchmark(db: Db, deps: GatewayDeps, agent: AgentRow, trigger: BenchmarkTrigger): Promise<BenchmarkReport> {
  const now = deps.now ?? (() => Date.now());
  const ranAt = new Date(now()).toISOString();
  const empty = (skipped: string): BenchmarkReport => ({ version: agent.latestVersion, trigger, ranAt, passed: 0, total: 0, passRate: 0, cases: 0, results: [], skipped });
  const reason = runnableReason(agent);
  if (reason) return empty(reason);
  const gate = await benchmarkGate(db, agent, trigger, new Date(now()));
  if (gate) return empty(gate.error);

  const version = await db.query.agentVersions.findFirst({ where: eq(agentVersions.agentId, agent.id), orderBy: desc(agentVersions.createdAt) });
  const parsed = version ? parseManifest(version.manifest) : null;
  const cases = (parsed?.ok ? parsed.manifest.spec.tests : []).slice(0, BENCHMARK_LIMITS.maxCases);

  const started = now();
  const results: CaseResult[] = [];
  const call = async (name: string, kind: CaseResult['kind'], input: unknown, judgeFn: (status: number, output: unknown, latency: number) => string | null) => {
    if (now() - started > BENCHMARK_LIMITS.totalBudgetMs) {
      results.push({ name, kind, passed: false, latencyMs: 0, status: null, reason: 'benchmark time budget exhausted' });
      return;
    }
    const t0 = now();
    const remaining = BENCHMARK_LIMITS.totalBudgetMs - (t0 - started);
    try {
      const out = await runAgent(db, { ...deps, timeoutMs: Math.max(1000, Math.min(BENCHMARK_LIMITS.caseTimeoutMs, remaining)) }, agent, SYSTEM_CALLER, JSON.stringify(input));
      const latencyMs = Math.round(now() - t0);
      if (out.kind === 'rejected') return results.push({ name, kind, passed: false, latencyMs, status: null, reason: reasonOf(out.error) });
      if (out.kind === 'failed') return results.push({ name, kind, passed: false, latencyMs, status: out.status, reason: reasonOf(out.error) });
      let output: unknown = out.body;
      try {
        output = JSON.parse(out.body);
      } catch {
        /* judged as text */
      }
      const why = judgeFn(out.status, output, latencyMs);
      results.push({ name, kind, passed: why === null, latencyMs, status: out.status, reason: reasonOf(why) });
    } catch (e) {
      // An agent-controlled answer must never abort the benchmark: it just fails this case. Details stay server-side.
      console.error(`benchmark case "${name}" for ${agent.name} threw`, e);
      results.push({ name, kind, passed: false, latencyMs: Math.round(now() - t0), status: null, reason: 'internal error while running this case' });
    }
  };

  await call('liveness', 'probe', {}, (status) => (status >= 500 ? `answered ${status}` : null));
  await call('malformed input', 'probe', { __agenthive_probe: 'unexpected' }, (status) => (status >= 500 ? `5xx on unexpected input (${status}); answer 4xx instead` : null));
  for (const c of cases) await call(c.name, 'case', c.input, (status, output, latency) => judge(c, status, output, latency));
  const caseLatencies = results.filter((r) => r.kind === 'case' && r.status !== null).map((r) => r.latencyMs);
  if (caseLatencies.length) {
    const mean = caseLatencies.reduce((a, b) => a + b, 0) / caseLatencies.length;
    results.push({ name: 'latency', kind: 'probe', passed: mean <= BENCHMARK_LIMITS.caseTimeoutMs, latencyMs: Math.round(mean), status: null, reason: mean <= BENCHMARK_LIMITS.caseTimeoutMs ? null : `mean ${Math.round(mean)}ms over ${BENCHMARK_LIMITS.caseTimeoutMs}ms` });
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  // The published rate reflects the author's cases; with none declared it reflects the probes and the UI says so.
  const scored = results.filter((r) => r.kind === 'case');
  const pool = scored.length > 0 ? scored : results;
  const passRate = pool.length === 0 ? 0 : Math.round((pool.filter((r) => r.passed).length / pool.length) * 1000) / 10;
  const clean = results.map((r) => ({ ...r, name: clip(r.name, 80) }));
  const report: BenchmarkReport = { version: agent.latestVersion, trigger, ranAt, passed, total, passRate, cases: scored.length, results: clean };
  try {
    await db.insert(benchmarks).values({ id: randomUUID(), agentId: agent.id, version: agent.latestVersion, passed, total, passRate, trigger, results: clean as unknown as Record<string, unknown>[] });
    await db.update(agents).set({ benchmarkPassRate: passRate, benchmarkAt: new Date(ranAt) }).where(eq(agents.id, agent.id));
    // Retention: keep the latest reports only.
    const old = await db.select({ id: benchmarks.id }).from(benchmarks).where(eq(benchmarks.agentId, agent.id)).orderBy(desc(benchmarks.createdAt)).offset(BENCHMARK_LIMITS.keepReports);
    if (old.length) await db.delete(benchmarks).where(inArray(benchmarks.id, old.map((o) => o.id)));
  } catch (e) {
    // Never leave a stale score behind a report that could not be stored.
    console.error(`could not persist benchmark for ${agent.name}`, e);
    await db.update(agents).set({ benchmarkPassRate: null }).where(eq(agents.id, agent.id)).catch(() => undefined);
    return { ...report, skipped: 'report could not be stored' };
  }
  return report;
}

export async function latestBenchmark(db: Db, agentId: string): Promise<BenchmarkReport | null> {
  const row = await db.query.benchmarks.findFirst({ where: eq(benchmarks.agentId, agentId), orderBy: desc(benchmarks.createdAt) });
  if (!row) return null;
  const results = row.results as unknown as CaseResult[];
  return { version: row.version, trigger: row.trigger as BenchmarkTrigger, ranAt: row.createdAt.toISOString(), passed: row.passed, total: row.total, passRate: row.passRate, cases: results.filter((r) => r.kind === 'case').length, results };
}
