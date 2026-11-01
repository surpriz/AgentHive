import { describe, expect, it } from 'vitest';
import { parseManifest, type Manifest } from '../manifest';
import { runAudit, type AuditContext } from './index';
import { findSecrets } from './checks/secrets';
import { isForbiddenAddress, isForbiddenHostname } from './checks/endpoint';
import { depsFromPackageJson, depsFromPyproject, depsFromRequirements, parseGithubSource, REF_RE, PATH_RE } from './checks/dependencies';
import { readCapped } from './net';
import { gradeOf, scoreOf } from './grade';

const base = (spec: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): Manifest => {
  const r = parseManifest({
    apiVersion: 'agenthive.sh/v1',
    metadata: { name: 'x-bot', version: '1.0.0', category: 'DevOps', value: 'Does something useful for devops teams.', tagline: 'A longer technical description here.', tags: ['x'], license: 'MIT' },
    spec: { framework: 'LangGraph', tools: ['T'], capabilities: ['a.b'], io: { input: { type: 'object' }, output: { type: 'object' } }, ...spec },
    readme: 'r'.repeat(250),
    useCases: ['u'],
    ...extra,
  });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.manifest;
};

type FakeRoute = (url: string, init?: RequestInit) => Response | Promise<Response> | Error;
function ctx(routes: Record<string, FakeRoute> = {}, lookup: AuditContext['lookup'] = async () => [{ address: '93.184.216.34', family: 4 }]): AuditContext {
  let t = 1_000_000;
  return {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const key = Object.keys(routes).find((k) => url.startsWith(k));
      if (!key) return new Response('not found', { status: 404 });
      const r = await routes[key](url, init);
      if (r instanceof Error) throw r;
      return r;
    }) as typeof fetch,
    lookup,
    callTimeoutMs: 1000,
    deadline: t + 8000,
    now: () => (t += 1),
  };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('grading', () => {
  it('scores and caps', () => {
    expect(scoreOf([])).toBe(100);
    expect(scoreOf([{ check: 'secrets', severity: 'high', message: '' }, { check: 'secrets', severity: 'low', message: '' }])).toBe(72);
    expect(gradeOf(100, [])).toBe('AAA');
    expect(gradeOf(100, [{ grade: 'AA' }])).toBe('AA');
    expect(gradeOf(80, [{ grade: 'A' }, { grade: 'AA' }])).toBe('A');
    expect(gradeOf(10, [])).toBe('B');
  });
});

describe('secrets', () => {
  it('catches real-looking credentials and ignores prose', () => {
    expect(findSecrets('key AKIAIOSFODNN7EXAMPLE here').map((f) => f.message)).toEqual(['AWS access key id found in the manifest']);
    expect(findSecrets('ghp_' + 'a'.repeat(36)).length).toBe(1);
    expect(findSecrets('sk-ant-' + 'b'.repeat(40)).length).toBeGreaterThan(0);
    expect(findSecrets('https://user:hunter2@db.example.com/x').length).toBe(1);
    expect(findSecrets('-----BEGIN RSA PRIVATE KEY-----').length).toBe(1);
    expect(findSecrets('set OPENAI_API_KEY (starts with sk-) in your env; see https://example.com/docs')).toEqual([]);
  });
});

describe('endpoint address rules', () => {
  it('flags private, loopback, link-local, metadata and ipv6 equivalents', () => {
    for (const a of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.5', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1', '::ffff:7f00:1', '64:ff9b::7f00:1', '2002:7f00:1::1', 'not-an-ip']) expect(isForbiddenAddress(a), a).toBe(true);
    for (const a of ['93.184.216.34', '8.8.8.8', '2606:4700::1111', '172.32.0.1', '::ffff:93.184.216.34']) expect(isForbiddenAddress(a), a).toBe(false);
    expect(isForbiddenHostname('localhost')).toBe(true);
    expect(isForbiddenHostname('metadata.google.internal')).toBe(true);
    expect(isForbiddenHostname('agents.example.com')).toBe(false);
  });
});

