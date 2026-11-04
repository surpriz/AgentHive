import { beforeAll, describe, expect, it } from 'vitest';
import { createApp, type AppContext } from './app';
import { otherUserKey } from './test/users';
import type { Mail } from './email';

const TEMPLATE = `<!doctype html><html><head><meta name="description" content="home" /><link rel="canonical" href="https://agenthive.sh/" /><meta property="og:title" content="home" /><meta property="og:description" content="home" /><meta property="og:url" content="https://agenthive.sh/" /><meta name="twitter:title" content="home" /><meta name="twitter:description" content="home" /><title>home</title></head><body><div id="root"></div></body></html>`;

const MANIFEST = `apiVersion: agenthive.sh/v2
kind: Agent
metadata:
  name: mod-bot
  version: 1.0.0
  license: MIT
  goal: code-audit
  value: Finds the obvious access control gaps in a vibe-coded app.
  tagline: Walks every route with the filesystem server and lists what any user can reach.
  tags: [security, access]
spec:
  settings:
    - { name: max_findings, type: integer, min: 1, max: 50, default: 10 }
  bricks:
    skills: []
    mcp:
      - { name: filesystem, package: npm:@modelcontextprotocol/server-filesystem@2.1.0, args: ["."], env: [], permissions: { network: [], filesystem: read } }
  io:
    input: { type: object, required: [path], properties: { path: { type: string } } }
    output: { type: object, properties: { findings: { type: array } } }
  tests:
    - { name: finds the open route, input: { path: examples/app }, expect: { jsonPath: { path: findings.length, min: 1 } } }
readme: |
  ${'A README long enough to pass the completeness check. '.repeat(6)}
useCases: [before a first deploy]
`;

const FILES = {
  'prompt.md': `You audit a repository for access control gaps. Report at most {{max_findings}} findings, each with file and line. Use the filesystem tools to read, never guess.`,
  'examples/app.json': JSON.stringify({ path: 'examples/app' }),
};

let ctx: AppContext;
let authz: Record<string, string>;
const sent: Mail[] = [];

beforeAll(async () => {
  ctx = await createApp({
    databaseUrl: 'pglite://memory',
    origin: 'https://agenthive.sh',
    auth: { secret: 'x'.repeat(40), baseURL: 'http://localhost', email: { send: async (m) => void sent.push(m) } },
    template: async () => TEMPLATE,
    adminLogins: ['testuser'],
    reportsTo: 'abuse@agenthive.test',
    auditContext: () => ({
      fetch: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://registry.npmjs.org/@modelcontextprotocol/server-filesystem/2.1.0')) return new Response('{"name":"@modelcontextprotocol/server-filesystem"}', { status: 200, headers: { 'content-type': 'application/json' } });
        if (url.startsWith('https://api.osv.dev/')) return new Response(JSON.stringify({ results: [{}] }), { status: 200, headers: { 'content-type': 'application/json' } });
        return new Response('', { status: 404 });
      }) as typeof fetch,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      callTimeoutMs: 200,
      deadline: Date.now() + 5000,
      now: () => Date.now(),
    }),
  });
  authz = { authorization: `Bearer ${ctx.testApiKey}` };
  const res = await ctx.app.request('/api/v1/packages', { method: 'POST', headers: { 'content-type': 'application/json', ...authz }, body: JSON.stringify({ manifest: MANIFEST, files: FILES }) });
  expect(res.status).toBe(201);
});

