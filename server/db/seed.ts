import { count } from 'drizzle-orm';
import type { Db } from './client';
import { agentVersions, agents } from './schema';
import { user } from './auth-schema';
import { mockAgents } from '../../src/data/mockAgents';
import { buildManifestObject } from '../../src/lib/manifest';

/** Inserts the illustrative seed agents once, each under a system user named after its author. */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(agents);
  if (Number(n) > 0) return false;

  const authors = [...new Set(mockAgents.map((a) => a.author))];
  const now = new Date();
  await db
    .insert(user)
    .values(authors.map((a) => ({ id: `seed-${a}`, name: a, login: a, email: `${a}@seed.agenthive.sh`, emailVerified: true, createdAt: now, updatedAt: now })))
    .onConflictDoNothing();

  for (const a of mockAgents) {
    const createdAt = new Date(a.publishedAt);
    await db.insert(agents).values({
      id: `seed-${a.name}`,
      name: a.name,
      ownerId: `seed-${a.author}`,
      author: a.author,
      value: a.value,
      tagline: a.tagline,
      framework: a.framework,
      category: a.category,
      grade: a.grade,
      score: a.score,
      auditedAt: a.auditedAt ? new Date(a.auditedAt) : null,
      successRate: a.successRate,
      costPerRun: a.costPerRun,
      avgLatencyMs: a.avgLatencyMs,
      runs30d: a.runs30d,
      tools: a.tools,
      tags: a.tags,
      capabilities: a.capabilities,
      readme: a.readme,
      useCases: a.useCases,
      inputSchema: a.inputSchema,
      outputSchema: a.outputSchema,
      model: a.model,
      license: a.license,
      transport: a.transport,
      endpoint: a.endpoint,
      latestVersion: a.version,
      isSeed: true,
      createdAt,
      updatedAt: createdAt,
    });
    await db.insert(agentVersions).values({ id: `seed-${a.name}-${a.version}`, agentId: `seed-${a.name}`, version: a.version, manifest: buildManifestObject(a), createdAt });
  }
  return true;
}
