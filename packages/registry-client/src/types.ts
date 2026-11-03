export type Framework = 'Declarative' | 'LangGraph' | 'CrewAI' | 'AutoGen' | 'MCP Server' | 'Custom A2A';
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
  /** `v2`: a declarative package retrieved into your tool (`agent-cli pull`). `v1`: hosted by its author, called through the gateway. */
  apiVersion?: 'v1' | 'v2';
  goal?: string | null;
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

export type RetrievalTarget = 'claude' | 'cursor';

export interface AgentSetting {
  name: string;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'enum';
  description?: string;
  default?: string | number | boolean;
  values?: string[];
  min?: number;
  max?: number;
}

export interface McpBrick {
  name: string;
  package: string;
  args: string[];
  env: string[];
  permissions: { network: string[]; filesystem: 'none' | 'read' | 'write' };
}

export interface FileWrite {
  path: string;
  content: string;
}

export interface McpWrite {
  name: string;
  entry: { command: string; args: string[]; env: Record<string, string> };
  permissions: { network: string[]; filesystem: 'none' | 'read' | 'write' };
  package: string;
}

/** Files and MCP entries that make a package run inside one tool. Computed by the registry. */
export interface Layout {
  target: RetrievalTarget;
  files: FileWrite[];
  mcp: McpWrite[];
  mcpConfigPath: string;
}

/** GET /agents/<name>/package.json: a declarative (v2) agent with its files and per-tool layouts. */
export interface PackageDoc {
  name: string;
  version: string;
  author: string;
  apiVersion: 'v2';
  goal: string | null;
  license: string;
  value: string;
  tagline: string;
  settings: AgentSetting[];
  bricks: { skills: string[]; mcp: McpBrick[] };
  files: Record<string, string>;
  sha256: string | null;
  publishedAt: string;
  url: string;
  layouts: Record<RetrievalTarget, Layout>;
}

/** POST /api/v1/packages */
export interface PublishPackageBody {
  /** agent.yaml text (or the parsed object). */
  manifest: string | Record<string, unknown>;
  /** path → text: prompt.md, README.md, skills/<name>/*.md, examples/*. */
  files: Record<string, string>;
}

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

/** POST /api/v1/agents and POST /api/v1/packages */
export interface PublishResponse {
  agent: { name: string; version: string; author: string; grade: SecurityGrade; score: number | null; apiVersion?: 'v1' | 'v2' };
  entry: RegistryEntry;
  audit: AuditReport;
  url: string;
  /** Only for packages. */
  packageUrl?: string;
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
  runnable: boolean;
  reason: string | null;
  benchmark: BenchmarkReport | { passRate: number; ranAt: string } | null;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  author: string;
  value: string;
  category: string;
  version: string;
  grade: SecurityGrade;
  score: number;
  components: { benchmark: number | null; audit: number | null; availability: number | null };
  benchmarkCases: number;
  runs30d: number;
  delta: number | null;
  previousRank: number | null;
}

/** GET /api/leaderboard.json */
export interface Leaderboard {
  generatedAt: string;
  formula: string;
  categories: Record<string, LeaderboardEntry[]>;
}

/** GET /api/v1/runs/<runId> */
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

export interface AsyncRunTicket {
  runId: string;
  status: 'queued';
  statusUrl: string;
}
