import { describe, expect, it } from 'vitest';
import { parseRef } from './commands/add.js';
import { sanitize, table, visibleLength } from './ui.js';
import { buildProgram } from './cli.js';

describe('parseRef', () => {
  it('accepts name, author/name and author/name@version', () => {
    expect(parseRef('pg-query-optimizer')).toEqual({ name: 'pg-query-optimizer', author: undefined, version: undefined });
    expect(parseRef('dbforge/pg-query-optimizer')).toEqual({ name: 'pg-query-optimizer', author: 'dbforge', version: undefined });
    expect(parseRef('dbforge/pg-query-optimizer@3.0.4')).toEqual({ name: 'pg-query-optimizer', author: 'dbforge', version: '3.0.4' });
    expect(() => parseRef('Bad Name')).toThrow(/invalid agent reference/);
    expect(() => parseRef('a/b/c')).toThrow();
  });
});

describe('ui.table', () => {
  it('aligns columns ignoring ANSI codes', () => {
    const out = table([['\x1b[1mab\x1b[0m', 'x'], ['abcd', 'y']], ['N', 'V']);
    const lines = out.split('\n');
    expect(lines[0]).toBe('N     V');
    expect(lines[1]).toBe('────  ─');
    expect(visibleLength(lines[2])).toBe(visibleLength(lines[3]));
  });
});

describe('ui.sanitize', () => {
  it('strips ANSI escapes and control characters, keeps tabs and newlines', () => {
    expect(sanitize('ok\x1b[31mred\x1b[0m\x1b]0;title\x07\x00\x9b1m!')).toBe('okred!');
    expect(sanitize('\x1b]8;;https://evil\x1b\\link\x1b]8;;\x1b\\')).toBe('link');
    expect(sanitize('a\tb\nc')).toBe('a\tb\nc');
    expect(sanitize('\x1b[2J\x1b[H')).toBe('');
  });
});

describe('program', () => {
  it('registers the expected commands', () => {
    const names = buildProgram().commands.map((c) => c.name()).sort();
    expect(names).toEqual(['add', 'audit', 'benchmark', 'info', 'leaderboard', 'login', 'logout', 'manifest', 'pull', 'push', 'result', 'run', 'runs', 'search', 'setup', 'whoami']);
  });
});

describe('add author check', () => {
  it('refuses a reference whose author does not match the registry', async () => {
    const { registerAdd } = await import('./commands/add.js');
    const { Command } = await import('commander');
    const { RegistryClient } = await import('@agenthive-sh/registry-client');
    const index = { apiVersion: 'v0', generatedAt: '', count: 1, agents: [{ name: 'pg', version: '1.0.0', author: 'dbforge', tagline: '', framework: 'MCP Server', category: '', grade: 'AA', successRate: 1, costPerRun: 1, tools: [], tags: [], capabilities: [], url: '', agentCard: '', install: '' }] };
    const fetchStub = (async () => new Response(JSON.stringify(index))) as unknown as typeof fetch;
    const client = new RegistryClient({ baseUrl: 'https://reg.test', fetch: fetchStub });
    const program = new Command().exitOverride();
    registerAdd(program, () => client);
    await expect(program.parseAsync(['add', 'mallory/pg', '--print'], { from: 'user' })).rejects.toThrow(/published by "dbforge", not "mallory"/);
  });
});

describe('credentials', () => {
  it('resolves AGENTHIVE_TOKEN first, then the stored file for the same registry', async () => {
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const { credentialsPath, readCredentials, resolveToken, writeCredentials } = await import('./credentials.js');
    const dir = await mkdtemp(path.join(tmpdir(), 'ah-'));
    const file = credentialsPath({ XDG_CONFIG_HOME: dir }, dir);
    expect(file).toBe(path.join(dir, 'agenthive', 'credentials.json'));
    expect(await readCredentials(file)).toBeNull();
    await writeCredentials({ registry: 'https://r.test', token: 'ah_abc', login: 'me' }, file);
    expect((await readCredentials(file))?.login).toBe('me');
    expect(await resolveToken('https://r.test', {}, file)).toBe('ah_abc');
    expect(await resolveToken('https://other.test', {}, file)).toBeUndefined();
    expect(await resolveToken('https://other.test', { AGENTHIVE_TOKEN: 'env' }, file)).toBe('env');
  });
});

