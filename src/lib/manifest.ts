import type { Agent } from '../types';

import { stringify } from 'yaml';

export const MANIFEST_API_VERSION = 'agenthive.sh/v1';
/** Pinned so generated configs never auto-upgrade to an unreviewed release. */
export const CLI_PACKAGE_SPEC = '@agenthive-sh/cli@0.1.0';

/** The manifest document as the registry serves it (and as `agent-cli push` sends it, minus the server-owned blocks). */
export function buildManifestObject(a: Agent, origin = 'https://agenthive.sh') {
  return {
    apiVersion: MANIFEST_API_VERSION,
    kind: 'Agent',
    metadata: {
      name: a.name,
      version: a.version,
      author: a.author,
      license: a.license,
      category: a.category,
      value: a.value,
      tagline: a.tagline,
      tags: a.tags,
    },
    spec: {
      framework: a.framework,
      model: a.model,
      transport: a.transport,
      ...(a.endpoint ? { endpoint: a.endpoint } : {}),
      capabilities: a.capabilities,
      tools: a.tools,
      io: { input: a.inputSchema, output: a.outputSchema },
    },
    readme: a.readme,
    useCases: a.useCases,
    // Server-owned. Ignored on push.
    security: { grade: a.grade, auditedAt: a.grade === 'pending' ? null : a.publishedAt },
    benchmark: { successRate: a.successRate, avgCostUsd: a.costPerRun, avgLatencyMs: a.avgLatencyMs, runs30d: a.runs30d },
    registry: { url: `${origin}/agents/${a.name}`, agentCard: `${origin}/agents/${a.name}/agent.json`, publishedAt: a.publishedAt },
  };
}

export function buildManifestYaml(a: Agent, origin = 'https://agenthive.sh'): string {
  return `# AgentHive manifest · ${origin}/agents/${a.name}\n` + stringify(buildManifestObject(a, origin), { lineWidth: 0 });
}

export function buildClaudeJson(a: Agent): string {
  return JSON.stringify(
    {
      mcpServers: {
        [a.name]: {
          command: 'npx',
          args: ['-y', CLI_PACKAGE_SPEC, 'serve', `${a.author}/${a.name}@${a.version}`],
          env: { AGENTHIVE_TOKEN: '${AGENTHIVE_TOKEN}' },
        },
      },
    },
    null,
    2,
  );
}

export function buildCursorRules(a: Agent): string {
  return `# .cursorrules — ${a.name}
# Installed from agenthive.sh/${a.author}/${a.name}@${a.version}

You have access to the "${a.name}" agent via MCP.
Use it when the task involves: ${a.tags.slice(0, 4).join(', ')}.
Capabilities: ${a.capabilities.join(', ')}.
Always pass inputs matching its input schema and surface its structured output verbatim.
`;
}

export function buildCliInstall(a: Agent): string {
  return `# one-liner
agent-cli add ${a.name}

# pinned version + run locally
agent-cli add ${a.author}/${a.name}@${a.version}
agent-cli run ${a.name} --input '{"...": "..."}'`;
}

/** A2A Agent Card (served at /agents/<name>/agent.json). */
export function buildAgentCard(a: Agent, origin = 'https://agenthive.sh') {
  return {
    name: a.name,
    description: a.tagline,
    url: a.endpoint ?? `${origin}/agents/${a.name}`,
    provider: { organization: a.author, url: `${origin}/@${a.author}` },
    version: a.version,
    documentationUrl: `${origin}/agents/${a.name}`,
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
    authentication: { schemes: ['bearer'] },
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json'],
    skills: a.capabilities.map((c) => ({
      id: c,
      name: c.split('.').reverse().join(' '),
      description: `${c} via ${a.framework}`,
      tags: a.tags.slice(0, 4),
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    })),
    'x-agenthive': {
      value: a.value,
      framework: a.framework,
      category: a.category,
      securityGrade: a.grade,
      model: a.model,
      license: a.license,
      tools: a.tools,
      benchmark: { successRate: a.successRate, avgCostUsd: a.costPerRun, avgLatencyMs: a.avgLatencyMs, runs30d: a.runs30d },
      transport: a.transport,
      isSeed: a.isSeed,
      inputSchema: a.inputSchema,
      outputSchema: a.outputSchema,
      publishedAt: a.publishedAt,
    },
  };
}

/** Registry index (served at /api/agents.json). */
export function buildRegistryIndex(agents: Agent[], origin = 'https://agenthive.sh') {
  return {
    apiVersion: MANIFEST_API_VERSION,
    generatedAt: new Date().toISOString(),
    count: agents.length,
    agents: agents.map((a) => ({
      name: a.name,
      version: a.version,
      author: a.author,
      tagline: a.tagline,
      value: a.value,
      framework: a.framework,
      category: a.category,
      grade: a.grade,
      successRate: a.successRate,
      costPerRun: a.costPerRun,
      tools: a.tools,
      tags: a.tags,
      capabilities: a.capabilities,
      url: `${origin}/agents/${a.name}`,
      agentCard: `${origin}/agents/${a.name}/agent.json`,
      install: `agent-cli add ${a.name}`,
    })),
  };
}
