import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, loadPackage, renderPrompt } from './package.js';
import { commandFor } from './mcp.js';
import { brickCommandLine } from './e2b.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const agents = path.resolve(here, '../../../agents');

describe('package', () => {
  it('loads a repository package with its skills and io', async () => {
    const pkg = await loadPackage(path.join(agents, 'vibe-app-security-triage'));
    expect(pkg.name).toBe('vibe-app-security-triage');
    expect(pkg.bricks.mcp.map((m) => m.name)).toEqual(['filesystem', 'git']);
    expect(Object.keys(pkg.skills)).toEqual(pkg.bricks.skills);
    expect((pkg.io.output as { required: string[] }).required).toEqual(['summary', 'findings']);
  });

  it('renders settings with defaults and leaves unknown placeholders', () => {
    expect(renderPrompt('a={{a}} b={{ b }} c={{c}}', [{ name: 'a', type: 'integer', default: 1 }, { name: 'b', type: 'string', default: 'x' }], { a: 2 })).toBe('a=2 b=x c={{c}}');
  });

  it('builds a deterministic system prompt with skills inlined and the tool note', async () => {
    const pkg = await loadPackage(path.join(agents, 'vibe-app-security-triage'));
    const a = buildSystemPrompt(pkg);
    const b = buildSystemPrompt(pkg);
    expect(a).toBe(b);
    expect(a).not.toContain('{{severity_floor}}');
    expect(a).toContain('## Skill: secret-patterns');
    expect(a).not.toContain('\n---\nname: secret-patterns');
    expect(a).toContain('filesystem__list_directory');
  });

  it('resolves bricks to pinned npx or uvx commands only', () => {
    expect(commandFor({ name: 'fs', package: 'npm:@modelcontextprotocol/server-filesystem@2.1.0', args: ['.'], env: [], permissions: { network: [], filesystem: 'read' } })).toEqual({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem@2.1.0', '.'] });
    expect(commandFor({ name: 'git', package: 'pypi:mcp-server-git==2026.10.28', args: [], env: [], permissions: { network: [], filesystem: 'read' } })).toEqual({ command: 'uvx', args: ['mcp-server-git==2026.10.28'] });
    expect(() => commandFor({ name: 'x', package: 'https://evil', args: [], env: [], permissions: { network: [], filesystem: 'none' } })).toThrow();
  });
});

describe('sandbox command lines', () => {
  it('quotes every argument and points uvx at the installer path', () => {
    expect(brickCommandLine({ name: 'fs', package: 'npm:@modelcontextprotocol/server-filesystem@2.1.0', args: ['.', "it's"], env: [], permissions: { network: [], filesystem: 'read' } })).toBe(`npx '-y' '@modelcontextprotocol/server-filesystem@2.1.0' '.' 'it'\\''s'`);
    expect(brickCommandLine({ name: 'git', package: 'pypi:mcp-server-git==2026.10.28', args: [], env: [], permissions: { network: [], filesystem: 'read' } })).toBe(`$HOME/.local/bin/uvx 'mcp-server-git==2026.10.28'`);
  });
});