describe('dependency parsing', () => {
  it('keeps exact pins only', () => {
    expect(depsFromPackageJson('{"dependencies":{"a":"1.2.3","b":"^2.0.0","c":"v3.0.0-rc.1"}}')).toEqual({
      deps: [
        { ecosystem: 'npm', name: 'a', version: '1.2.3' },
        { ecosystem: 'npm', name: 'c', version: '3.0.0-rc.1' },
      ],
      unpinned: 1,
    });
    expect(depsFromPackageJson('{oops').parseError).toMatch(/package.json/);
    expect(depsFromRequirements('Requests==2.31.0  # http\nflask>=2\n-r base.txt\nnumpy[extra]==1.26.4')).toEqual({
      deps: [
        { ecosystem: 'PyPI', name: 'requests', version: '2.31.0' },
        { ecosystem: 'PyPI', name: 'numpy', version: '1.26.4' },
      ],
      unpinned: 1,
    });
    expect(depsFromPyproject('[project]\nname = "x"\ndependencies = [\n  "httpx==0.27.0",\n  "pydantic>=2",\n  "rich==13.7.0; python_version < \'4\'",\n]\n[tool.poetry.dependencies]\npython = "^3.11"\nrequests = "2.31.0"\nflask = { version = "^3" }\n')).toEqual({
      deps: [
        { ecosystem: 'PyPI', name: 'httpx', version: '0.27.0' },
        { ecosystem: 'PyPI', name: 'rich', version: '13.7.0' },
        { ecosystem: 'PyPI', name: 'requests', version: '2.31.0' },
      ],
      unpinned: 2,
    });
    // A dependencies array hidden inside another table is not [project].dependencies.
    expect(depsFromPyproject('[tool.other]\ndependencies = ["evil==1.0.0"]\n[project]\ndependencies = []\n')).toEqual({ deps: [], unpinned: 0 });
    expect(depsFromPyproject('[project\n').parseError).toMatch(/pyproject/);
    expect(parseGithubSource('https://github.com/acme/bot.git')).toEqual({ owner: 'acme', name: 'bot' });
    expect(parseGithubSource('https://gitlab.com/acme/bot')).toBeNull();
    expect(REF_RE.test('v1.2.3')).toBe(true);
    expect(REF_RE.test('release/2026-11')).toBe(true);
    expect(REF_RE.test('../../etc')).toBe(false);
    expect(REF_RE.test('a?b=c')).toBe(false);
    expect(PATH_RE.test('packages/agent')).toBe(true);
    expect(PATH_RE.test('../x')).toBe(false);
  });

  it('caps bodies', async () => {
    expect(await readCapped(new Response('ok'), 10)).toBe('ok');
    await expect(readCapped(new Response('x'.repeat(20)), 10)).rejects.toThrow(/larger/);
  });
});

