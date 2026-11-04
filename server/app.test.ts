import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import { createApp, type AppContext } from './app';
import { otherUserKey } from './test/users';

const TEMPLATE = `<!doctype html><html><head><meta name="description" content="home" /><link rel="canonical" href="https://agenthive.sh/" /><meta property="og:title" content="home" /><meta property="og:description" content="home" /><meta property="og:url" content="https://agenthive.sh/" /><meta name="twitter:title" content="home" /><meta name="twitter:description" content="home" /><title>home</title></head><body><div id="root"></div></body></html>`;

const manifest = (over: Record<string, unknown> = {}) => ({
  apiVersion: 'agenthive.sh/v1',
  kind: 'Agent',
  metadata: { name: 'jira-triage-bot', version: '0.1.0', category: 'DevOps', value: 'Triages incoming Jira tickets and routes them to the right team.', tagline: 'Reads new tickets, classifies severity and assigns an owner.', tags: ['jira'] },
  spec: { framework: 'LangGraph', tools: ['Jira API'], capabilities: ['ticket.triage'] },
  ...over,
});

let ctx: AppContext;
let authz: Record<string, string>;

beforeAll(async () => {
  ctx = await createApp({
    databaseUrl: 'pglite://memory',
    origin: 'https://agenthive.sh',
    auth: { secret: 'x'.repeat(40), baseURL: 'http://localhost' },
    template: async () => TEMPLATE,
    localAgentsDir: path.resolve(__dirname, '../agents'),
    // Offline audit: nothing resolves, nothing fetches.
    auditContext: () => ({ fetch: (async () => new Response('', { status: 404 })) as typeof fetch, lookup: async () => [{ address: '93.184.216.34', family: 4 }], callTimeoutMs: 100, deadline: Date.now() + 5000, now: () => Date.now() }),
  });
  authz = { authorization: `Bearer ${ctx.testApiKey}` };
});

