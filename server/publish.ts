import { eq } from 'drizzle-orm';
import type { Db } from './db/client';
import { agentVersions, agents } from './db/schema';
import { compareSemver, type Manifest } from './manifest';
import { manifestToColumns, rowToAgent } from './registry';
import type { Agent } from '../src/types';

export type PublishResult =
  | { ok: true; agent: Agent; created: boolean }
  | { ok: false; status: 409 | 403; code: 'NAME_TAKEN' | 'VERSION_NOT_GREATER' | 'SEED_READONLY'; message: string };

export interface Publisher {
  userId: string;
  /** GitHub login, shown as the author. */
  login: string;
}

const newId = () => crypto.randomUUID();

/**
 * First publisher owns the name. Later pushes must come from the owner and
 * carry a strictly greater semver. Seeds cannot be overwritten by anyone.
 */
export async function publishManifest(db: Db, who: Publisher, manifest: Manifest): Promise<PublishResult> {
  const cols = manifestToColumns(manifest);
  const existing = await db.query.agents.findFirst({ where: eq(agents.name, cols.name) });

  if (existing) {
    if (existing.isSeed) return { ok: false, status: 403, code: 'SEED_READONLY', message: `"${cols.name}" is a registry seed and cannot be overwritten` };
    if (existing.ownerId !== who.userId) return { ok: false, status: 409, code: 'NAME_TAKEN', message: `"${cols.name}" is owned by ${existing.author}` };
    if (compareSemver(cols.latestVersion, existing.latestVersion) <= 0) {
      return { ok: false, status: 409, code: 'VERSION_NOT_GREATER', message: `version ${cols.latestVersion} must be greater than published ${existing.latestVersion}` };
    }
    const now = new Date();
    const [row] = await db
      .update(agents)
      .set({ ...cols, author: who.login, updatedAt: now })
      .where(eq(agents.id, existing.id))
      .returning();
    await db.insert(agentVersions).values({ id: newId(), agentId: existing.id, version: cols.latestVersion, manifest });
    return { ok: true, agent: rowToAgent(row), created: false };
  }

  const id = newId();
  const [row] = await db
    .insert(agents)
    .values({ id, ownerId: who.userId, author: who.login, grade: 'pending', ...cols })
    .returning();
  await db.insert(agentVersions).values({ id: newId(), agentId: id, version: cols.latestVersion, manifest });
  return { ok: true, agent: rowToAgent(row), created: true };
}
