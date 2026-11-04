import type { Agent } from '../types';
import type { PackageDoc } from './retrieval';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    throw new ApiError(msg, res.status, body);
  }
  return body as T;
}

const safeJson = (t: string): unknown => {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};

export interface RegistryConfig {
  github: boolean;
  google?: boolean;
  /** Email + password with a verification link. */
  email?: boolean;
  devLogin: boolean;
  devUser?: { email: string; password: string; login: string };
}

export interface Me {
  user: { id: string; login: string; name: string; image: string | null };
  via: 'session' | 'api-key';
  agents: Agent[];
}

export interface ApiKeySummary {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  createdAt: string;
  lastRequest: string | null;
  enabled: boolean | null;
}

export interface AuditFinding {
  check: string;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  message: string;
  hint?: string;
}

export interface AuditReport {
  engine: string;
  auditedAt: string;
  score: number;
  grade: 'AAA' | 'AA' | 'A' | 'B';
  caps: { grade: 'AA' | 'A'; reason: string }[];
  blocked: boolean;
  findings: AuditFinding[];
  checks: { id: string; status: 'ok' | 'skipped' | 'error'; ms: number; note?: string }[];
}

export interface AuditResponse {
  agent: string;
  version: string;
  grade: string;
  score: number | null;
  criteria: string;
  report: AuditReport | null;
}

export interface RunLog {
  id: string;
  agentName: string;
  agentVersion: string;
  callerLogin: string;
  via: 'api-key' | 'session';
  status: 'ok' | 'upstream_error' | 'timeout' | 'blocked' | 'bad_request';
  httpStatus: number | null;
  latencyMs: number;
  requestBytes: number;
  responseBytes: number;
  error: string | null;
  createdAt: string;
}

export interface RunResult {
  runId: string;
  status: number;
  latencyMs: number;
  output: unknown;
}

export interface BenchmarkReport {
  version: string;
  trigger: 'publish' | 'owner' | 'cron';
  ranAt: string;
  passed: number;
  total: number;
  passRate: number;
  cases: number;
  results: { name: string; kind: 'probe' | 'case'; passed: boolean; latencyMs: number; status: number | null; reason: string | null }[];
  skipped?: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  author: string;
  value: string;
  category: string;
  version: string;
  grade: string;
  score: number;
  components: { benchmark: number | null; audit: number | null; availability: number | null };
  benchmarkCases: number;
  runs30d: number;
  delta: number | null;
  previousRank: number | null;
}

export interface Leaderboard {
  generatedAt: string;
  formula: string;
  categories: Record<string, LeaderboardEntry[]>;
}

export interface RunView {
  runId: string;
  agent: string;
  version: string;
  mode: 'sync' | 'async';
  status: 'queued' | 'running' | 'ok' | 'upstream_error' | 'timeout' | 'blocked' | 'bad_request' | 'lost';
  httpStatus: number | null;
  latencyMs: number;
  output: unknown;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  webhook: { url: string; status: string | null; attempts: number } | null;
}

export interface ManifestIssue {
  path: string;
  message: string;
}

/** One row of a trial ranking: an agent on a model, from its latest batch. */
export interface TrialRow {
  agent: string;
  version: string;
  model: string;
  batchId: string;
  tasks: number;
  runs: number;
  score: number | null;
  spread: number | null;
  costUsd: number | null;
  seconds: number | null;
  traps: { resisted: number; total: number };
  capped: number;
  categories: Record<string, { found: number; total: number }>;
}

export interface TrialRanking {
  trial: string;
  title: string;
  goal: string;
  methodologyVersion: number;
  lastBatchAt: string | null;
  rows: TrialRow[];
}

export interface TrialRunSummary {
  id: string;
  agent: string;
  version: string;
  model: string;
  task: string;
  runIndex: number;
  batchId: string;
  score: number | null;
  recall: number | null;
  precision: number | null;
  traps: { resisted: number; total: number };
  costUsd: number | null;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  capped: string | null;
  ended: string;
  sandbox: string;
  createdAt: string;
}

