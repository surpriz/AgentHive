import { describe, expect, it } from 'vitest';
import { parseRef } from './commands/add.js';
import { table, visibleLength } from './ui.js';
import { buildProgram } from './cli.js';

describe('parseRef', () => {
  it('accepts name, author/name and author/name@version', () => {
    expect(parseRef('pg-query-optimizer')).toEqual({ name: 'pg-query-optimizer', version: undefined });
    expect(parseRef('dbforge/pg-query-optimizer')).toEqual({ name: 'pg-query-optimizer', version: undefined });
    expect(parseRef('dbforge/pg-query-optimizer@3.0.4')).toEqual({ name: 'pg-query-optimizer', version: '3.0.4' });
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

describe('program', () => {
  it('registers the expected commands', () => {
    const names = buildProgram().commands.map((c) => c.name()).sort();
    expect(names).toEqual(['add', 'info', 'manifest', 'search', 'serve', 'setup']);
  });
});
