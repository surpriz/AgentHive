export type Framework = 'LangGraph' | 'CrewAI' | 'AutoGen' | 'MCP Server' | 'Custom A2A';
export type SecurityGrade = 'AAA' | 'AA' | 'A' | 'B';

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
  successRate: number;
  costPerRun: number;
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
    benchmark: { successRate: number; avgCostUsd: number; avgLatencyMs: number };
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
