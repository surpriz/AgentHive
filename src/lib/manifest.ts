import type { Agent } from '../types';

const transportFor = (a: Agent) => (a.framework === 'MCP Server' ? 'mcp/stdio' : 'a2a/http+json');

export function buildManifestYaml(a: Agent): string {
  const tools = a.tools.map((t) => `    - ${t}`).join('\n');
  const caps = a.capabilities.map((c) => `    - ${c}`).join('\n');
  return `# AgentHive manifest · agenthive.sh/${a.author}/${a.name}
apiVersion: agenthive.sh/v0
kind: Agent
metadata:
  name: ${a.name}
  version: ${a.version}
  author: ${a.author}
  license: ${a.license}
  category: ${a.category}
spec:
  framework: ${a.framework}
  model: ${a.model}
  transport: ${transportFor(a)}
  endpoint: https://run.agenthive.sh/${a.author}/${a.name}
  capabilities:
${caps}
  tools:
${tools}
  io:
    input: "#/schemas/input"
    output: "#/schemas/output"
security:
  grade: ${a.grade}
  audited_at: ${a.publishedAt}
  sandbox: wasm-isolated
  network_egress: allowlist
benchmark:
  success_rate: ${a.successRate}
  avg_cost_usd: ${a.costPerRun}
  avg_latency_ms: ${a.avgLatencyMs}
a2a:
  agent_card: https://run.agenthive.sh/${a.author}/${a.name}/.well-known/agent.json
  skills:
${a.capabilities.map((c) => `    - id: ${c}\n      name: ${c.split('.').reverse().join(' ')}`).join('\n')}
`;
}

export function buildClaudeJson(a: Agent): string {
  return JSON.stringify(
    {
      mcpServers: {
        [a.name]: {
          command: 'npx',
          args: ['-y', '@agenthive/cli', 'serve', `${a.author}/${a.name}@${a.version}`],
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
    url: `https://run.agenthive.sh/${a.author}/${a.name}`,
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
      benchmark: { successRate: a.successRate, avgCostUsd: a.costPerRun, avgLatencyMs: a.avgLatencyMs },
      inputSchema: a.inputSchema,
      outputSchema: a.outputSchema,
      publishedAt: a.publishedAt,
    },
  };
}

/** Registry index (served at /api/agents.json). */
export function buildRegistryIndex(agents: Agent[], origin = 'https://agenthive.sh') {
  return {
    apiVersion: 'agenthive.sh/v0',
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
