export const FRAMEWORKS = ['LangGraph', 'CrewAI', 'AutoGen', 'MCP Server', 'Custom A2A'] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const CATEGORIES = [
  'DevOps',
  'Security & Audit',
  'Finance',
  'Data & Analytics',
  'Code & Refactoring',
  'Marketing',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const GRADES = ['AAA', 'AA', 'A', 'B', 'pending'] as const;
/** `pending`: published but not yet audited. Only the registry assigns the other four. */
export type SecurityGrade = (typeof GRADES)[number];

export const TRANSPORTS = ['mcp/stdio', 'a2a/http+json'] as const;
export type Transport = (typeof TRANSPORTS)[number];

export interface Agent {
  id: string;
  name: string;
  version: string;
  author: string;
  tagline: string;
  /** One plain-language sentence: what the agent does for you, no jargon. */
  value: string;
  framework: Framework;
  category: Category;
  grade: SecurityGrade;
  /** Audit score 0–100 behind the grade; null while pending. */
  score: number | null;
  auditedAt: string | null;
  /** Gateway availability over 30 days (ok runs / runs), null below 20 runs. */
  successRate: number | null;
  /** Correctness measured by the registry benchmark; null until one ran. */
  benchmark: { passRate: number; passed: number; total: number; ranAt: string } | null;
  costPerRun: number | null;
  avgLatencyMs: number | null;
  runs30d: number;
  tools: string[];
  tags: string[];
  readme: string;
  useCases: string[];
  inputSchema: Record<string, unknown>;
  /** First author-declared test input; the Run tab starts from it. Absent on seeds and agents without tests. */
  exampleInput?: Record<string, unknown> | null;
  outputSchema: Record<string, unknown>;
  capabilities: string[];
  model: string;
  license: string;
  transport: Transport;
  /** Author-hosted endpoint declared in the manifest. Stored, never called in v1.0. */
  endpoint: string | null;
  publishedAt: string;
  /** Illustrative agent shipped with the registry, not published by a third party. */
  isSeed: boolean;
}

export type StepKind = 'thought' | 'tool_call' | 'action' | 'observation' | 'result';

export interface SandboxStep {
  kind: StepKind;
  text: string;
  tokens: number;
  delayMs: number;
}

export interface Filters {
  query: string;
  framework: Framework | 'All';
  category: Category | 'All';
  grade: SecurityGrade | 'All';
}

export interface PublishPayload {
  name: string;
  description: string;
  framework: Framework;
  category: Category;
  manifest: string;
  systemPrompt: string;
}
