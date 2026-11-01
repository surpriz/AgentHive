import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte } from 'drizzle-orm';
import type { Db } from './db/client';
import { agents, leaderboardSnapshots, type AgentRow } from './db/schema';
import { measuredMetrics, type Measured } from './gateway';
import { latestBenchmark } from './benchmark';
import { CATEGORIES } from '../src/types';

export const WEIGHTS = { benchmark: 0.5, audit: 0.3, availability: 0.2 } as const;
/** A probes-only benchmark (no author cases) cannot contribute more than this to the benchmark component. */
export const PROBES_ONLY_CAP = 50;

export interface LeaderboardEntry {
  rank: number;
  name: string;
  author: string;
  value: string;
  category: string;
  version: string;
  grade: string;
  score: number;
  components: { benchmark: number | null; audit: number | null; availability: number | null };
  benchmarkCases: number;
  runs30d: number;
  /** Rank move since the previous snapshot: positive = climbed. null = new. */
  delta: number | null;
  previousRank: number | null;
}

export interface Leaderboard {
  generatedAt: string;
  formula: string;
  categories: Record<string, LeaderboardEntry[]>;
  /** Seeds, unranked. */
  illustrative: { name: string; category: string; grade: string }[];
}

export function compositeScore(c: { benchmark: number | null; audit: number | null; availability: number | null }): number | null {
  const parts: [number, number][] = [];
  if (c.benchmark !== null) parts.push([WEIGHTS.benchmark, c.benchmark]);
  if (c.audit !== null) parts.push([WEIGHTS.audit, c.audit]);
  if (c.availability !== null) parts.push([WEIGHTS.availability, c.availability]);
  if (c.benchmark === null || c.audit === null) return null; // not eligible
  const weight = parts.reduce((s, [w]) => s + w, 0);
  return Math.round((parts.reduce((s, [w, v]) => s + w * v, 0) / weight) * 10) / 10;
}

export async function computeLeaderboard(db: Db, now = new Date()): Promise<Leaderboard> {
  const rows = await db.select().from(agents).orderBy(asc(agents.name));
  const measured = await measuredMetrics(db, now);
  const day = now.toISOString().slice(0, 10);
  const previous = await db.select().from(leaderboardSnapshots).where(and(eq(leaderboardSnapshots.day, (await previousSnapshotDay(db, day)) ?? ''))).catch(() => []);
  const prevRank = new Map(previous.map((p) => [`${p.category}:${p.agentId}`, p.rank]));

  const categories: Record<string, LeaderboardEntry[]> = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  const illustrative: Leaderboard['illustrative'] = [];
  const candidates: (Omit<LeaderboardEntry, 'rank' | 'delta' | 'previousRank'> & { id: string; benchmarkAt: string })[] = [];
  for (const r of rows) {
    if (r.isSeed) {
      illustrative.push({ name: r.name, category: r.category, grade: r.grade });
      continue;
    }
    const b = await latestBenchmark(db, r.id);
    if (!b || r.grade === 'pending' || r.score === null) continue;
    const m: Measured | undefined = measured.get(r.id);
    const benchmark = b.cases > 0 ? b.passRate : Math.min(PROBES_ONLY_CAP, b.passRate);
    const components = { benchmark, audit: r.score, availability: m?.successRate ?? null };
    const score = compositeScore(components);
    if (score === null) continue;
    candidates.push({ id: r.id, name: r.name, author: r.author, value: r.value, category: r.category, version: r.latestVersion, grade: r.grade, score, components, benchmarkCases: b.cases, runs30d: m?.runs30d ?? 0, benchmarkAt: b.ranAt });
  }
  for (const cat of Object.keys(categories)) {
    const list = candidates
      .filter((c) => c.category === cat)
      .sort((a, b) => b.score - a.score || b.runs30d - a.runs30d || b.benchmarkAt.localeCompare(a.benchmarkAt));
    categories[cat] = list.map((c, i) => {
      const prev = prevRank.get(`${cat}:${c.id}`) ?? null;
      const { id: _id, benchmarkAt: _at, ...rest } = c;
      void _id;
      void _at;
      return { ...rest, rank: i + 1, previousRank: prev, delta: prev === null ? null : prev - (i + 1) };
    });
  }
  return { generatedAt: now.toISOString(), formula: '0.5·benchmark + 0.3·audit + 0.2·availability, weights renormalised when availability is missing', categories, illustrative };
}

async function previousSnapshotDay(db: Db, beforeDay: string): Promise<string | null> {
  const rows = await db.select({ day: leaderboardSnapshots.day }).from(leaderboardSnapshots).orderBy(desc(leaderboardSnapshots.day)).limit(400);
  const days = [...new Set(rows.map((r) => r.day))].filter((d) => d < beforeDay);
  return days[0] ?? null;
}

/** Writes today's snapshot (idempotent per day). Returns the number of ranked agents. */
export async function snapshotLeaderboard(db: Db, now = new Date()): Promise<number> {
  const board = await computeLeaderboard(db, now);
  const day = now.toISOString().slice(0, 10);
  const ids = new Map((await db.select({ id: agents.id, name: agents.name }).from(agents)).map((a) => [a.name, a.id]));
  let n = 0;
  for (const [category, entries] of Object.entries(board.categories)) {
    for (const e of entries) {
      const agentId = ids.get(e.name);
      if (!agentId) continue;
      await db
        .insert(leaderboardSnapshots)
        .values({ id: randomUUID(), day, category, agentId, rank: e.rank, score: e.score })
        .onConflictDoUpdate({ target: [leaderboardSnapshots.day, leaderboardSnapshots.category, leaderboardSnapshots.agentId], set: { rank: e.rank, score: e.score } });
      n++;
    }
  }
  return n;
}

export async function rankHistory(db: Db, agent: AgentRow, days = 30): Promise<{ day: string; rank: number; score: number }[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({ day: leaderboardSnapshots.day, rank: leaderboardSnapshots.rank, score: leaderboardSnapshots.score })
    .from(leaderboardSnapshots)
    .where(and(eq(leaderboardSnapshots.agentId, agent.id), gte(leaderboardSnapshots.day, since)))
    .orderBy(asc(leaderboardSnapshots.day));
  return rows;
}
