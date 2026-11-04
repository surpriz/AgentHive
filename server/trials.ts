import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from './db/client';
import { agents, trialResults, trials } from './db/schema';

/** The trials the site knows. Rows are created on first result; the catalog here is the source of titles. */
export const TRIALS: Record<string, { goal: string; title: string }> = {
  'code-audit': { goal: 'code-audit', title: 'Code audit of vibe-coded apps' },
};

export const RESULT_LIMITS = { bodyBytes: 1024 * 1024, modelLength: 64, taskLength: 64, batchLength: 64 };

/** What the harness posts: its run record, as written by `agenthive-harness run`. Only the fields the site reads are typed. */
export const runRecordSchema = z.object({
  harness: z.string().max(32),
  package: z.object({ name: z.string().max(64), version: z.string().max(32), author: z.string().max(64) }),
  task: z.object({ id: z.string().max(RESULT_LIMITS.taskLength), version: z.number().int(), stack: z.string().max(64) }),
  sandbox: z.object({ kind: z.enum(['local', 'e2b']), id: z.string().max(128) }),
  model: z.string().max(RESULT_LIMITS.modelLength),
  runIndex: z.number().int().min(0).max(99),
  startedAt: z.string(),
  endedAt: z.string(),
  result: z.object({
    usage: z.object({ input: z.number(), cacheWrite: z.number(), cacheRead: z.number(), output: z.number() }),
    costUsd: z.number().nullable(),
    capped: z.string().nullable(),
    durationMs: z.number(),
    ended: z.enum(['end_turn', 'cap', 'unparsable']),
    turns: z.array(z.unknown()),
    output: z.unknown(),
    outputText: z.string(),
  }),
  score: z
    .object({
      score: z.number(),
      recall: z.number(),
      precision: z.number(),
      found: z.array(z.string()),
      missed: z.array(z.string()),
      falsePositives: z.array(z.unknown()),
      incidental: z.array(z.unknown()),
      traps: z.array(z.object({ id: z.string(), resisted: z.boolean() })),
    })
    .nullable(),
});
export type RunRecord = z.infer<typeof runRecordSchema>;

export const resultPostSchema = z.object({ batchId: z.string().min(1).max(RESULT_LIMITS.batchLength), record: runRecordSchema });

export type RecordOutcome = { ok: true; id: string; replaced: boolean } | { ok: false; status: 404 | 422; message: string };

/** Stores one run. Same batch, agent, model, task and run index replaces the earlier row, so a retried post is harmless. */
export async function recordTrialResult(db: Db, trialId: string, batchId: string, record: RunRecord): Promise<RecordOutcome> {
  const trial = TRIALS[trialId];
  if (!trial) return { ok: false, status: 404, message: 'unknown trial' };
  const agent = await db.query.agents.findFirst({ where: eq(agents.name, record.package.name) });
  if (!agent) return { ok: false, status: 404, message: `unknown package ${record.package.name}` };
  if (agent.apiVersion !== 'v2') return { ok: false, status: 422, message: 'only declarative packages enter a trial' };
  await db
    .insert(trials)
    .values({ id: trialId, goal: trial.goal, title: trial.title, methodologyVersion: 1, lastBatchAt: new Date() })
    .onConflictDoUpdate({ target: trials.id, set: { lastBatchAt: new Date() } });
  const existing = await db.query.trialResults.findFirst({
    where: and(eq(trialResults.trialId, trialId), eq(trialResults.batchId, batchId), eq(trialResults.agentId, agent.id), eq(trialResults.model, record.model), eq(trialResults.taskId, record.task.id), eq(trialResults.runIndex, record.runIndex)),
  });
  const id = existing?.id ?? randomUUID();
  const row = {
    id,
    trialId,
    batchId,
    agentId: agent.id,
    version: record.package.version,
    model: record.model,
    taskId: record.task.id,
    taskVersion: record.task.version,
    runIndex: record.runIndex,
    score: record.score?.score ?? null,
    recall: record.score?.recall ?? null,
    precision: record.score?.precision ?? null,
    trapsResisted: record.score?.traps.filter((t) => t.resisted).length ?? 0,
    trapsTotal: record.score?.traps.length ?? 0,
    costUsd: record.result.costUsd,
    durationMs: Math.round(record.result.durationMs),
    inputTokens: Math.round(record.result.usage.input + record.result.usage.cacheWrite + record.result.usage.cacheRead),
    outputTokens: Math.round(record.result.usage.output),
    capped: record.result.capped,
    ended: record.result.ended,
    sandbox: record.sandbox.kind,
    record: record as unknown as Record<string, unknown>,
    createdAt: new Date(),
  };
  if (existing) await db.update(trialResults).set(row).where(eq(trialResults.id, id));
  else await db.insert(trialResults).values(row);
  return { ok: true, id, replaced: Boolean(existing) };
}

export interface RankingRow {
  agent: string;
  version: string;
  model: string;
  batchId: string;
  tasks: number;
  runs: number;
  /** Mean score over all runs, 0 to 100, null when no run produced a report. */
  score: number | null;
  /** Standard deviation of run scores. */
  spread: number | null;
  /** Median cost per run in USD. */
  costUsd: number | null;
  /** Median duration per run in seconds. */
  seconds: number | null;
  traps: { resisted: number; total: number };
  capped: number;
}

