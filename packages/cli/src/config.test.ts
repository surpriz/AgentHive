import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mergeMcpServer, readConfig, targetPath, writeConfig } from './config.js';

describe('config', () => {
  it('resolves target paths', () => {
    expect(targetPath('claude', '/proj', '/home/u')).toBe('/home/u/.claude.json');
    expect(targetPath('claude-project', '/proj', '/home/u')).toBe('/proj/.mcp.json');
    expect(targetPath('cursor', '/proj', '/home/u')).toBe('/proj/.cursor/mcp.json');
  });

  it('merge keeps unrelated keys and other servers', () => {
    const base = { theme: 'dark', mcpServers: { other: { command: 'x' } } };
    const next = mergeMcpServer(base, 'pg', { command: 'npx', args: ['a'] });
    expect(next).toEqual({ theme: 'dark', mcpServers: { other: { command: 'x' }, pg: { command: 'npx', args: ['a'] } } });
    expect(base.mcpServers).not.toHaveProperty('pg');
    expect(mergeMcpServer({}, 'pg', { command: 'npx' }).mcpServers?.pg.command).toBe('npx');
  });

  it('round-trips through disk, tolerates missing and empty files, rejects non-objects', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'agenthive-'));
    const file = path.join(dir, 'nested', 'mcp.json');
    expect(await readConfig(file)).toEqual({});
    await writeConfig(file, mergeMcpServer({}, 'pg', { command: 'npx' }));
    expect((await readFile(file, 'utf8')).endsWith('}\n')).toBe(true);
    expect((await readConfig(file)).mcpServers?.pg.command).toBe('npx');
    await writeFile(file, '   ');
    expect(await readConfig(file)).toEqual({});
    await writeFile(file, '[1,2]');
    await expect(readConfig(file)).rejects.toThrow(/not a JSON object/);
  });
});
