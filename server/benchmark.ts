import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import type { Db } from './db/client';
import { agents, agentVersions, benchmarks, type AgentRow } from './db/schema';
import { parseManifest, type Manifest } from './manifest';
import { runAgent, runnableReason, SYSTEM_CALLER, type GatewayDeps } from './gateway';

export const BENCHMARK_LIMITS = { caseTimeoutMs: 10_000, totalBudgetMs: 45_000, maxCases: 10 };

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
  passRate: number;
  results: CaseResult[];
  /** Set when nothing could run (agent not runnable). */
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

function judge(c: TestCase, status: number, output: unknown, latencyMs: number): string | null {
  const e = c.expect;
  if (e.status !== undefined ? status !== e.status : status < 200 || status >= 300) return `expected status ${e.status ?? '2xx'}, got ${status}`;
  if (e.maxLatencyMs !== undefined && latencyMs > e.maxLatencyMs) return `took ${latencyMs}ms, limit ${e.maxLatencyMs}ms`;
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  if (e.contains !== undefined && !text.includes(e.contains)) return `output does not contain "${e.contains}"`;
  if (e.jsonPath) {
    const v = jsonPath(output, e.jsonPath.path);
    if (v === undefined) return `path ${e.jsonPath.path} missing`;
    if (e.jsonPath.min !== undefined && !(typeof v === 'number' && v >= e.jsonPath.min)) return `path ${e.jsonPath.path} is ${JSON.stringify(v)}, expected ≥ ${e.jsonPath.min}`;
    if (e.jsonPath.equals !== undefined && JSON.stringify(v) !== JSON.stringify(e.jsonPath.equals)) return `path ${e.jsonPath.path} is ${JSON.stringify(v)}, expected ${JSON.stringify(e.jsonPath.equals)}`;
  }
  return null;
}

/**
 * Runs the registry probes and the author's declared cases through the gateway
 * and stores the result. Never throws; an unrunnable agent yields a skipped report.
 */
export async function runBenchmark(db: Db, deps: GatewayDeps, agent: AgentRow, trigger: BenchmarkTrigger): Promise<BenchmarkReport> {
  const now = deps.now ?? (() => Date.now());
  const ranAt = new Date(now()).toISOString();
  const reason = runnableReason(agent);
  if (reason) return { version: agent.latestVersion, trigger, ranAt, passed: 0, total: 0, passRate: 0, results: [], skipped: reason };

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
    const out = await runAgent(db, deps, agent, SYSTEM_CALLER, JSON.stringify(input));
    const latencyMs = Math.round(now() - t0);
    if (out.kind === 'rejected') return results.push({ name, kind, passed: false, latencyMs, status: null, reason: out.error });
    if (out.kind === 'failed') return results.push({ name, kind, passed: false, latencyMs, status: out.status, reason: out.error });
    let output: unknown = out.body;
    try {
      output = JSON.parse(out.body);
    } catch {
      /* judged as text */
    }
    const why = judgeFn(out.status, output, latencyMs);
    results.push({ name, kind, passed: why === null, latencyMs, status: out.status, reason: why });
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
  const passRate = total === 0 ? 0 : Math.round((passed / total) * 1000) / 10;
  const report: BenchmarkReport = { version: agent.latestVersion, trigger, ranAt, passed, total, passRate, results };
  await db.insert(benchmarks).values({ id: randomUUID(), agentId: agent.id, version: agent.latestVersion, passed, total, passRate, trigger, results: results as unknown as Record<string, unknown>[] });
  await db.update(agents).set({ benchmarkPassRate: passRate, benchmarkAt: new Date(ranAt) }).where(eq(agents.id, agent.id));
  return report;
}

export async function latestBenchmark(db: Db, agentId: string): Promise<BenchmarkReport | null> {
  const row = await db.query.benchmarks.findFirst({ where: eq(benchmarks.agentId, agentId), orderBy: desc(benchmarks.createdAt) });
  return row ? { version: row.version, trigger: row.trigger as BenchmarkTrigger, ranAt: row.createdAt.toISOString(), passed: row.passed, total: row.total, passRate: row.passRate, results: row.results as unknown as CaseResult[] } : null;
}