/** Every folder under agents/ is published at boot, so the catalog count follows the repository. */
const REPO_AGENTS = readdirSync(path.resolve(__dirname, '../agents'), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
const req = (path: string, init?: RequestInit) => ctx.app.request(path, init);
const post = (path: string, body: unknown, headers: Record<string, string> = authz) =>
  req(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('public registry', () => {
  it('serves the index of the repository agents with CORS and cache headers', async () => {
    const res = await req('/api/agents.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toContain('s-maxage');
    const body = (await res.json()) as { apiVersion: string; count: number; agents: { name: string; value: string; grade: string }[] };
    expect(body.apiVersion).toBe('agenthive.sh/v1');
    expect(body.count).toBe(REPO_AGENTS);
    expect(body.agents.find((a) => a.name === 'vibe-app-security-triage')?.value).toMatch(/security/);
  });

  it('serves agent card, yaml, sitemap and pre-rendered html', async () => {
    const card = (await (await req('/agents/secret-exposure-hunter/agent.json')).json()) as { name: string; url: string };
    expect(card.name).toBe('secret-exposure-hunter');
    const yaml = await (await req('/agents/secret-exposure-hunter/agent.yaml')).text();
    expect(yaml).toContain('apiVersion: agenthive.sh/v2');
    expect(yaml).toContain('name: secret-exposure-hunter');
    expect(await (await req('/sitemap.xml')).text()).toContain('/agents/secret-exposure-hunter');
    const html = await req('/agents/secret-exposure-hunter');
    expect(html.status).toBe(200);
    expect(await html.text()).toContain('<title>secret-exposure-hunter · agenthive.sh</title>');
    const missing = await req('/agents/does-not-exist');
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('<title>home</title>');
    expect((await req('/agents/does-not-exist/agent.json')).status).toBe(404);
  });

  it('serves the home, agent and leaderboard pages with a static snapshot before the app root', async () => {
    const home = await (await req('/')).text();
    expect(home).toContain('id="ssr"');
    expect(home).toContain('Find the agent that actually does the job.');
    for (const name of ['secret-exposure-hunter', 'vibe-app-security-triage']) expect(home).toContain(`href="/agents/${name}"`);
    expect(home.indexOf('id="ssr"')).toBeLessThan(home.indexOf('<div id="root"></div>'));
    const agent = await (await req('/agents/secret-exposure-hunter')).text();
    expect(agent).toContain('Finds real credentials leaked');
    expect(agent).toContain('mcp filesystem');
    expect(agent).toContain('href="/agents/secret-exposure-hunter/package.json"');
    const board = await (await req('/leaderboard')).text();
    expect(board).toContain('<h1 class="text-3xl font-semibold tracking-tight">Leaderboard</h1>');
    expect(board).toContain('Nobody ranked yet.');
    const dashboard = await (await req('/dashboard')).text();
    expect(dashboard).not.toContain('id="ssr"');
  });
});

describe('auth', () => {
  it('rejects anonymous and bad keys', async () => {
    expect((await req('/api/v1/me')).status).toBe(401);
    expect((await req('/api/v1/me', { headers: { authorization: 'Bearer ah_nope' } })).status).toBe(401);
  });

  it('identifies the key owner', async () => {
    const res = await req('/api/v1/me', { headers: authz });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { login: string }; via: string; agents: unknown[] };
    expect(body.user.login).toBe('testuser');
    expect(body.via).toBe('api-key');
  });

  it('does not manage keys over api-key auth', async () => {
    expect((await req('/api/v1/keys', { headers: authz })).status).toBe(403);
  });
});

describe('publish', () => {
  it('rejects an invalid manifest with field-level issues', async () => {
    const res = await post('/api/v1/agents', manifest({ metadata: { name: 'Bad Name', version: 'one' } }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { issues: { path: string }[] };
    const paths = body.issues.map((i) => i.path);
    expect(paths).toContain('metadata.name');
    expect(paths).toContain('metadata.version');
    expect(paths).toContain('metadata.value');
  });

  it('accepts yaml, grades the agent from the audit and lists it', async () => {
    const yaml = `apiVersion: agenthive.sh/v1
kind: Agent
metadata:
  name: jira-triage-bot
  version: 0.1.0
  category: DevOps
  value: Triages incoming Jira tickets and routes them to the right team.
  tagline: Reads new tickets, classifies severity and assigns an owner.
spec:
  framework: LangGraph
  tools: [Jira API]
  capabilities: [ticket.triage]
security:
  grade: AAA
benchmark:
  successRate: 99.9
`;
    const res = await req('/api/v1/agents', { method: 'POST', headers: { 'content-type': 'application/yaml', ...authz }, body: yaml });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { agent: { grade: string; score: number | null; successRate: number | null; author: string }; audit: { grade: string; caps: unknown[] }; url: string };
    expect(body.agent.grade).toBe('A'); // honest minimal manifest: capped by no permissions + no source
    expect(body.agent.score).toBe(body.audit.grade === 'A' ? body.agent.score : null);
    expect(body.audit.caps.length).toBe(2);
    expect(body.agent.successRate).toBeNull();
    expect(body.agent.author).toBe('testuser');
    expect(body.url).toBe('https://agenthive.sh/agents/jira-triage-bot');

    const idx = (await (await req('/api/agents.json')).json()) as { count: number };
    expect(idx.count).toBe(REPO_AGENTS + 1);
    const me = (await (await req('/api/v1/me', { headers: authz })).json()) as { agents: { name: string }[] };
    expect(me.agents.map((a) => a.name)).toContain('jira-triage-bot');
  });

  it('requires a greater version on re-publish', async () => {
    expect((await post('/api/v1/agents', manifest())).status).toBe(409);
    const res = await post('/api/v1/agents', manifest({ metadata: { ...manifest().metadata, version: '0.2.0' } }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { agent: { version: string } }).agent.version).toBe('0.2.0');
  });

  it('protects names owned by someone else', async () => {
    const res = await post('/api/v1/agents', manifest({ metadata: { ...manifest().metadata, version: '1.0.0' } }), { authorization: `Bearer ${await otherUserKey(ctx)}` });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('NAME_TAKEN');
  });
});

describe('audit', () => {
  it('refuses a manifest that leaks a credential and stores nothing', async () => {
    const res = await post('/api/v1/agents', manifest({ metadata: { ...manifest().metadata, name: 'leaky-bot' }, readme: 'use AKIAIOSFODNN7EXAMPLE' }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string; audit: { blocked: boolean; findings: { severity: string }[] } };
    expect(body.code).toBe('AUDIT_BLOCKED');
    expect(body.audit.findings[0].severity).toBe('blocker');
    expect((await req('/agents/leaky-bot/agent.json')).status).toBe(404);
  });

  it('serves the public report and lets the owner re-run once per hour', async () => {
    const pub = (await (await req('/agents/jira-triage-bot/audit.json')).json()) as { grade: string; report: { findings: unknown[]; checks: unknown[] } };
    expect(pub.grade).toBe('A');
    expect(pub.report.checks.length).toBe(5);

    const rerun = await req('/api/v1/agents/jira-triage-bot/audit', { method: 'POST', headers: authz });
    expect(rerun.status).toBe(200);
    expect(((await rerun.json()) as { audit: { grade: string } }).audit.grade).toBe('A');
    expect((await req('/api/v1/agents/jira-triage-bot/audit', { method: 'POST', headers: authz })).status).toBe(429);
    expect((await req('/api/v1/agents/jira-triage-bot/audit', { method: 'POST', headers: { authorization: `Bearer ${await otherUserKey(ctx)}` } })).status).toBe(403);
  });

  it('reaches AA with declared permissions', async () => {
    const res = await post('/api/v1/agents', manifest({ metadata: { ...manifest().metadata, name: 'tidy-bot' }, spec: { framework: 'CrewAI', permissions: { network: ['api.example.com'], filesystem: 'none', shell: false, env: [] } } }));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { agent: { grade: string } }).agent.grade).toBe('AA');
  });
});
