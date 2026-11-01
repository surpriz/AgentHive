import { beforeAll, describe, expect, it } from 'vitest';
import { createApp, type AppContext } from './app';
import { RUN_LIMITS, verifyRunSignature } from './gateway';

/** Fake upstream + fake webhook receiver. */
const hooks: { headers: Record<string, string>; body: string }[] = [];
let hookFailuresLeft = 0;
const upstream: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const headers = Object.fromEntries(new Headers(init?.headers).entries());
  const body = String(init?.body ?? '');
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
  if (url.endsWith('/slow')) {
    await new Promise((r) => setTimeout(r, 60));
    return json({ done: true, got: JSON.parse(body) });
  }
  if (url.endsWith('/hook')) {
    hooks.push({ headers, body });
    if (hookFailuresLeft > 0) {
      hookFailuresLeft--;
      return new Response('later', { status: 503 });
    }
    return new Response(null, { status: 204 });
  }
  return new Response('nope', { status: 404 });
}) as typeof fetch;

let ctx: AppContext;
let authz: Record<string, string>;
const req = (path: string, init?: RequestInit) => ctx.app.request(path, init);

beforeAll(async () => {
  // Shrink the retry backoff so the suite stays fast.
  (RUN_LIMITS as { webhookBackoffMs: number[] }).webhookBackoffMs = [0, 10, 20];
  ctx = await createApp({
    databaseUrl: 'pglite://memory',
    origin: 'https://agenthive.sh',
    auth: { secret: 'x'.repeat(40), baseURL: 'http://localhost' },
    auditContext: () => ({ fetch: (async () => new Response('', { status: 404 })) as typeof fetch, lookup: async () => [{ address: '93.184.216.34', family: 4 }], callTimeoutMs: 100, deadline: Date.now() + 5000, now: () => Date.now() }),
    gatewayFetch: upstream,
  });
  authz = { authorization: `Bearer ${ctx.testApiKey}` };
  const pub = await req('/api/v1/agents', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authz },
    body: JSON.stringify({ apiVersion: 'agenthive.sh/v1', metadata: { name: 'slow-agent', version: '0.1.0', category: 'DevOps', value: 'Takes its time and answers, for async tests.', tagline: 'A fake slow upstream used by the async run tests.' }, spec: { framework: 'Custom A2A', endpoint: 'https://upstream.example/slow' } }),
  });
  expect(pub.status).toBe(201);
  await new Promise((r) => setTimeout(r, 150)); // publish benchmark
});

