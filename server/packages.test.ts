import { beforeAll, describe, expect, it } from 'vitest';
import { createApp, type AppContext } from './app';

const TEMPLATE = `<!doctype html><html><head><meta name="description" content="home" /><link rel="canonical" href="https://agenthive.sh/" /><meta property="og:title" content="home" /><meta property="og:description" content="home" /><meta property="og:url" content="https://agenthive.sh/" /><meta name="twitter:title" content="home" /><meta name="twitter:description" content="home" /><title>home</title></head><body><div id="root"></div></body></html>`;

const MANIFEST = `apiVersion: agenthive.sh/v2
kind: Agent
metadata:
  name: secret-hunter
  version: 1.0.0
  license: MIT
  goal: code-audit
  value: Finds secrets committed in a vibe-coded app before they leak.
  tagline: Walks the repository with the filesystem server and reports every credential with file and line.
  tags: [security, secrets]
spec:
  settings:
    - { name: severity_floor, type: enum, values: [low, medium, high], default: medium }
    - { name: max_findings, type: integer, min: 1, max: 50, default: 10 }
  bricks:
    skills: [secret-patterns]
    mcp:
      - { name: filesystem, package: npm:@modelcontextprotocol/server-filesystem@2.1.0, args: ["."], env: [], permissions: { network: [], filesystem: read } }
      - { name: git, package: pypi:mcp-server-git==2026.10.28, env: [], permissions: { network: [], filesystem: read } }
  io:
    input: { type: object, required: [path], properties: { path: { type: string } } }
    output: { type: object, properties: { findings: { type: array } } }
  tests:
    - { name: finds the env file, input: { path: examples/app }, expect: { jsonPath: { path: findings.length, min: 1 } } }
readme: |
  ${'A README long enough to pass the completeness check. '.repeat(6)}
useCases: [before a first deploy]
`;

const FILES = {
  'prompt.md': `You audit a repository for leaked secrets. Report at most {{max_findings}} findings at or above {{severity_floor}} severity, each with file and line. Use the filesystem tools to read, never guess.`,
  'skills/secret-patterns/SKILL.md': `---\nname: secret-patterns\ndescription: What real credentials look like in source.\n---\n# Secret patterns\n\nAn AWS access key id starts with AKIA followed by 16 uppercase characters.`,
  'examples/app.json': JSON.stringify({ path: 'examples/app' }),
};

let ctx: AppContext;
let authz: Record<string, string>;
const hits: string[] = [];

