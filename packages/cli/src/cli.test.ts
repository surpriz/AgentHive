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
    expect(names).toEqual(['add', 'audit', 'benchmark', 'info', 'login', 'logout', 'manifest', 'push', 'run', 'runs', 'search', 'serve', 'setup', 'whoami']);
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