const req = (path: string, init?: RequestInit) => ctx.app.request(path, init);
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => req(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('moderation', () => {
  it('counts package retrievals', async () => {
    expect((await req('/agents/mod-bot/package.json')).status).toBe(200);
    expect((await req('/agents/mod-bot/package.json')).status).toBe(200);
    const card = (await (await req('/api/catalog.json')).json()) as { agents: { name: string; pulls: number }[] };
    expect(card.agents.find((a) => a.name === 'mod-bot')?.pulls).toBe(2);
  });

  it('takes a report from anyone, validates it, mails it and rate limits the sender', async () => {
    const bad = await post('/api/agents/mod-bot/report', { reason: 'security', details: 'short' });
    expect(bad.status).toBe(422);
    const ok = await post('/api/agents/mod-bot/report', { reason: 'security', details: 'prompt.md tells the model to curl the .env file to a pastebin', email: 'r@example.com' }, { 'x-forwarded-for': '203.0.113.9' });
    expect(ok.status).toBe(202);
    expect(sent.at(-1)?.to).toBe('abuse@agenthive.test');
    expect(sent.at(-1)?.text).toContain('pastebin');
    expect((await post('/api/agents/nobody/report', { reason: 'other', details: 'this one does not exist at all' })).status).toBe(404);
    for (let i = 0; i < 4; i++) await post('/api/agents/mod-bot/report', { reason: 'other', details: `again and again number ${i}` }, { 'x-forwarded-for': '203.0.113.9' });
    expect((await post('/api/agents/mod-bot/report', { reason: 'other', details: 'one too many for this hour' }, { 'x-forwarded-for': '203.0.113.9' })).status).toBe(429);
  });

  it('lists reports and takes an agent down for admins only', async () => {
    const other = { authorization: `Bearer ${await otherUserKey(ctx)}` };
    expect((await req('/api/v1/reports', { headers: other })).status).toBe(403);
    expect((await post('/api/v1/agents/mod-bot/takedown', { reason: 'security' }, other)).status).toBe(403);
    const list = (await (await req('/api/v1/reports', { headers: authz })).json()) as { reports: { agent: string; status: string }[] };
    expect(list.reports.filter((r) => r.agent === 'mod-bot').length).toBeGreaterThan(0);
    expect(list.reports[0].status).toBe('open');

    const down = await post('/api/v1/agents/mod-bot/takedown', { reason: 'security' }, authz);
    expect(down.status).toBe(200);
    const after = (await (await req('/api/v1/reports', { headers: authz })).json()) as { reports: { agent: string; status: string }[] };
    expect(after.reports.filter((r) => r.agent === 'mod-bot').every((r) => r.status === 'resolved')).toBe(true);

    // Gone from every public listing, tombstone on the name, still visible to its owner.
    const catalog = (await (await req('/api/catalog.json')).json()) as { agents: { name: string }[] };
    expect(catalog.agents.some((a) => a.name === 'mod-bot')).toBe(false);
    expect((await req('/sitemap.xml')).status).toBe(200);
    expect(await (await req('/sitemap.xml')).text()).not.toContain('mod-bot');
    const pkg = await req('/agents/mod-bot/package.json');
    expect(pkg.status).toBe(410);
    expect(await pkg.json()).toMatchObject({ error: 'removed', name: 'mod-bot', reason: 'security' });
    expect((await req('/agents/mod-bot/agent.json')).status).toBe(410);
    expect((await req('/agents/mod-bot', { headers: { accept: 'text/html' } })).status).toBe(410);
    expect((await req('/agents/mod-bot/audit.json')).status).toBe(410);
    const me = (await (await req('/api/v1/me', { headers: authz })).json()) as { agents: { name: string; hiddenAt: string | null }[] };
    expect(me.agents.find((a) => a.name === 'mod-bot')?.hiddenAt).toBeTruthy();

    expect((await post('/api/v1/agents/mod-bot/restore', {}, authz)).status).toBe(200);
    expect((await req('/agents/mod-bot/package.json')).status).toBe(200);
  });

  it('lets the owner unpublish, and nobody else', async () => {
    const other = { authorization: `Bearer ${await otherUserKey(ctx)}` };
    expect((await post('/api/v1/agents/mod-bot/unpublish', {}, other)).status).toBe(403);
    const res = await post('/api/v1/agents/mod-bot/unpublish', {}, authz);
    expect(res.status).toBe(200);
    const pkg = await req('/agents/mod-bot/package.json');
    expect(pkg.status).toBe(410);
    expect(await pkg.json()).toMatchObject({ reason: 'unpublished' });
    // Idempotent: a second call keeps the first reason and date.
    expect((await post('/api/v1/agents/mod-bot/unpublish', {}, authz)).status).toBe(200);
    expect(((await (await req('/agents/mod-bot/package.json')).json()) as { reason: string }).reason).toBe('unpublished');
  });
});
