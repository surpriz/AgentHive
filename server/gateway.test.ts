import { beforeAll, describe, expect, it } from 'vitest';
import { createApp, type AppContext } from './app';
import { otherUserKey } from './test/users';
import { MIN_RUNS_FOR_RATE, RUN_LIMITS, signRun, verifyRunSignature } from './gateway';

/** Fake upstream: records what it received, answers by path. */
const seen: { url: string; headers: Record<string, string>; body: string }[] = [];
const upstream: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const headers = Object.fromEntries(new Headers(init?.headers).entries());
  const body = String(init?.body ?? '');
  seen.push({ url, headers, body });
  if (url.endsWith('/echo')) return new Response(JSON.stringify({ echoed: JSON.parse(body), caller: headers['x-agenthive-caller'] }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.endsWith('/html')) return new Response('<h1>nope</h1>', { status: 200, headers: { 'content-type': 'text/html' } });
  if (url.endsWith('/boom')) return new Response(JSON.stringify({ error: 'down' }), { status: 503, headers: { 'content-type': 'application/json' } });
  if (url.endsWith('/hang')) throw new Error('upstream timed out after 20000ms');
  if (url.endsWith('/private')) throw new Error('blocked address 10.0.0.1 for private.example');
  return new Response('not found', { status: 404 });
}) as typeof fetch;

let ctx: AppContext;
let authz: Record<string, string>;
const req = (path: string, init?: RequestInit) => ctx.app.request(path, init);
const publish = (name: string, endpoint?: string, transport = 'a2a/http+json') =>
  req('/api/v1/agents', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authz },
    body: JSON.stringify({
      apiVersion: 'agenthive.sh/v1',
      metadata: { name, version: '0.1.0', category: 'DevOps', value: 'Answers whatever you send it, for gateway tests.', tagline: 'A fake upstream agent used by the gateway test suite.' },
      spec: { framework: 'Custom A2A', transport, ...(endpoint ? { endpoint } : {}) },
    }),
  });
const run = (name: string, body: unknown, headers: Record<string, string> = authz) =>
  req(`/api/v1/run/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeAll(async () => {
  ctx = await createApp({
    databaseUrl: 'pglite://memory',
    origin: 'https://agenthive.sh',
    auth: { secret: 'x'.repeat(40), baseURL: 'http://localhost' },
    auditContext: () => ({ fetch: (async () => new Response('', { status: 404 })) as typeof fetch, lookup: async () => [{ address: '93.184.216.34', family: 4 }], callTimeoutMs: 100, deadline: Date.now() + 5000, now: () => Date.now() }),
    gatewayFetch: upstream,
  });
  authz = { authorization: `Bearer ${ctx.testApiKey}` };
  for (const [name, path] of [['echo-agent', '/echo'], ['html-agent', '/html'], ['boom-agent', '/boom'], ['hang-agent', '/hang'], ['private-agent', '/private']]) {
    expect((await publish(name, `https://upstream.example${path}`)).status).toBe(201);
  }
  expect((await publish('no-endpoint-agent')).status).toBe(201);
  expect((await publish('stdio-agent', undefined, 'mcp/stdio')).status).toBe(201);
});

describe('signing', () => {
  it('round-trips and rejects stale or forged signatures', () => {
    const ts = String(Date.now());
    const sig = signRun('s3cret', ts, '{"a":1}');
    expect(verifyRunSignature('s3cret', ts, '{"a":1}', sig)).toBe(true);
    expect(verifyRunSignature('s3cret', ts, '{"a":2}', sig)).toBe(false);
    expect(verifyRunSignature('other', ts, '{"a":1}', sig)).toBe(false);
    expect(verifyRunSignature('s3cret', String(Date.now() - RUN_LIMITS.signatureSkewMs - 1), '{"a":1}', sig)).toBe(false);
    expect(verifyRunSignature('s3cret', ts, '{"a":1}', 'zz')).toBe(false);
  });
});

