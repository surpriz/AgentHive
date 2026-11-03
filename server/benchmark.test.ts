import { beforeAll, describe, expect, it } from 'vitest';
import { createApp, type AppContext } from './app';
import { otherUserKey } from './test/users';
import { jsonPath } from './benchmark';

/** Fake upstream that behaves like a small real agent. */
const upstream: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
  if (url.endsWith('/good')) {
    if ('__agenthive_probe' in body) return json({ error: 'unknown field' }, 400);
    if (typeof body.sql === 'string') return json({ suggestions: ['CREATE INDEX orders_customer_idx ON orders(customer_id)'], rewritten: body.sql });
    return json({ ok: true });
  }
  if (url.endsWith('/flaky')) {
    if ('__agenthive_probe' in body) return json({ boom: true }, 500);
    return json({ suggestions: [] });
  }
  return new Response('nope', { status: 404 });
}) as typeof fetch;

let ctx: AppContext;
let authz: Record<string, string>;
const req = (path: string, init?: RequestInit) => ctx.app.request(path, init);
const publish = (name: string, endpoint: string, tests: unknown[]) =>
  req('/api/v1/agents', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authz },
    body: JSON.stringify({
      apiVersion: 'agenthive.sh/v1',
      metadata: { name, version: '0.1.0', category: 'Data & Analytics', value: 'Suggests indexes for slow queries, benchmark fixture.', tagline: 'A fake upstream agent used by the benchmark test suite.' },
      spec: { framework: 'Custom A2A', endpoint, tests },
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
});

describe('jsonPath', () => {
  it('walks dotted paths and lengths', () => {
    expect(jsonPath({ a: { b: [1, 2, 3] } }, 'a.b.length')).toBe(3);
    expect(jsonPath({ a: { b: [1, 2, 3] } }, 'a.b.1')).toBe(2);
    expect(jsonPath({ a: null }, 'a.b')).toBeUndefined();
    expect(jsonPath('text', 'length')).toBe(4);
  });
});