export interface TrialRanking {
  trial: string;
  title: string;
  goal: string;
  methodologyVersion: number;
  lastBatchAt: string | null;
  rows: RankingRow[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const stddev = (xs: number[]) => {
  const m = mean(xs);
  if (m === null || xs.length < 2) return xs.length ? 0 : null;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const round = (x: number | null, d: number) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);

/**
 * One row per agent and model, from that pair's most recent batch. Batch ids sort
 * chronologically (the runner uses timestamps), so the greatest id wins, whatever
 * order the posts arrived in. Sorted by mean score, ties by cost; agents without a
 * parsable report in the batch sit last.
 */
export async function trialRanking(db: Db, trialId: string): Promise<TrialRanking | null> {
  const trial = await db.query.trials.findFirst({ where: eq(trials.id, trialId) });
  if (!trial) {
    const known = TRIALS[trialId];
    return known ? { trial: trialId, title: known.title, goal: known.goal, methodologyVersion: 1, lastBatchAt: null, rows: [] } : null;
  }
  const rows = await db
    .select({ r: trialResults, name: agents.name })
    .from(trialResults)
    .innerJoin(agents, eq(agents.id, trialResults.agentId))
    .where(eq(trialResults.trialId, trialId))
    .orderBy(desc(trialResults.createdAt));
  const latestBatch = new Map<string, string>();
  for (const { r, name } of rows) {
    const key = `${name}\u0000${r.model}`;
    const cur = latestBatch.get(key);
    if (cur === undefined || r.batchId > cur) latestBatch.set(key, r.batchId);
  }
  const groups = new Map<string, { name: string; model: string; batchId: string; version: string; rows: typeof rows }>();
  for (const row of rows) {
    const key = `${row.name}\u0000${row.r.model}`;
    if (row.r.batchId !== latestBatch.get(key)) continue;
    const g = groups.get(key) ?? { name: row.name, model: row.r.model, batchId: row.r.batchId, version: row.r.version, rows: [] };
    g.rows.push(row);
    groups.set(key, g);
  }
  const out: RankingRow[] = [...groups.values()].map((g) => {
    const scores = g.rows.map((x) => x.r.score).filter((s): s is number => s !== null);
    return {
      agent: g.name,
      version: g.version,
      model: g.model,
      batchId: g.batchId,
      tasks: new Set(g.rows.map((x) => x.r.taskId)).size,
      runs: g.rows.length,
      score: round(mean(scores), 1),
      spread: round(stddev(scores), 1),
      costUsd: round(median(g.rows.map((x) => x.r.costUsd).filter((c): c is number => c !== null)), 4),
      seconds: round(median(g.rows.map((x) => x.r.durationMs / 1000)), 0),
      traps: { resisted: g.rows.reduce((s, x) => s + x.r.trapsResisted, 0), total: g.rows.reduce((s, x) => s + x.r.trapsTotal, 0) },
      capped: g.rows.filter((x) => x.r.capped !== null).length,
    };
  });
  out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.costUsd ?? Infinity) - (b.costUsd ?? Infinity) || a.agent.localeCompare(b.agent));
  return { trial: trial.id, title: trial.title, goal: trial.goal, methodologyVersion: trial.methodologyVersion, lastBatchAt: trial.lastBatchAt?.toISOString() ?? null, rows: out };
}

export interface RunSummary {
  id: string;
  agent: string;
  version: string;
  model: string;
  task: string;
  runIndex: number;
  batchId: string;
  score: number | null;
  recall: number | null;
  precision: number | null;
  traps: { resisted: number; total: number };
  costUsd: number | null;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  capped: string | null;
  ended: string;
  sandbox: string;
  createdAt: string;
}

const summarize = (r: typeof trialResults.$inferSelect, name: string): RunSummary => ({
  id: r.id,
  agent: name,
  version: r.version,
  model: r.model,
  task: r.taskId,
  runIndex: r.runIndex,
  batchId: r.batchId,
  score: r.score,
  recall: r.recall,
  precision: r.precision,
  traps: { resisted: r.trapsResisted, total: r.trapsTotal },
  costUsd: r.costUsd,
  durationMs: r.durationMs,
  inputTokens: r.inputTokens,
  outputTokens: r.outputTokens,
  capped: r.capped,
  ended: r.ended,
  sandbox: r.sandbox,
  createdAt: r.createdAt.toISOString(),
});

/** The recorded runs of one agent in a trial, newest first, without the traces. */
export async function trialRuns(db: Db, trialId: string, agentName: string, limit = 100): Promise<RunSummary[]> {
  const rows = await db
    .select({ r: trialResults, name: agents.name })
    .from(trialResults)
    .innerJoin(agents, eq(agents.id, trialResults.agentId))
    .where(and(eq(trialResults.trialId, trialId), eq(agents.name, agentName)))
    .orderBy(desc(trialResults.createdAt), trialResults.taskId, trialResults.runIndex)
    .limit(limit);
  return rows.map(({ r, name }) => summarize(r, name));
}

/** One full run record, trace included. */
export async function trialRun(db: Db, id: string): Promise<{ summary: RunSummary; record: Record<string, unknown> } | null> {
  const rows = await db
    .select({ r: trialResults, name: agents.name })
    .from(trialResults)
    .innerJoin(agents, eq(agents.id, trialResults.agentId))
    .where(eq(trialResults.id, id))
    .limit(1);
  if (!rows.length) return null;
  return { summary: summarize(rows[0].r, rows[0].name), record: rows[0].r.record };
}

/** How many results a trial holds, for the health of the batch pipeline. */
export async function trialResultCount(db: Db, trialId: string): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(trialResults).where(eq(trialResults.trialId, trialId));
  return n;
}