beforeAll(async () => {
  ctx = await createApp({
    databaseUrl: 'pglite://memory',
    origin: 'https://agenthive.sh',
    auth: { secret: 'x'.repeat(40), baseURL: 'http://localhost' },
    template: async () => TEMPLATE,
    auditContext: () => ({
      fetch: (async (input: RequestInfo | URL) => {
        const url = String(input);
        hits.push(url);
        if (url.startsWith('https://registry.npmjs.org/@modelcontextprotocol/server-filesystem/2.1.0')) return new Response('{"name":"@modelcontextprotocol/server-filesystem"}', { status: 200, headers: { 'content-type': 'application/json' } });
        if (url.startsWith('https://pypi.org/pypi/mcp-server-git/2026.10.28/json')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
        if (url.startsWith('https://registry.npmjs.org/')) return new Response('{}', { status: 404 });
        if (url.startsWith('https://api.osv.dev/')) return new Response(JSON.stringify({ results: [{}, {}] }), { status: 200, headers: { 'content-type': 'application/json' } });
        return new Response('', { status: 404 });
      }) as typeof fetch,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      callTimeoutMs: 200,
      deadline: Date.now() + 5000,
      now: () => Date.now(),
    }),
  });
  authz = { authorization: `Bearer ${ctx.testApiKey}` };
});

const req = (path: string, init?: RequestInit) => ctx.app.request(path, init);
const publish = (body: unknown) => req('/api/v1/packages', { method: 'POST', headers: { 'content-type': 'application/json', ...authz }, body: JSON.stringify(body) });

describe('packages', () => {
  it('refuses a v1 manifest and a package with bad files', async () => {
    const v1 = await publish({ manifest: MANIFEST.replace('agenthive.sh/v2', 'agenthive.sh/v1'), files: FILES });
    expect(v1.status).toBe(422);
    const bad = await publish({ manifest: MANIFEST, files: { ...FILES, 'scripts/run.sh': '#!/bin/sh', 'prompt.md': 'short' } });
    expect(bad.status).toBe(422);
    const issues = ((await bad.json()) as { issues: { path: string; message: string }[] }).issues;
    expect(issues.some((i) => i.path === 'files.scripts/run.sh')).toBe(true);
    expect(issues.some((i) => i.path === 'files.prompt.md')).toBe(true);
    const missingSkill = await publish({ manifest: MANIFEST, files: { 'prompt.md': FILES['prompt.md'] } });
    expect(((await missingSkill.json()) as { issues: { message: string }[] }).issues.some((i) => /secret-patterns/.test(i.message))).toBe(true);
    const unknownPlaceholder = await publish({ manifest: MANIFEST, files: { ...FILES, 'prompt.md': FILES['prompt.md'] + ' {{nope}}' } });
    expect(((await unknownPlaceholder.json()) as { issues: { message: string }[] }).issues.some((i) => /\{\{nope\}\}/.test(i.message))).toBe(true);
  });

  it('publishes, runs the v2 checks and serves the package with per-tool layouts', async () => {
    const res = await publish({ manifest: MANIFEST, files: FILES });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { agent: { apiVersion: string; framework: string; category: string; goal: string; bricks: { mcp: unknown[] } }; audit: { engine: string; checks: { id: string; status: string }[]; findings: unknown[] }; packageUrl: string };
    expect(body.agent.apiVersion).toBe('v2');
    expect(body.agent.framework).toBe('Declarative');
    expect(body.agent.category).toBe('Security & Audit');
    expect(body.agent.goal).toBe('code-audit');
    expect(body.audit.engine).toBe('v2');
    expect(body.audit.checks.map((c) => c.id).sort()).toEqual(['bricks', 'completeness', 'permissions', 'scripts', 'secrets', 'vulnerabilities']);
    expect(body.audit.checks.every((c) => c.status === 'ok')).toBe(true);
    expect(body.audit.findings).toEqual([]);
    expect(hits.some((h) => h.includes('server-filesystem/2.1.0'))).toBe(true);
    expect(hits.some((h) => h.includes('pypi.org/pypi/mcp-server-git/2026.10.28'))).toBe(true);
    expect(body.packageUrl).toBe('https://agenthive.sh/agents/secret-hunter/package.json');

    const pkg = (await (await req('/agents/secret-hunter/package.json')).json()) as { files: Record<string, string>; sha256: string; layouts: Record<string, { files: { path: string; content: string }[]; mcp: { name: string; entry: { command: string; args: string[] } }[]; mcpConfigPath: string }> };
    expect(Object.keys(pkg.files).sort()).toEqual(['examples/app.json', 'prompt.md', 'skills/secret-patterns/SKILL.md']);
    expect(pkg.sha256).toMatch(/^[0-9a-f]{64}$/);
    const claude = pkg.layouts.claude;
    expect(claude.files.map((f) => f.path)).toEqual(['.claude/agents/secret-hunter.md', '.claude/skills/secret-patterns/SKILL.md']);
    expect(claude.files[0].content).toContain('at most 10 findings at or above medium severity'); // defaults substituted
    expect(claude.mcp.map((m) => m.entry.command)).toEqual(['npx', 'uvx']);
    expect(claude.mcp[0].entry.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem@2.1.0', '.']);
    expect(claude.mcpConfigPath).toBe('.mcp.json');
    const cursor = pkg.layouts.cursor;
    expect(cursor.files.map((f) => f.path)).toEqual(['.cursor/rules/secret-hunter.mdc']);
    expect(cursor.files[0].content).toContain('## Skill: secret-patterns');

    const idx = (await (await req('/api/agents.json')).json()) as { agents: { name: string; install: string; apiVersion: string }[] };
    const entry = idx.agents.find((a) => a.name === 'secret-hunter')!;
    expect(entry.install).toBe('agent-cli pull secret-hunter');
    expect(entry.apiVersion).toBe('v2');

    // packages have no endpoint: nothing to benchmark, nothing to run through the gateway
    const bench = (await (await req('/agents/secret-hunter/benchmark.json')).json()) as { runnable: boolean };
    expect(bench.runnable).toBe(false);
    const hosted = await req('/agents/pg-query-optimizer/package.json');
    expect(hosted.status).toBe(404);
  });

  it('blocks a package that carries a secret and flags a missing brick', async () => {
    const leaked = await publish({ manifest: MANIFEST.replace('version: 1.0.0', 'version: 1.1.0'), files: { ...FILES, 'prompt.md': FILES['prompt.md'] + '\nkey: ghp_' + 'a'.repeat(36) } });
    expect(leaked.status).toBe(422);
    const body = (await leaked.json()) as { code: string; audit: { findings: { check: string; severity: string; message: string }[] } };
    expect(body.code).toBe('AUDIT_BLOCKED');
    expect(body.audit.findings[0]).toMatchObject({ check: 'secrets', severity: 'blocker' });
    expect(body.audit.findings[0].message).toContain('prompt.md');

    const ghost = await publish({ manifest: MANIFEST.replace('version: 1.0.0', 'version: 1.1.0').replace('server-filesystem@2.1.0', 'server-filesystem@9.9.9'), files: FILES });
    expect(ghost.status).toBe(200);
    const g = (await ghost.json()) as { audit: { findings: { check: string; severity: string }[] } };
    expect(g.audit.findings.some((f) => f.check === 'bricks' && f.severity === 'high')).toBe(true);
  });

  it('stores a declared scope and serves it on the catalog and the package', async () => {
    const scoped = MANIFEST.replace('version: 1.0.0', 'version: 9.9.9').replace('  io:', '  scope: [secret-exposure, committed-env]\n  io:');
    const res = await publish({ manifest: scoped, files: FILES });
    expect(res.status).toBe(200);
    const catalog = (await (await req('/api/catalog.json')).json()) as { agents: { name: string; scope: string[] }[] };
    expect(catalog.agents.find((a) => a.name === 'secret-hunter')?.scope).toEqual(['secret-exposure', 'committed-env']);
    const bad = await publish({ manifest: scoped.replace('version: 9.9.9', 'version: 9.9.10').replace('committed-env', 'Not Kebab'), files: FILES });
    expect(bad.status).toBe(422);
  });
});
