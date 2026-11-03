import { describe, expect, it } from 'vitest';
import { compareSemver, parseManifest } from './manifest';

describe('parseManifest', () => {
  it('strips server-owned blocks and applies defaults', () => {
    const r = parseManifest({
      apiVersion: 'agenthive.sh/v1',
      metadata: { name: 'x-bot', version: '1.0.0', category: 'Finance', value: 'Does something useful for finance teams.', tagline: 'A longer technical description.' },
      spec: { framework: 'CrewAI' },
      security: { grade: 'AAA' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.manifest.spec.transport).toBe('a2a/http+json');
    expect(r.manifest.metadata.license).toBe('UNLICENSED');
    expect('security' in r.manifest).toBe(false);
  });

  it('rejects non-https endpoints and bad yaml', () => {
    const r = parseManifest({ apiVersion: 'agenthive.sh/v1', metadata: { name: 'x-bot', version: '1.0.0', category: 'Finance', value: 'Does something useful for finance teams.', tagline: 'A longer technical description.' }, spec: { framework: 'CrewAI', endpoint: 'http://evil.example' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].path).toBe('spec.endpoint');
    expect(parseManifest('a: [').ok).toBe(false);
    expect(parseManifest('- not a mapping').ok).toBe(false);
  });

  it('refuses NUL characters anywhere in the document', () => {
    const r = parseManifest({ apiVersion: 'agenthive.sh/v1', metadata: { name: 'x-bot', version: '1.0.0', category: 'Finance', value: 'Does something useful for finance teams.', tagline: 'A longer technical description.' }, spec: { framework: 'CrewAI' }, readme: 'bad\u0000byte' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].message).toMatch(/NUL/);
  });

  it('caps the size of the document and of inline schemas', () => {
    expect(parseManifest('x'.repeat(300 * 1024)).ok).toBe(false);
    const big = JSON.stringify({ apiVersion: 'agenthive.sh/v1', metadata: { name: 'x-bot', version: '1.0.0', category: 'Finance', value: 'Does something useful for finance teams.', tagline: 'A longer technical description.' }, spec: { framework: 'CrewAI', io: { input: { blob: 'y'.repeat(40 * 1024) }, output: {} } } });
    const r = parseManifest(big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].path).toBe('spec.io.input');
    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) deep = { n: deep };
    const d = parseManifest({ apiVersion: 'agenthive.sh/v1', metadata: { name: 'x-bot', version: '1.0.0', category: 'Finance', value: 'Does something useful for finance teams.', tagline: 'A longer technical description.' }, spec: { framework: 'CrewAI', io: { input: deep, output: {} } } });
    expect(d.ok).toBe(false);
  });
});

describe('compareSemver', () => {
  it('orders releases and pre-releases', () => {
    expect(compareSemver('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
  });
});

describe('v2 manifests and packages', () => {
  const v2 = {
    apiVersion: 'agenthive.sh/v2',
    metadata: { name: 'x-audit', version: '1.0.0', goal: 'code-audit', value: 'Finds leaked secrets in a vibe-coded app.', tagline: 'Walks the repository and reports every credential with file and line.' },
    spec: {
      settings: [{ name: 'max_findings', type: 'integer', min: 1, max: 50, default: 10 }],
      bricks: { skills: ['secret-patterns'], mcp: [{ name: 'fs', package: 'npm:@modelcontextprotocol/server-filesystem@2.1.0', permissions: { filesystem: 'read' } }] },
    },
  };

  it('parses a declarative manifest with defaults', async () => {
    const { parseManifest: parse } = await import('./manifest');
    const r = parse(v2);
    expect(r.ok).toBe(true);
    if (r.ok && r.manifest.apiVersion === 'agenthive.sh/v2') {
      expect(r.manifest.spec.bricks.mcp[0].args).toEqual([]);
      expect(r.manifest.spec.bricks.mcp[0].permissions.network).toEqual([]);
      expect(r.manifest.spec.model.recommended).toEqual([]);
    }
  });

  it('rejects unpinned bricks, bad settings and v1 fields', async () => {
    const { parseManifest: parse } = await import('./manifest');
    const unpinned = parse({ ...v2, spec: { ...v2.spec, bricks: { skills: [], mcp: [{ name: 'fs', package: 'npm:@modelcontextprotocol/server-filesystem', permissions: {} }] } } });
    expect(unpinned.ok).toBe(false);
    if (!unpinned.ok) expect(unpinned.issues[0].path).toBe('spec.bricks.mcp.0.package');
    const badEnum = parse({ ...v2, spec: { ...v2.spec, settings: [{ name: 'mode', type: 'enum', values: ['a'], default: 'b' }] } });
    expect(badEnum.ok).toBe(false);
    const badGoal = parse({ ...v2, metadata: { ...v2.metadata, goal: 'world-peace' } });
    expect(badGoal.ok).toBe(false);
  });

  it('validates package files against the manifest', async () => {
    const { parseManifest: parse, validatePackageFiles, renderPrompt } = await import('./manifest');
    const r = parse(v2);
    if (!r.ok || r.manifest.apiVersion !== 'agenthive.sh/v2') throw new Error('expected v2');
    const m = r.manifest;
    const good = { 'prompt.md': 'Audit the repository and report at most {{max_findings}} findings, each with file and line.', 'skills/secret-patterns/SKILL.md': '# s', 'examples/a.json': '{"path":"."}' };
    expect(validatePackageFiles(m, good)).toEqual([]);
    expect(validatePackageFiles(m, { ...good, 'bin/x': 'y' }).map((i) => i.path)).toContain('files.bin/x');
    expect(validatePackageFiles(m, { ...good, 'skills/other/SKILL.md': '# o' }).map((i) => i.message)).toContainEqual(expect.stringMatching(/not declared/));
    expect(validatePackageFiles(m, { ...good, 'examples/a.json': '{' }).map((i) => i.path)).toContain('files.examples/a.json');
    expect(validatePackageFiles(m, { 'skills/secret-patterns/SKILL.md': '# s' }).map((i) => i.path)).toContain('files.prompt.md');
    expect(validatePackageFiles(m, { ...good, 'prompt.md': good['prompt.md'] + ' {{ghost}}' }).map((i) => i.message)).toContainEqual(expect.stringMatching(/\{\{ghost\}\}/));
    expect(renderPrompt(good['prompt.md'], m.spec.settings)).toContain('at most 10 findings');
    expect(renderPrompt(good['prompt.md'], m.spec.settings, { max_findings: 3 })).toContain('at most 3 findings');
  });
});
