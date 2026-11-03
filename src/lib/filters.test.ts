import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, filterAgents, isFiltered } from './filters';
import { fixtureAgents as mockAgents } from '../test/fixtures';

describe('filterAgents', () => {
  it('returns everything with empty filters', () => {
    expect(filterAgents(mockAgents, EMPTY_FILTERS)).toHaveLength(mockAgents.length);
  });

  it('matches search terms case-insensitively across name, tags and tools', () => {
    expect(filterAgents(mockAgents, { ...EMPTY_FILTERS, query: 'SQL' }).map((a) => a.name)).toEqual(['pg-query-optimizer']);
    expect(filterAgents(mockAgents, { ...EMPTY_FILTERS, query: 'compliance' }).map((a) => a.name)).toEqual(['eu-ai-act-auditor']);
    expect(filterAgents(mockAgents, { ...EMPTY_FILTERS, query: 'github api' }).map((a) => a.name)).toEqual(['claude-code-reviewer']);
  });

  it('requires every term to match', () => {
    expect(filterAgents(mockAgents, { ...EMPTY_FILTERS, query: 'security solidity' }).map((a) => a.name)).toEqual(['smart-contract-sentinel']);
    expect(filterAgents(mockAgents, { ...EMPTY_FILTERS, query: 'security zzz' })).toHaveLength(0);
  });

  it('combines chip filters with AND', () => {
    const r = filterAgents(mockAgents, { ...EMPTY_FILTERS, category: 'Security & Audit', grade: 'AAA' });
    expect(r.map((a) => a.name).sort()).toEqual(['eu-ai-act-auditor', 'smart-contract-sentinel']);
    expect(filterAgents(mockAgents, { ...EMPTY_FILTERS, framework: 'MCP Server' })).toHaveLength(2);
    expect(filterAgents(mockAgents, { ...EMPTY_FILTERS, framework: 'CrewAI', grade: 'AAA' })).toHaveLength(0);
  });

  it('isFiltered detects any active filter', () => {
    expect(isFiltered(EMPTY_FILTERS)).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTERS, query: '  ' })).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTERS, grade: 'B' })).toBe(true);
  });
});
