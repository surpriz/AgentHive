import { desc, eq } from 'drizzle-orm';
import type { Db } from './db/client';
import { agentVersions, agents, audits } from './db/schema';
import { compareSemver, type Manifest } from './manifest';
import { manifestToColumns, rowToAgent } from './registry';
import { runAudit, type AuditContext, type Report } from './audit';
import type { Agent } from '../src/types';

export type PublishResult =
  | { ok: true; agent: Agent; created: boolean; audit: Report }
  | { ok: false; status: 409 | 403; code: 'NAME_TAKEN' | 'VERSION_NOT_GREATER' | 'SEED_READONLY'; message: string }
  | { ok: false; status: 422; code: 'AUDIT_BLOCKED'; message: string; audit: Report };

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
export async function publishManifest(db: Db, who: Publisher, manifest: Manifest, auditCtx?: AuditContext): Promise<PublishResult> {
  const cols = manifestToColumns(manifest);
  const existing = await db.query.agents.findFirst({ where: eq(agents.name, cols.name) });

  if (existing) {
    if (existing.isSeed) return { ok: false, status: 403, code: 'SEED_READONLY', message: `"${cols.name}" is a registry seed and cannot be overwritten` };
    if (existing.ownerId !== who.userId) return { ok: false, status: 409, code: 'NAME_TAKEN', message: `"${cols.name}" is owned by ${existing.author}` };
    if (compareSemver(cols.latestVersion, existing.latestVersion) <= 0) {
      return { ok: false, status: 409, code: 'VERSION_NOT_GREATER', message: `version ${cols.latestVersion} must be greater than published ${existing.latestVersion}` };
    }
  }

  // Audit before writing anything: a blocker (leaked secret, private endpoint) refuses the publish outright.
  const audit = await safeAudit(manifest, auditCtx);
  if (audit.blocked) return { ok: false, status: 422, code: 'AUDIT_BLOCKED', message: 'publish refused by the audit', audit };
  const graded = audit.checks.length > 0; // engine ran; otherwise stay pending
  const stamp = { grade: graded ? audit.grade : ('pending' as const), score: graded ? audit.score : null, auditedAt: graded ? new Date(audit.auditedAt) : null };

  const now = new Date();
  let row;
  let created: boolean;
  if (existing) {
    [row] = await db
      .update(agents)
      .set({ ...cols, ...stamp, author: who.login, updatedAt: now })
      .where(eq(agents.id, existing.id))
      .returning();
    created = false;
  } else {
    [row] = await db
      .insert(agents)
      .values({ id: newId(), ownerId: who.userId, author: who.login, ...cols, ...stamp })
      .returning();
    created = true;
  }
  await db.insert(agentVersions).values({ id: newId(), agentId: row.id, version: cols.latestVersion, manifest });
  if (graded) await db.insert(audits).values({ id: newId(), agentId: row.id, version: cols.latestVersion, grade: audit.grade, score: audit.score, report: audit as unknown as Record<string, unknown> });
  return { ok: true, agent: rowToAgent(row), created, audit };
}

/** Re-runs the audit on the stored manifest of the latest version and updates the grade. */
export async function reauditAgent(db: Db, agentId: string, auditCtx?: AuditContext): Promise<Report | null> {
  const version = await db.query.agentVersions.findFirst({ where: eq(agentVersions.agentId, agentId), orderBy: desc(agentVersions.createdAt) });
  if (!version) return null;
  const { parseManifest } = await import('./manifest');
  const parsed = parseManifest(version.manifest);
  if (!parsed.ok) return null;
  const audit = await safeAudit(parsed.manifest, auditCtx);
  if (audit.checks.length === 0) return audit;
  await db.insert(audits).values({ id: newId(), agentId, version: version.version, grade: audit.blocked ? 'B' : audit.grade, score: audit.score, report: audit as unknown as Record<string, unknown> });
  await db.update(agents).set({ grade: audit.blocked ? 'B' : audit.grade, score: audit.score, auditedAt: new Date(audit.auditedAt), updatedAt: new Date() }).where(eq(agents.id, agentId));
  return audit;
}

export async function latestAudit(db: Db, agentId: string): Promise<Report | null> {
  const row = await db.query.audits.findFirst({ where: eq(audits.agentId, agentId), orderBy: desc(audits.createdAt) });
  return row ? (row.report as unknown as Report) : null;
}

/** The engine never throws; if it somehow does, the agent stays pending rather than failing the publish. */
async function safeAudit(manifest: Manifest, ctx?: AuditContext): Promise<Report> {
  try {
    return await runAudit(manifest, ctx);
  } catch (e) {
    console.error('audit engine failed', e);
    return { engine: 'v1', auditedAt: new Date().toISOString(), score: 0, grade: 'B', caps: [], blocked: false, findings: [], checks: [] };
  }
}