describe('pull', () => {
  it('writes the layout under the project directory, merges MCP config, and never escapes it', async () => {
    const { mkdtemp, readFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const { applyLayout, resolveUnder } = await import('./commands/pull.js');
    const dir = await mkdtemp(path.join(tmpdir(), 'ah-pull-'));
    const layout = {
      target: 'claude' as const,
      files: [{ path: '.claude/agents/x.md', content: '# x' }, { path: '.claude/skills/s/SKILL.md', content: '# s' }],
      mcp: [{ name: 'fs', entry: { command: 'npx', args: ['-y', 'a@1.0.0', '.'], env: { TOKEN: '' } }, permissions: { network: [], filesystem: 'read' as const }, package: 'npm:a@1.0.0' }],
      mcpConfigPath: '.mcp.json',
    };
    const first = await applyLayout(dir, layout);
    expect(first.written).toEqual(['.claude/agents/x.md', '.claude/skills/s/SKILL.md', '.mcp.json#fs']);
    expect(JSON.parse(await readFile(path.join(dir, '.mcp.json'), 'utf8')).mcpServers.fs.args).toContain('a@1.0.0');
    const second = await applyLayout(dir, layout);
    expect(second.written).toEqual([]);
    expect(second.skipped).toEqual(['.claude/agents/x.md', '.claude/skills/s/SKILL.md', '.mcp.json#fs']);
    expect(() => resolveUnder(dir, '../outside.md')).toThrow(/outside/);
  });

  it('writes Codex MCP servers as TOML tables and keeps what is already there', async () => {
    const { mkdtemp, mkdir, readFile, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const { applyLayout, upsertToml, mcpToml } = await import('./commands/pull.js');
    const dir = await mkdtemp(path.join(tmpdir(), 'ah-pull-codex-'));
    await mkdir(path.join(dir, '.codex'), { recursive: true });
    await writeFile(path.join(dir, '.codex', 'config.toml'), 'model = "o4-mini"\n\n[mcp_servers.other]\ncommand = "x"\nargs = []\n', 'utf8');
    const layout = {
      target: 'codex' as const,
      files: [{ path: '.agents/skills/x/SKILL.md', content: '# x' }],
      mcp: [{ name: 'fs', entry: { command: 'npx', args: ['-y', 'a@1.0.0', '.'], env: { TOKEN: '' } }, permissions: { network: [], filesystem: 'read' as const }, package: 'npm:a@1.0.0' }],
      mcpConfigPath: '.codex/config.toml',
    };
    const first = await applyLayout(dir, layout);
    expect(first.written).toEqual(['.agents/skills/x/SKILL.md', '.codex/config.toml#fs']);
    const toml = await readFile(path.join(dir, '.codex', 'config.toml'), 'utf8');
    expect(toml).toContain('model = "o4-mini"');
    expect(toml).toContain('[mcp_servers.other]');
    expect(toml).toContain('[mcp_servers.fs]\ncommand = "npx"\nargs = ["-y", "a@1.0.0", "."]\nenv = { TOKEN = "" }');
    const second = await applyLayout(dir, layout);
    expect(second.skipped).toEqual(['.agents/skills/x/SKILL.md', '.codex/config.toml#fs']);
    const forced = upsertToml(toml, 'fs', mcpToml('fs', { command: 'uvx', args: ['b==2'], env: {} }));
    expect(forced.existed).toBe(true);
    expect(forced.text).toContain('[mcp_servers.fs]\ncommand = "uvx"');
    expect(forced.text).not.toContain('a@1.0.0');
    expect(forced.text).toContain('[mcp_servers.other]');
    expect(() => mcpToml('fs]\n[evil', { command: 'x', args: [], env: {} })).toThrow(/invalid MCP server name/);
    expect(() => mcpToml('fs', { command: 'x', args: [], env: { 'A"\n[evil]': '' } })).toThrow(/invalid env key/);
  });
});
