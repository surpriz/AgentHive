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

export const GRADES = ['AAA', 'AA', 'A', 'B'] as const;
export type SecurityGrade = (typeof GRADES)[number];

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
  successRate: number;
  costPerRun: number;
  avgLatencyMs: number;
  runs30d: number;
  tools: string[];
  tags: string[];
  readme: string;
  useCases: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  capabilities: string[];
  model: string;
  license: string;
  publishedAt: string;
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
