import type { Agent } from '../src/types';
import type { AgentRow } from './db/schema';
import type { Manifest } from './manifest';

export function rowToAgent(r: AgentRow): Agent {
  return {
    id: r.id,
    name: r.name,
    version: r.latestVersion,
    author: r.author,
    value: r.value,
    tagline: r.tagline,
    framework: r.framework as Agent['framework'],
    category: r.category as Agent['category'],
    grade: r.grade,
    successRate: r.successRate,
    costPerRun: r.costPerRun,
    avgLatencyMs: r.avgLatencyMs,
    runs30d: r.runs30d,
    tools: r.tools,
    tags: r.tags,
    readme: r.readme,
    useCases: r.useCases,
    inputSchema: r.inputSchema,
    outputSchema: r.outputSchema,
    capabilities: r.capabilities,
    model: r.model,
    license: r.license,
    transport: r.transport as Agent['transport'],
    endpoint: r.endpoint,
    publishedAt: r.createdAt.toISOString().slice(0, 10),
    isSeed: r.isSeed,
  };
}

/** Columns a publisher controls. Everything else (grade, benchmark, owner) is set by the registry. */
export function manifestToColumns(m: Manifest) {
  return {
    name: m.metadata.name,
    value: m.metadata.value,
    tagline: m.metadata.tagline,
    framework: m.spec.framework,
    category: m.metadata.category,
    tools: m.spec.tools,
    tags: m.metadata.tags,
    capabilities: m.spec.capabilities,
    readme: m.readme,
    useCases: m.useCases,
    inputSchema: m.spec.io.input,
    outputSchema: m.spec.io.output,
    model: m.spec.model,
    license: m.metadata.license,
    transport: m.spec.transport,
    endpoint: m.spec.endpoint ?? null,
    latestVersion: m.metadata.version,
  };
}