const poll = async (runId: string, until: (v: { status: string }) => boolean, ms = 3000) => {
  const t0 = Date.now();
  for (;;) {
    const v = (await (await req(`/api/v1/runs/${runId}`, { headers: authz })).json()) as { status: string; output: unknown; webhook: { status: string | null; attempts: number } | null; error: string | null };
    if (until(v) || Date.now() - t0 > ms) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
};

describe('async runs', () => {
  it('answers 202 with a run id, then exposes the result to the caller only', async () => {
    const res = await req('/api/v1/run/slow-agent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agenthive-async': '1', ...authz }, body: '{"task":"later"}' });
    expect(res.status).toBe(202);
    const { runId, status, statusUrl } = (await res.json()) as { runId: string; status: string; statusUrl: string };
    expect(status).toBe('queued');
    expect(statusUrl).toBe(`https://agenthive.sh/api/v1/runs/${runId}`);
    const done = await poll(runId, (v) => v.status === 'ok');
    expect(done.status).toBe('ok');
    expect(done.output).toEqual({ done: true, got: { task: 'later' } });
    const other = await ctx.auth.api.createApiKey({ body: { name: 'other', userId: 'seed-dbforge' } });
    expect((await req(`/api/v1/runs/${runId}`, { headers: { authorization: `Bearer ${other.key}` } })).status).toBe(404);
    expect((await req('/api/v1/runs/00000000-0000-0000-0000-000000000000', { headers: authz })).status).toBe(404);
  });

  it('still prechecks before queueing', async () => {
    expect((await req('/api/v1/run/slow-agent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agenthive-async': '1', ...authz }, body: 'nope' })).status).toBe(400);
    expect((await req('/api/v1/run/pg-query-optimizer', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agenthive-async': '1', ...authz }, body: '{}' })).status).toBe(409);
    expect((await req('/api/v1/run/slow-agent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agenthive-webhook': 'https://hooks.example/hook', ...authz }, body: '{}' })).status).toBe(400);
    expect((await req('/api/v1/run/slow-agent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agenthive-async': '1', 'x-agenthive-webhook': 'http://hooks.example/hook', ...authz }, body: '{}' })).status).toBe(400);
  });

  it('delivers a signed webhook, retrying on failure', async () => {
    hooks.length = 0;
    hookFailuresLeft = 1;
    const res = await req('/api/v1/run/slow-agent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agenthive-async': '1', 'x-agenthive-webhook': 'https://hooks.example/hook', ...authz }, body: '{"task":"hook"}' });
    expect(res.status).toBe(202);
    const { runId } = (await res.json()) as { runId: string };
    const done = await poll(runId, (v) => v.webhook?.status !== null && v.webhook?.status !== undefined);
    expect(done.webhook).toMatchObject({ status: 'delivered', attempts: 2 });
    expect(hooks.length).toBe(2);
    const last = hooks.at(-1)!;
    const payload = JSON.parse(last.body) as { runId: string; status: string; output: unknown };
    expect(payload.runId).toBe(runId);
    expect(payload.status).toBe('ok');
    expect(payload.output).toEqual({ done: true, got: { task: 'hook' } });
    // signature verifies with the caller's webhook secret
    const { webhookSecrets } = await import('./db/schema');
    const { eq } = await import('drizzle-orm');
    const [me] = await ctx.db.query.user.findMany({ where: (u, { eq }) => eq(u.login, 'testuser') });
    const [secret] = await ctx.db.select().from(webhookSecrets).where(eq(webhookSecrets.userId, me.id));
    expect(verifyRunSignature(secret.secret, last.headers['x-agenthive-timestamp'], last.body, last.headers['x-agenthive-signature'])).toBe(true);
  });

  it('marks a run lost when it never completes', async () => {
    const { runs } = await import('./db/schema');
    const { eq } = await import('drizzle-orm');
    const [me] = await ctx.db.query.user.findMany({ where: (u, { eq }) => eq(u.login, 'testuser') });
    const [agent] = await ctx.db.query.agents.findMany({ where: (a, { eq }) => eq(a.name, 'slow-agent') });
    const id = 'aaaaaaaa-0000-0000-0000-000000000001';
    await ctx.db.insert(runs).values({ id, agentId: agent.id, agentVersion: '0.1.0', callerId: me.id, callerLogin: 'testuser', via: 'api-key', status: 'running', latencyMs: 0, mode: 'async', createdAt: new Date(Date.now() - RUN_LIMITS.lostAfterMs - 1000) });
    const v = (await (await req(`/api/v1/runs/${id}`, { headers: authz })).json()) as { status: string; error: string };
    expect(v.status).toBe('lost');
    expect(v.error).toMatch(/retry/);
    const [row] = await ctx.db.select().from(runs).where(eq(runs.id, id));
    expect(row.status).toBe('lost');
  });

  it('secret endpoints need a session; metrics ignore unfinished runs', async () => {
    expect((await req('/api/v1/webhooks/secret', { headers: authz })).status).toBe(403);
    const catalog = (await (await req('/api/catalog.json')).json()) as { agents: { name: string; runs30d: number }[] };
    const slow = catalog.agents.find((a) => a.name === 'slow-agent')!;
    expect(slow.runs30d).toBe(3); // ok, ok (hook), lost — queued/running never counted
  });
});
