import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp, type AppContext } from './app';
import { offlineContext } from './audit';
import { signRun } from './gateway';

const TEMPLATE = `<!doctype html><html><head><meta name="description" content="home" /><link rel="canonical" href="https://agenthive.sh/" /><meta property="og:title" content="home" /><meta property="og:description" content="home" /><meta property="og:url" content="https://agenthive.sh/" /><meta name="twitter:title" content="home" /><meta name="twitter:description" content="home" /><title>home</title></head><body><div id="root"></div></body></html>`;
const SECRET = 'trial-secret-for-tests';

let ctx: AppContext;

beforeAll(async () => {
  ctx = await createApp({
    databaseUrl: 'pglite://memory',
    origin: 'https://agenthive.sh',
    auth: { secret: 'x'.repeat(40), baseURL: 'http://localhost' },
    template: async () => TEMPLATE,
    auditContext: offlineContext,
    localAgentsDir: path.resolve(__dirname, '../agents'),
    trialSecret: SECRET,
  });
});

const record = (over: Record<string, unknown> = {}) => ({
  harness: '0.1.0',
  package: { name: 'vibe-app-security-triage', version: '1.0.0', author: 'surpriz' },
  task: { id: 't01-nextjs-supabase-notes', version: 1, stack: 'nextjs-supabase' },
  sandbox: { kind: 'e2b', id: 'sbx' },
  model: 'claude-haiku-5-5',
  runIndex: 0,
  startedAt: '2026-11-04T10:00:00.000Z',
  endedAt: '2026-11-04T10:01:36.000Z',
  result: { usage: { input: 70000, cacheWrite: 7000, cacheRead: 96000, output: 21000 }, costUsd: 0.0211, capped: null, durationMs: 96000, ended: 'end_turn', turns: [{ index: 0 }], output: { findings: [] }, outputText: '{}' },
  score: { score: 100, recall: 1, precision: 1, found: ['f1', 'f2', 'f3', 'f4'], missed: [], falsePositives: [], incidental: [], traps: [{ id: 'x1', resisted: true }] },
  ...over,
});

async function post(trial: string, body: unknown, secret = SECRET) {
  const text = JSON.stringify(body);
  const ts = String(Date.now());
  return ctx.app.request(`/api/trials/${trial}/results`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agenthive-timestamp': ts, 'x-agenthive-signature': signRun(secret, ts, text) }, body: text });
}

describe('trials', () => {
  it('refuses unsigned, badly signed and malformed results', async () => {
    expect((await ctx.app.request('/api/trials/code-audit/results', { method: 'POST', body: '{}' })).status).toBe(401);
    expect((await post('code-audit', { batchId: 'b1', record: record() }, 'wrong')).status).toBe(401);
    const bad = await post('code-audit', { batchId: 'b1', record: { ...record(), model: 42 } });
    expect(bad.status).toBe(422);
    expect((await post('nope', { batchId: 'b1', record: record() })).status).toBe(404);
    expect((await post('code-audit', { batchId: 'b1', record: record({ package: { name: 'ghost', version: '1.0.0', author: 'x' } }) })).status).toBe(404);
  });

  it('stores results, replaces a retried post and ranks agents per model', async () => {
    const first = await post('code-audit', { batchId: 'b1', record: record() });
    expect(first.status).toBe(201);
    const again = await post('code-audit', { batchId: 'b1', record: record({ result: { ...record().result, costUsd: 0.02 } }) });
    expect(again.status).toBe(200);
    expect(((await again.json()) as { replaced: boolean }).replaced).toBe(true);
    expect((await post('code-audit', { batchId: 'b1', record: record({ runIndex: 1, score: { ...record().score, score: 80 } }) })).status).toBe(201);
    expect((await post('code-audit', { batchId: 'b1', record: record({ task: { id: 't02-express-prisma-shop', version: 1, stack: 'express-prisma' }, score: { ...record().score, score: 60, traps: [] } }) })).status).toBe(201);
    expect((await post('code-audit', { batchId: 'b1', record: record({ package: { name: 'secret-exposure-hunter', version: '1.0.0', author: 'surpriz' }, score: { ...record().score, score: 50 }, result: { ...record().result, costUsd: 0.015 } }) })).status).toBe(201);
    // an older batch of the hunter must not leak into its row
    expect((await post('code-audit', { batchId: 'b0', record: record({ package: { name: 'secret-exposure-hunter', version: '0.9.0', author: 'surpriz' }, score: { ...record().score, score: 10 } }) })).status).toBe(201);

    const res = await ctx.app.request('/api/trials/code-audit.json');
    expect(res.status).toBe(200);
    const ranking = (await res.json()) as { title: string; lastBatchAt: string | null; rows: { agent: string; score: number; spread: number; tasks: number; runs: number; costUsd: number; traps: { resisted: number; total: number }; batchId: string }[] };
    expect(ranking.title).toBe('Code audit of vibe-coded apps');
    expect(ranking.lastBatchAt).not.toBeNull();
    expect(ranking.rows.map((r) => r.agent)).toEqual(['vibe-app-security-triage', 'secret-exposure-hunter']);
    const [triage, hunter] = ranking.rows;
    expect(triage).toMatchObject({ runs: 3, tasks: 2, score: 80, spread: 20, costUsd: 0.0211, traps: { resisted: 2, total: 2 } });
    expect(hunter).toMatchObject({ runs: 1, score: 50, batchId: 'b1' });

    const runs = (await (await ctx.app.request('/api/trials/code-audit/runs.json?agent=vibe-app-security-triage')).json()) as { runs: { id: string; task: string; score: number; costUsd: number }[] };
    expect(runs.runs).toHaveLength(3);
    expect(runs.runs.find((r) => r.task === "t01-nextjs-supabase-notes" && r.score === 100)?.costUsd).toBe(0.02);
    const full = await ctx.app.request(`/api/trials/runs/${runs.runs[0].id}.json`);
    expect(full.status).toBe(200);
    const doc = (await full.json()) as { summary: { agent: string }; record: { result: { turns: unknown[] } } };
    expect(doc.summary.agent).toBe('vibe-app-security-triage');
    expect(doc.record.result.turns).toHaveLength(1);
  });

  it('answers an empty ranking for a known trial without results and 404 otherwise', async () => {
    expect((await ctx.app.request('/api/trials/nope.json')).status).toBe(404);
    expect((await ctx.app.request('/api/trials/runs/not-a-uuid.json')).status).toBe(404);
  });

  it('refuses results when no secret is configured', async () => {
    const bare = await createApp({ databaseUrl: 'pglite://memory', origin: 'https://agenthive.sh', auth: { secret: 'y'.repeat(40), baseURL: 'http://localhost' }, template: async () => TEMPLATE, auditContext: offlineContext, devLogin: false });
    expect((await bare.app.request('/api/trials/code-audit/results', { method: 'POST', body: '{}' })).status).toBe(503);
    expect((await bare.app.request('/api/trials/code-audit.json')).status).toBe(200);
  });
});