export const api = {
  config: () => request<RegistryConfig>('/api/config'),
  catalog: () => request<{ agents: Agent[] }>('/api/catalog.json', { cache: 'no-store' }).then((r) => r.agents),
  me: () => request<Me>('/api/v1/me'),
  keys: () => request<{ keys: ApiKeySummary[] }>('/api/v1/keys').then((r) => r.keys),
  createKey: (name: string) =>
    request<{ key: string; id: string; name: string | null; start: string | null }>('/api/v1/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  revokeKey: (id: string) => request<null>(`/api/v1/keys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  run: async (name: string, input: unknown): Promise<RunResult> => {
    const res = await fetch(`/api/v1/run/${encodeURIComponent(name)}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const text = await res.text();
    const output: unknown = safeJson(text);
    const runId = res.headers.get('x-agenthive-run-id') ?? '';
    if (!runId) throw new ApiError((output as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`, res.status, output);
    if (res.status === 502 || res.status === 504) throw new ApiError(`${(output as { error?: string }).error ?? 'upstream failed'} (run ${runId})`, res.status, output);
    return { runId, status: res.status, latencyMs: Number(res.headers.get('x-agenthive-latency-ms') ?? 0), output };
  },
  runAsync: async (name: string, input: unknown, webhookUrl?: string): Promise<{ runId: string; statusUrl: string }> => {
    const res = await fetch(`/api/v1/run/${encodeURIComponent(name)}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-agenthive-async': '1', ...(webhookUrl ? { 'x-agenthive-webhook': webhookUrl } : {}) }, body: JSON.stringify(input) });
    const body = safeJson(await res.text()) as { error?: string; runId?: string; statusUrl?: string } | null;
    if (res.status !== 202 || !body?.runId) throw new ApiError(body?.error ?? `${res.status} ${res.statusText}`, res.status, body);
    return { runId: body.runId, statusUrl: body.statusUrl ?? '' };
  },
  getRun: (runId: string) => request<RunView>(`/api/v1/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' }),
  webhookSecret: () => request<{ secret: string; recipe: string }>('/api/v1/webhooks/secret', { cache: 'no-store' }),
  rotateWebhookSecret: () => request<{ secret: string }>('/api/v1/webhooks/secret/rotate', { method: 'POST' }),
  myRuns: () => request<{ runs: RunLog[] }>('/api/v1/runs', { cache: 'no-store' }).then((r) => r.runs),
  agentRuns: (name: string) => request<{ runnable: boolean; reason: string | null; runs: RunLog[] }>(`/api/v1/agents/${encodeURIComponent(name)}/runs`, { cache: 'no-store' }),
  gatewaySecret: (name: string) => request<{ secret: string; recipe: string }>(`/api/v1/agents/${encodeURIComponent(name)}/secret`, { cache: 'no-store' }),
  rotateGatewaySecret: (name: string) => request<{ secret: string }>(`/api/v1/agents/${encodeURIComponent(name)}/secret/rotate`, { method: 'POST' }),
  leaderboard: () => request<Leaderboard>('/api/leaderboard.json', { cache: 'no-store' }),
  trial: (slug: string) => request<TrialRanking>(`/api/trials/${encodeURIComponent(slug)}.json`, { cache: 'no-store' }),
  trialRuns: (slug: string, agent: string) => request<{ runs: TrialRunSummary[] }>(`/api/trials/${encodeURIComponent(slug)}/runs.json?agent=${encodeURIComponent(agent)}`, { cache: 'no-store' }).then((r) => r.runs),
  benchmark: (name: string) => request<{ runnable: boolean; reason: string | null; benchmark: BenchmarkReport | Agent['benchmark'] | null }>(`/agents/${encodeURIComponent(name)}/benchmark.json`, { cache: 'no-store' }),
  runBenchmark: (name: string) => request<{ benchmark: BenchmarkReport }>(`/api/v1/agents/${encodeURIComponent(name)}/benchmark`, { method: 'POST' }),
  package: (name: string) => request<PackageDoc>(`/agents/${encodeURIComponent(name)}/package.json`, { cache: 'no-store' }),
  audit: (name: string) => request<AuditResponse>(`/agents/${encodeURIComponent(name)}/audit.json`, { cache: 'no-store' }),
  report: (name: string, body: { reason: 'security' | 'rights' | 'other'; details: string; email?: string }) =>
    request<{ ok: true; id: string }>(`/api/agents/${encodeURIComponent(name)}/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  unpublish: (name: string) => request<{ ok: true; name: string; hiddenAt: string }>(`/api/v1/agents/${encodeURIComponent(name)}/unpublish`, { method: 'POST' }),
  rerunAudit: (name: string) => request<{ agent: Agent | null; audit: AuditReport }>(`/api/v1/agents/${encodeURIComponent(name)}/audit`, { method: 'POST' }),
  publish: (manifest: Record<string, unknown>) =>
    request<{ agent: Agent; url: string; audit: AuditReport }>('/api/v1/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(manifest),
    }),
};

export function blockedAuditFrom(e: unknown): AuditReport | null {
  if (e instanceof ApiError && e.status === 422) {
    const audit = (e.body as { code?: string; audit?: AuditReport } | null)?.audit;
    return audit && audit.blocked ? audit : null;
  }
  return null;
}

export function issuesFrom(e: unknown): ManifestIssue[] | null {
  if (e instanceof ApiError && e.status === 422) {
    const issues = (e.body as { issues?: ManifestIssue[] } | null)?.issues;
    return Array.isArray(issues) ? issues : null;
  }
  return null;
}