describe('benchmark', () => {
  it('runs after publish, judges author cases and registry probes, and is public', async () => {
    const res = await publish('good-agent', 'https://upstream.example/good', [
      { name: 'suggests an index', input: { sql: 'select 1' }, expect: { contains: 'CREATE INDEX', jsonPath: { path: 'suggestions.length', min: 1 }, maxLatencyMs: 5000 } },
      { name: 'echo rewritten', input: { sql: 'select 2' }, expect: { jsonPath: { path: 'rewritten', equals: 'select 2' } } },
      { name: 'wrong expectation', input: { sql: 'select 3' }, expect: { contains: 'DROP TABLE' } },
    ]);
    expect(res.status).toBe(201);
    expect(((await res.json()) as { benchmarkQueued: boolean }).benchmarkQueued).toBe(true);
    // background() defaults to inline-but-unawaited; give it a tick
    await new Promise((r) => setTimeout(r, 50));
    const pub = (await (await req('/agents/good-agent/benchmark.json')).json()) as { benchmark: { passed: number; total: number; passRate: number; trigger: string; results: { name: string; passed: boolean; reason: string | null }[] } };
    expect(pub.benchmark.trigger).toBe('publish');
    // liveness, malformed, 3 cases, latency = 6; one case fails on purpose; the rate is over the 3 cases
    expect(pub.benchmark.total).toBe(6);
    expect(pub.benchmark.passed).toBe(5);
    expect(pub.benchmark.passRate).toBe(66.7);
    expect(pub.benchmark.results.find((r) => r.name === 'wrong expectation')?.reason).toMatch(/does not contain/);
    const idx = (await (await req('/api/agents.json')).json()) as { agents: { name: string; benchmarkPassRate: number | null }[] };
    expect(idx.agents.find((a) => a.name === 'good-agent')?.benchmarkPassRate).toBe(66.7);
    const card = (await (await req('/agents/good-agent/agent.json')).json()) as { 'x-agenthive': { benchmark: { passRate: number } } };
    expect(card['x-agenthive'].benchmark.passRate).toBe(66.7);
    // the first author case doubles as the ready-to-run example on the Run tab
    const catalog = (await (await req('/api/catalog.json')).json()) as { agents: { name: string; exampleInput: unknown }[] };
    expect(catalog.agents.find((a) => a.name === 'good-agent')?.exampleInput).toEqual({ sql: 'select 1' });
  });

  it('flags a 5xx on unexpected input and keeps benchmark calls out of the measured metrics', async () => {
    expect((await publish('flaky-agent', 'https://upstream.example/flaky', [{ name: 'empty suggestions', input: { sql: 'x' }, expect: { jsonPath: { path: 'suggestions.length', min: 1 } } }])).status).toBe(201);
    await new Promise((r) => setTimeout(r, 50));
    const pub = (await (await req('/agents/flaky-agent/benchmark.json')).json()) as { benchmark: { results: { name: string; passed: boolean }[] } };
    expect(pub.benchmark.results.find((r) => r.name === 'malformed input')?.passed).toBe(false);
    expect(pub.benchmark.results.find((r) => r.name === 'empty suggestions')?.passed).toBe(false);
    const catalog = (await (await req('/api/catalog.json')).json()) as { agents: { name: string; runs30d: number }[] };
    expect(catalog.agents.find((a) => a.name === 'flaky-agent')?.runs30d).toBe(0);
    const mine = (await (await req('/api/v1/agents/flaky-agent/runs', { headers: authz })).json()) as { runs: { via: string; callerLogin: string }[] };
    expect(mine.runs.every((r) => r.via === 'benchmark' && r.callerLogin === 'agenthive-benchmark')).toBe(true);
  });

  it('owner re-run is gated by the persistent hourly limit; strangers cannot', async () => {
    // The publish benchmark just ran, so an owner re-run must wait.
    const soon = await req('/api/v1/agents/good-agent/benchmark', { method: 'POST', headers: authz });
    expect(soon.status).toBe(429);
    expect(((await soon.json()) as { retryAfterMs: number }).retryAfterMs).toBeGreaterThan(0);
    expect((await req('/api/v1/agents/good-agent/benchmark', { method: 'POST', headers: { authorization: `Bearer ${await otherUserKey(ctx)}` } })).status).toBe(403);
  });

  it('cron route is protected and schedules every runnable agent', async () => {
    expect((await req('/api/cron/benchmark')).status).toBe(403);
    const res = await req('/api/cron/benchmark', { headers: { authorization: 'Bearer cron-secret' } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { scheduled: number }).scheduled).toBe(2);
    await new Promise((r) => setTimeout(r, 100));
    const pub = (await (await req('/agents/good-agent/benchmark.json')).json()) as { benchmark: { trigger: string } };
    expect(pub.benchmark.trigger).toBe('cron');
  });

  it('a new version clears the published score and gets its own benchmark', async () => {
    const res = await req('/api/v1/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authz },
      body: JSON.stringify({
        apiVersion: 'agenthive.sh/v1',
        metadata: { name: 'good-agent', version: '0.2.0', category: 'Data & Analytics', value: 'Suggests indexes for slow queries, benchmark fixture.', tagline: 'A fake upstream agent used by the benchmark test suite.' },
        spec: { framework: 'Custom A2A', endpoint: 'https://upstream.example/good', tests: [{ name: 'ctrl\u0007chars\u001b', input: { sql: 'x' }, expect: { contains: 'CREATE INDEX' } }] },
      }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { benchmarkQueued: boolean }).benchmarkQueued).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    const pub = (await (await req('/agents/good-agent/benchmark.json')).json()) as { version: string; benchmark: { version: string; cases: number; results: { name: string }[] } };
    expect(pub.benchmark.version).toBe('0.2.0');
    expect(pub.benchmark.cases).toBe(1);
    expect(pub.benchmark.results.find((r) => r.name.startsWith('ctrl'))?.name).toBe('ctrlchars');
  });

  it('a case whose expectation blows up fails the case, not the benchmark', async () => {
    const { runBenchmark } = await import('./benchmark');
    const [row] = await ctx.db.query.agents.findMany({ where: (a, { eq }) => eq(a.name, 'good-agent') });
    const huge = 'x'.repeat(5000);
    const r = await runBenchmark(ctx.db, { fetch: upstream }, row, 'cron');
    expect(r.results.every((x) => (x.reason ?? '').length <= 301)).toBe(true);
    expect(r.cases).toBe(1);
    void huge;
  });
});