describe('runAudit', () => {
  it('minimal honest manifest lands at A with caps for permissions and source', async () => {
    const r = await runAudit(base(), ctx());
    expect(r.blocked).toBe(false);
    expect(r.grade).toBe('A');
    expect(r.caps.map((c) => c.grade).sort()).toEqual(['A', 'AA']);
    expect(r.checks.find((c) => c.id === 'endpoint')?.status).toBe('skipped');
  });

  it('blocks on a secret', async () => {
    const r = await runAudit(base({}, { readme: 'token ghp_' + 'z'.repeat(36) + ' '.repeat(200) }), ctx());
    expect(r.blocked).toBe(true);
    expect(r.findings[0].severity).toBe('blocker');
  });

  it('blocks an endpoint resolving to a private address and grades a healthy one', async () => {
    const m = base({ endpoint: 'https://agents.example.com/run', permissions: { network: ['api.github.com'], filesystem: 'read', shell: false, env: [] } });
    const priv = await runAudit(m, ctx({}, async () => [{ address: '10.1.2.3', family: 4 }]));
    expect(priv.blocked).toBe(true);
    const healthy = await runAudit(m, ctx({ 'https://agents.example.com/run': () => json({ ok: true }), 'https://agents.example.com/.well-known/agent.json': () => json({ name: 'x' }) }));
    expect(healthy.findings.filter((f) => f.check === 'endpoint')).toEqual([]);
    expect(healthy.grade).toBe('AA'); // permissions declared, still capped: no source
    const down = await runAudit(m, ctx({ 'https://agents.example.com/run': () => new Error('connect ECONNREFUSED') }));
    expect(down.findings.find((f) => f.check === 'endpoint')?.severity).toBe('high');
  });

  it('reaches AAA with permissions, source and clean dependencies; drops on a vulnerability', async () => {
    const m = base({
      permissions: { network: ['api.github.com'], filesystem: 'none', shell: false, env: ['GITHUB_TOKEN'] },
      source: { repo: 'https://github.com/acme/bot', ref: 'v1.0.0' },
    });
    const clean = await runAudit(
      m,
      ctx({
        'https://raw.githubusercontent.com/acme/bot/v1.0.0/package.json': () => new Response('{"dependencies":{"left-pad":"1.3.0"}}'),
        'https://api.osv.dev/v1/querybatch': () => json({ results: [{}] }),
      }),
    );
    expect(clean.grade).toBe('AAA');
    expect(clean.caps).toEqual([]);
    const vuln = await runAudit(
      m,
      ctx({
        'https://raw.githubusercontent.com/acme/bot/v1.0.0/package.json': () => new Response('{"dependencies":{"lodash":"4.17.20"}}'),
        'https://api.osv.dev/v1/querybatch': () => json({ results: [{ vulns: [{ id: 'GHSA-xxxx', summary: 'prototype pollution', database_specific: { severity: 'HIGH' } }] }] }),
      }),
    );
    expect(vuln.grade).toBe('AA');
    expect(vuln.findings[0]).toMatchObject({ check: 'dependencies', severity: 'high' });
    const osvDown = await runAudit(m, ctx({ 'https://raw.githubusercontent.com/acme/bot/v1.0.0/package.json': () => new Response('{"dependencies":{"a":"1.0.0"}}'), 'https://api.osv.dev/v1/querybatch': () => new Error('boom') }));
    expect(osvDown.checks.find((c) => c.id === 'dependencies')?.status).toBe('skipped');
    expect(osvDown.grade).toBe('AA');
  });

  it('never fails open: unverified network checks cap the grade', async () => {
    const full = { permissions: { network: ['api.github.com'], filesystem: 'none', shell: false, env: [] }, source: { repo: 'https://github.com/acme/bot', ref: 'v1.0.0' } };
    const m = base({ endpoint: 'https://agents.example.com/run', ...full });
    const dnsDown = await runAudit(m, ctx({}, async () => { throw new Error('dns exploded'); }));
    expect(dnsDown.findings.find((f) => f.check === 'endpoint')?.severity).toBe('high');
    expect(dnsDown.caps.map((c) => c.reason)).toContain('endpoint could not be verified');
    const late = ctx();
    late.deadline = 0;
    const budget = await runAudit(m, late);
    expect(budget.checks.find((c) => c.id === 'endpoint')?.status).toBe('skipped');
    expect(budget.grade).toBe('AA');
    expect(budget.caps.length).toBeGreaterThanOrEqual(2);
    const badRef = await runAudit(base({ ...full, source: { repo: 'https://github.com/acme/bot', ref: '../../x' } }), ctx());
    expect(badRef.caps.map((c) => c.reason)).toContain('dependencies not checked');
    const redirecting = await runAudit(m, ctx({ 'https://agents.example.com/run': () => new Response('', { status: 302, headers: { location: 'http://10.0.0.1/' } }) }));
    expect(redirecting.caps.map((c) => c.reason)).toContain('endpoint could not be verified');
    const noPins = await runAudit(base(full), ctx({ 'https://raw.githubusercontent.com/acme/bot/v1.0.0/package.json': () => new Response('{"dependencies":{"a":"^1"}}') }));
    expect(noPins.grade).toBe('AA');
    // One pinned and checked, seven ranges ignored: still capped, with the count in the report.
    const mixed = await runAudit(
      base(full),
      ctx({
        'https://raw.githubusercontent.com/acme/bot/v1.0.0/package.json': () => new Response(JSON.stringify({ dependencies: { a: '1.0.0', b: '^1', c: '~2', d: '*', e: 'latest', f: '>=1', g: '1.x', h: 'github:x/y' } })),
        'https://api.osv.dev/v1/querybatch': () => json({ results: [{}] }),
      }),
    );
    expect(mixed.grade).toBe('AA');
    expect(mixed.findings.find((f) => f.check === 'dependencies')?.message).toMatch(/7 declared dependencies are not pinned/);
  });

  it('runs network checks concurrently so a slow endpoint cannot starve the dependency check', async () => {
    const full = { permissions: { network: ['api.github.com'], filesystem: 'none', shell: false, env: [] }, source: { repo: 'https://github.com/acme/bot', ref: 'v1.0.0' } };
    const m = base({ endpoint: 'https://slow.example.com/run', ...full });
    const c = ctx({
      'https://slow.example.com/run': () => new Promise<Response>(() => undefined), // never answers
      'https://raw.githubusercontent.com/acme/bot/v1.0.0/package.json': () => new Response('{"dependencies":{"left-pad":"1.3.0"}}'),
      'https://api.osv.dev/v1/querybatch': () => json({ results: [{}] }),
    });
    c.callTimeoutMs = 50;
    const r = await runAudit(m, c);
    expect(r.checks.find((x) => x.id === 'dependencies')?.status).toBe('ok');
    expect(r.caps.map((x) => x.reason)).toContain('endpoint could not be verified');
    expect(r.caps.map((x) => x.reason)).not.toContain('dependencies not checked');
  });
});