describe('run gateway', () => {
  it('requires auth and rejects agents that cannot run', async () => {
    expect((await run('echo-agent', { q: 1 }, {})).status).toBe(401);
    expect((await run('nope', { q: 1 })).status).toBe(404);
    for (const name of ['no-endpoint-agent', 'stdio-agent']) {
      const res = await run(name, { q: 1 });
      expect(res.status, name).toBe(409);
    }
  });

  it('validates the body before touching the upstream', async () => {
    const before = seen.length;
    expect((await run('echo-agent', 'not json')).status).toBe(400);
    expect((await run('echo-agent', '"a string"')).status).toBe(400);
    expect((await run('echo-agent', JSON.stringify({ big: 'x'.repeat(RUN_LIMITS.requestBytes) }))).status).toBe(413);
    expect(seen.length).toBe(before);
  });

  it('forwards the body verbatim with a verifiable signature and returns the upstream json', async () => {
    const res = await run('echo-agent', { task: 'hello', n: 2 });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-agenthive-run-id')).toMatch(/[0-9a-f-]{36}/);
    expect((await res.json()) as unknown).toEqual({ echoed: { task: 'hello', n: 2 }, caller: 'testuser' });
    const last = seen.at(-1)!;
    expect(last.url).toBe('https://upstream.example/echo');
    expect(last.body).toBe('{"task":"hello","n":2}');
    expect(last.headers['x-agenthive-agent']).toBe('echo-agent@0.1.0');
    const secretRes = await ctx.app.request('/api/v1/agents/echo-agent/secret', { headers: authz });
    expect(secretRes.status).toBe(403); // api-key auth cannot read the secret
    const [row] = await ctx.db.query.agents.findMany({ where: (a, { eq }) => eq(a.name, 'echo-agent') });
    expect(verifyRunSignature(row.gatewaySecret!, last.headers['x-agenthive-timestamp'], last.body, last.headers['x-agenthive-signature'])).toBe(true);
  });

  it('maps upstream failures to 502/504 and logs them', async () => {
    expect((await run('html-agent', { q: 1 })).status).toBe(502);
    const boom = await run('boom-agent', { q: 1 });
    expect(boom.status).toBe(503); // passed through, still logged as upstream_error
    expect((await run('hang-agent', { q: 1 })).status).toBe(504);
    expect((await run('private-agent', { q: 1 })).status).toBe(502);
    const mine = (await (await req('/api/v1/runs', { headers: authz })).json()) as { runs: { agentName: string; status: string; httpStatus: number | null }[] };
    const byAgent = Object.fromEntries(mine.runs.map((r) => [r.agentName, r]));
    expect(byAgent['html-agent'].status).toBe('upstream_error');
    expect(byAgent['boom-agent']).toMatchObject({ status: 'upstream_error', httpStatus: 503 });
    expect(byAgent['hang-agent'].status).toBe('timeout');
    expect(byAgent['private-agent'].status).toBe('blocked');
    expect(byAgent['echo-agent'].status).toBe('ok');
  });

  it('owner sees agent runs, others do not', async () => {
    const res = await req('/api/v1/agents/echo-agent/runs', { headers: authz });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { runnable: boolean; runs: { callerLogin: string }[] };
    expect(body.runnable).toBe(true);
    expect(body.runs[0].callerLogin).toBe('testuser');
    expect((await req('/api/v1/agents/echo-agent/runs', { headers: { authorization: `Bearer ${await otherUserKey(ctx)}` } })).status).toBe(403);
  });

  it('publishes measured metrics once enough runs exist, and enforces the per-minute quota', async () => {
    for (let i = 0; i < MIN_RUNS_FOR_RATE; i++) await run('echo-agent', { i });
    const idx = (await (await req('/api/agents.json')).json()) as { agents: { name: string; successRate: number | null; runs30d?: number }[] };
    const echo = idx.agents.find((a) => a.name === 'echo-agent')!;
    expect(echo.successRate).toBe(100);
    const catalog = (await (await req('/api/catalog.json')).json()) as { agents: { name: string; runs30d: number; avgLatencyMs: number | null; costPerRun: number | null }[] };
    const full = catalog.agents.find((a) => a.name === 'echo-agent')!;
    expect(full.runs30d).toBeGreaterThanOrEqual(MIN_RUNS_FOR_RATE);
    expect(full.avgLatencyMs).not.toBeNull();
    expect(full.costPerRun).toBeNull();

    let limited = 0;
    for (let i = 0; i < RUN_LIMITS.perCallerPerMinute; i++) {
      const res = await run('echo-agent', { i });
      if (res.status === 429) {
        limited++;
        expect(((await res.json()) as { retryAfterMs: number }).retryAfterMs).toBe(60_000);
        break;
      }
    }
    expect(limited).toBe(1);
  });

  it('echo endpoint reports whether the signature checks out', async () => {
    const anon = await req('/api/v1/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"x":1}' });
    expect(((await anon.json()) as { echo: unknown; received: { signatureValid: boolean | null } }).received.signatureValid).toBeNull();
    const [row] = await ctx.db.query.agents.findMany({ where: (a, { eq }) => eq(a.name, 'echo-agent') });
    const ts = String(Date.now());
    const signed = await req('/api/v1/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agenthive-agent': 'echo-agent@0.1.0', 'x-agenthive-timestamp': ts, 'x-agenthive-signature': signRun(row.gatewaySecret!, ts, '{"x":1}') },
      body: '{"x":1}',
    });
    expect(((await signed.json()) as { received: { signatureValid: boolean } }).received.signatureValid).toBe(true);
  });
});
