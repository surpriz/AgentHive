import { randomUUID } from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from './db/client';
import { agentReports, agents, REPORT_REASONS, type AgentRow, type HiddenReason } from './db/schema';
import type { Mail } from './email';

/** What a report may carry. The details are free text so the admin knows what to look at. */
export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().min(10).max(2000),
  email: z.string().trim().email().max(200).optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const REPORT_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 } as const;

export async function fileReport(db: Db, agent: AgentRow, input: ReportInput, reporterId: string | null) {
  const id = randomUUID();
  await db.insert(agentReports).values({ id, agentId: agent.id, reporterId, reporterEmail: input.email ?? null, reason: input.reason, details: input.details });
  return id;
}

/** Takes an agent off the catalog. Idempotent: a second call keeps the first date and reason. */
export async function hideAgent(db: Db, agent: AgentRow, reason: HiddenReason): Promise<void> {
  if (agent.hiddenAt) return;
  await db.update(agents).set({ hiddenAt: new Date(), hiddenReason: reason, updatedAt: new Date() }).where(eq(agents.id, agent.id));
}

export async function restoreAgent(db: Db, agent: AgentRow): Promise<void> {
  await db.update(agents).set({ hiddenAt: null, hiddenReason: null, updatedAt: new Date() }).where(eq(agents.id, agent.id));
}

export async function listReports(db: Db, limit = 100) {
  return db
    .select({ id: agentReports.id, agent: agents.name, hiddenAt: agents.hiddenAt, reason: agentReports.reason, details: agentReports.details, reporterEmail: agentReports.reporterEmail, status: agentReports.status, createdAt: agentReports.createdAt })
    .from(agentReports)
    .innerJoin(agents, eq(agents.id, agentReports.agentId))
    .orderBy(desc(agentReports.createdAt))
    .limit(limit);
}

export async function resolveReports(db: Db, agentId: string, status: 'resolved' | 'dismissed'): Promise<void> {
  await db.update(agentReports).set({ status, resolvedAt: new Date() }).where(eq(agentReports.agentId, agentId));
}

/** One more package retrieval; fire and forget from the package endpoint. */
export async function countPull(db: Db, agentId: string): Promise<void> {
  await db.update(agents).set({ pulls: sql`${agents.pulls} + 1` }).where(eq(agents.id, agentId));
}

/** What a 410 answers with once an agent is hidden: enough for a tool to explain, nothing about the content. */
export function tombstone(agent: AgentRow) {
  return { error: 'removed', name: agent.name, reason: agent.hiddenReason ?? 'unpublished', removedAt: agent.hiddenAt?.toISOString() ?? null };
}

export const reportMail = (to: string, agent: string, input: ReportInput, url: string): Mail => ({
  to,
  subject: `[agenthive] report on ${agent}: ${input.reason}`,
  text: `A report was filed on ${agent} (${url}).\n\nReason: ${input.reason}\nFrom: ${input.email ?? 'anonymous'}\n\n${input.details}\n\nHide it from the dashboard API: POST /api/v1/agents/${agent}/takedown {"reason":"${input.reason}"}\n`,
});
