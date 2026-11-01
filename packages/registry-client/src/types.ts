export type Framework = 'LangGraph' | 'CrewAI' | 'AutoGen' | 'MCP Server' | 'Custom A2A';
/** `pending`: published, not yet audited by the registry. */
export type SecurityGrade = 'AAA' | 'AA' | 'A' | 'B' | 'pending';

/** One row of /api/agents.json */
export interface RegistryEntry {
  name: string;
  version: string;
  author: string;
  tagline: string;
  /** Plain-language outcome line. Optional: older indexes omit it. */
  value?: string;
  framework: Framework;
  category: string;
  grade: SecurityGrade;
  /** Audit score behind the grade, null while pending. */
  score?: number | null;
  auditedAt?: string | null;
  /** null until the registry has benchmarked the agent */
  successRate: number | null;
  costPerRun: number | null;
  tools: string[];
  tags: string[];
  capabilities: string[];
  url: string;
  agentCard: string;
  install: string;
}

export interface RegistryIndex {
  apiVersion: string;
  generatedAt: string;
  count: number;
  agents: RegistryEntry[];
}

/** /agents/<name>/agent.json (A2A Agent Card + x-agenthive extension) */
export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  documentationUrl: string;
  provider: { organization: string; url: string };
  skills: { id: string; name: string; description: string; tags: string[] }[];
  'x-agenthive': {
    framework: Framework;
    category: string;
    securityGrade: SecurityGrade;
    model: string;
    license: string;
    tools: string[];
    benchmark: { successRate: number | null; avgCostUsd: number | null; avgLatencyMs: number | null; runs30d?: number };
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    publishedAt: string;
  };
}

export interface SearchOptions {
  query?: string;
  framework?: Framework;
  category?: string;
  grade?: SecurityGrade;
  limit?: number;
}

export type InstallTarget = 'claude' | 'cursor' | 'cli';

/** GET /api/v1/me */
export interface Me {
  user: { id: string; login: string; name: string; image: string | null };
  via: 'session' | 'api-key';
  agents: { name: string; version: string; grade: SecurityGrade; framework: Framework; category: string }[];
}

export interface ManifestIssue {
  path: string;
  message: string;
}

/** POST /api/v1/agents */
export interface PublishResponse {
  agent: { name: string; version: string; author: string; grade: SecurityGrade; score: number | null };
  entry: RegistryEntry;
  audit: AuditReport;
  url: string;
}

export interface AuditFinding {
  check: string;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  message: string;
  hint?: string;
}

/** The registry's audit report, see /docs/grading. */
export interface AuditReport {
  engine: string;
  auditedAt: string;
  score: number;
  grade: 'AAA' | 'AA' | 'A' | 'B';
  caps: { grade: 'AA' | 'A'; reason: string }[];
  blocked: boolean;
  findings: AuditFinding[];
  checks: { id: string; status: 'ok' | 'skipped' | 'error'; ms: number; note?: string }[];
  illustrative?: boolean;
}

/** GET /agents/<name>/audit.json */
export interface AuditResponse {
  agent: string;
  version: string;
  grade: SecurityGrade;
  score: number | null;
  criteria: string;
  report: AuditReport | null;
}

/** One gateway call, as logged by the registry. */
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

/** Result of POST /api/v1/run/<name>: the upstream body, parsed, plus gateway metadata. */
export interface RunResult<T = unknown> {
  runId: string;
  status: number;
  latencyMs: number;
  output: T;
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

/** GET /agents/<name>/benchmark.json */
export interface BenchmarkResponse {
  agent: string;
  version: string;
  illustrative: boolean;
  runnable: boolean;
  reason: string | null;
  benchmark: BenchmarkReport | { passRate: number; ranAt: string } | null;
}
