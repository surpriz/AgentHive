import type { Agent } from '../types';

import { stringify } from 'yaml';

export const MANIFEST_API_VERSION = 'agenthive.sh/v1';
/** Pinned so generated configs never auto-upgrade to an unreviewed release. */
export const CLI_PACKAGE_SPEC = '@agenthive-sh/cli@0.6.0';

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
    security: { grade: a.grade, score: a.score, auditedAt: a.auditedAt, report: `${origin}/agents/${a.name}/audit.json` },
    benchmark: { passRate: a.benchmark?.passRate ?? null, ranAt: a.benchmark?.ranAt ?? null, report: `${origin}/agents/${a.name}/benchmark.json` },
    availability: { successRate: a.successRate, avgLatencyMs: a.avgLatencyMs, runs30d: a.runs30d },
    registry: { url: `${origin}/agents/${a.name}`, agentCard: `${origin}/agents/${a.name}/agent.json`, publishedAt: a.publishedAt },
  };
}

export function buildManifestYaml(a: Agent, origin = 'https://agenthive.sh'): string {
  return `# AgentHive manifest · ${origin}/agents/${a.name}\n` + stringify(buildManifestObject(a, origin), { lineWidth: 0 });
}

export function buildClaudeJson(a: Agent): string {
  if (a.apiVersion === 'v2') return `npx -y -p ${CLI_PACKAGE_SPEC} agent-cli pull ${a.name} --target claude`;
  return `# ${a.name} is hosted by its author and called through the registry gateway\nnpx -y -p ${CLI_PACKAGE_SPEC} agent-cli run ${a.name} --input '{"...": "..."}'`;
}

export function buildCursorRules(a: Agent): string {
  if (a.apiVersion === 'v2') return `npx -y -p ${CLI_PACKAGE_SPEC} agent-cli pull ${a.name} --target cursor`;
  return `# .cursor/rules/${a.name}.mdc\n# ${a.name}@${a.version} by ${a.author} is hosted by its author: call it through the gateway.\nWhen the task involves ${a.tags.slice(0, 4).join(', ')}, run: agent-cli run ${a.name} --input '<json matching its input schema>'\n`;
}

export function buildCliInstall(a: Agent): string {
  if (a.apiVersion === 'v2') {
    return `# into Claude Code (.claude/agents, .claude/skills, .mcp.json)\nagent-cli pull ${a.name} --target claude\n\n# into Cursor (.cursor/rules, .cursor/mcp.json)\nagent-cli pull ${a.name} --target cursor`;
  }
  return `# call it through the gateway (needs agent-cli login)\nagent-cli run ${a.name} --input '{"...": "..."}'\n\n# async, with a signed webhook\nagent-cli run ${a.name} --async --webhook https://your.host/hook --input '{"...": "..."}'`;
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
      audit: { grade: a.grade, score: a.score, auditedAt: a.auditedAt, report: `${origin}/agents/${a.name}/audit.json`, criteria: `${origin}/docs/grading` },
      model: a.model,
      license: a.license,
      tools: a.tools,
      benchmark: { passRate: a.benchmark?.passRate ?? null, ranAt: a.benchmark?.ranAt ?? null, report: `${origin}/agents/${a.name}/benchmark.json` },
      availability: { successRate: a.successRate, avgCostUsd: a.costPerRun, avgLatencyMs: a.avgLatencyMs, runs30d: a.runs30d },
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
      score: a.score,
      auditedAt: a.auditedAt,
      successRate: a.successRate,
      benchmarkPassRate: a.benchmark?.passRate ?? null,
      costPerRun: a.costPerRun,
      tools: a.tools,
      tags: a.tags,
      capabilities: a.capabilities,
      url: `${origin}/agents/${a.name}`,
      agentCard: `${origin}/agents/${a.name}/agent.json`,
      install: a.apiVersion === 'v2' ? `agent-cli pull ${a.name}` : `agent-cli run ${a.name} --input '{}'`,
      apiVersion: a.apiVersion,
      goal: a.goal ?? null,
    })),
  };
}
