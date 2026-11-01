import { beforeAll, describe, expect, it } from 'vitest';
import { createApp, type AppContext } from './app';
import { compositeScore, snapshotLeaderboard } from './leaderboard';

const upstream: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
  if ('__agenthive_probe' in body) return json({ error: 'unknown field' }, 400);
  if (url.endsWith('/strong')) return json({ answer: 'yes', n: 1 });
  if (url.endsWith('/weak')) return json({ answer: 'no', n: 0 });
  return json({ ok: true });
}) as typeof fetch;

let ctx: AppContext;
let authz: Record<string, string>;
const req = (path: string, init?: RequestInit) => ctx.app.request(path, init);
const publish = (name: string, category: string, endpoint: string, tests: unknown[], permissions = true) =>
  req('/api/v1/agents', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authz },
    body: JSON.stringify({
      apiVersion: 'agenthive.sh/v1',
      metadata: { name, version: '0.1.0', category, value: 'Leaderboard fixture agent answering yes or no questions.', tagline: 'A fake upstream agent used by the leaderboard test suite.' },
      spec: { framework: 'Custom A2A', endpoint, tests, ...(permissions ? { permissions: { network: ['upstream.example'], filesystem: 'none', shell: false, env: [] } } : {}) },
    }),
  });

beforeAll(async () => {
  ctx = await createApp({
    databaseUrl: 'pglite://memory',
    origin: 'https://agenthive.sh',
    auth: { secret: 'x'.repeat(40), baseURL: 'http://localhost' },
    auditContext: () => ({ fetch: (async () => new Response('', { status: 404 })) as typeof fetch, lookup: async () => [{ address: '93.184.216.34', family: 4 }], callTimeoutMs: 100, deadline: Date.now() + 5000, now: () => Date.now() }),
    gatewayFetch: upstream,
    cronSecret: 'cron-secret',
  });
  authz = { authorization: `Bearer ${ctx.testApiKey}` };
  expect((await publish('strong-agent', 'DevOps', 'https://upstream.example/strong', [{ name: 'says yes', input: { q: 1 }, expect: { contains: '"answer":"yes"' } }, { name: 'counts', input: { q: 2 }, expect: { jsonPath: { path: 'n', min: 1 } } }])).status).toBe(201);
  expect((await publish('weak-agent', 'DevOps', 'https://upstream.example/weak', [{ name: 'says yes', input: { q: 1 }, expect: { contains: '"answer":"yes"' } }, { name: 'counts', input: { q: 2 }, expect: { jsonPath: { path: 'n', min: 1 } } }])).status).toBe(201);
  expect((await publish('probes-only-agent', 'Finance', 'https://upstream.example/other', [])).status).toBe(201);
  expect((await publish('no-endpoint-agent', 'Finance', '', [], false)).status).toBe(422); // invalid endpoint, not eligible anyway
  await new Promise((r) => setTimeout(r, 150)); // background benchmarks
});

describe('compositeScore', () => {
  it('weights and renormalises', () => {
    expect(compositeScore({ benchmark: 100, audit: 100, availability: 100 })).toBe(100);
    expect(compositeScore({ benchmark: 100, audit: 60, availability: null })).toBe(85); // (50+18)/0.8
    expect(compositeScore({ benchmark: 80, audit: 50, availability: 100 })).toBe(75);
    expect(compositeScore({ benchmark: null, audit: 90, availability: 100 })).toBeNull();
    expect(compositeScore({ benchmark: 90, audit: null, availability: 100 })).toBeNull();
  });
});

describe('leaderboard', () => {
  it('ranks eligible third-party agents per category and keeps seeds apart', async () => {
    const res = await req('/api/leaderboard.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const board = (await res.json()) as { categories: Record<string, { rank: number; name: string; score: number; components: { benchmark: number; audit: number; availability: number | null }; benchmarkCases: number; delta: number | null }[]>; illustrative: { name: string }[] };
    const devops = board.categories['DevOps'];
    expect(devops.map((e) => e.name)).toEqual(['strong-agent', 'weak-agent']);
    expect(devops[0].rank).toBe(1);
    expect(devops[0].components.benchmark).toBe(100);
    expect(devops[1].components.benchmark).toBe(0);
    expect(devops[0].score).toBeGreaterThan(devops[1].score);
    expect(devops[0].components.availability).toBeNull();
    expect(devops[0].delta).toBeNull();
    const finance = board.categories['Finance'];
    expect(finance.map((e) => e.name)).toEqual(['probes-only-agent']);
    expect(finance[0].components.benchmark).toBeLessThanOrEqual(50);
    expect(finance[0].benchmarkCases).toBe(0);
    expect(board.illustrative.map((s) => s.name)).toContain('pg-query-optimizer');
    expect(Object.values(board.categories).flat().map((e) => e.name)).not.toContain('pg-query-optimizer');
  });

  it('filters by category and rejects unknown ones', async () => {
    const one = (await (await req('/api/leaderboard.json?category=DevOps')).json()) as { categories: Record<string, unknown[]> };
    expect(Object.keys(one.categories)).toEqual(['DevOps']);
    expect((await req('/api/leaderboard.json?category=Nope')).status).toBe(404);
  });

  it('snapshots daily and reports rank moves and history', async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    expect(await snapshotLeaderboard(ctx.db, yesterday)).toBe(3);
    // Make weak-agent climb: swap the scores by inserting a strong benchmark for it is complex; instead snapshot today after a reversed manual snapshot.
    const { leaderboardSnapshots } = await import('./db/schema');
    const { eq, and } = await import('drizzle-orm');
    const [weak] = await ctx.db.query.agents.findMany({ where: (a, { eq }) => eq(a.name, 'weak-agent') });
    await ctx.db.update(leaderboardSnapshots).set({ rank: 1 }).where(and(eq(leaderboardSnapshots.agentId, weak.id), eq(leaderboardSnapshots.day, yesterday.toISOString().slice(0, 10))));
    const board = (await (await req('/api/leaderboard.json?category=DevOps')).json()) as { categories: Record<string, { name: string; delta: number | null; previousRank: number | null }[]> };
    const w = board.categories['DevOps'].find((e) => e.name === 'weak-agent')!;
    expect(w.previousRank).toBe(1);
    expect(w.delta).toBe(-1);
    expect(await snapshotLeaderboard(ctx.db)).toBe(3);
    expect(await snapshotLeaderboard(ctx.db)).toBe(3); // idempotent per day
    const hist = (await (await req('/api/leaderboard/history.json?agent=strong-agent&days=7')).json()) as { history: { day: string; rank: number }[] };
    expect(hist.history.length).toBe(2);
    expect(hist.history.at(-1)?.rank).toBe(1);
    expect((await req('/api/leaderboard/history.json?agent=nope')).status).toBe(404);
  });

  it('cron writes the snapshot after the benchmarks', async () => {
    const res = await req('/api/cron/benchmark', { headers: { authorization: 'Bearer cron-secret' } });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 150));
    const hist = (await (await req('/api/leaderboard/history.json?agent=strong-agent&days=7')).json()) as { history: unknown[] };
    expect(hist.history.length).toBe(2); // same day → upsert, no new row
  });
});
