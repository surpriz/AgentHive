import { describe, expect, it, vi } from 'vitest';
import { RegistryClient, RegistryError, installSnippet, searchEntries } from './index.js';
import type { RegistryEntry, RegistryIndex } from './types.js';

const entry = (over: Partial<RegistryEntry>): RegistryEntry => ({
  name: 'x', version: '1.0.0', author: 'a', tagline: '', framework: 'MCP Server', category: 'DevOps', grade: 'AAA',
  successRate: 99, costPerRun: 0.001, tools: [], tags: [], capabilities: [], url: '', agentCard: '', install: '', ...over,
});

const index: RegistryIndex = {
  apiVersion: 'agenthive.sh/v0', generatedAt: '', count: 3,
  agents: [
    entry({ name: 'pg-query-optimizer', tags: ['sql', 'postgres'], tools: ['Postgres'], category: 'Data & Analytics', grade: 'AA' }),
    entry({ name: 'eu-ai-act-auditor', tags: ['compliance'], framework: 'LangGraph', category: 'Security & Audit' }),
    entry({ name: 'smart-contract-sentinel', tags: ['solidity', 'security'], framework: 'AutoGen', category: 'Security & Audit' }),
  ],
};

const fakeFetch = (routes: Record<string, unknown>, status = 200) =>
  vi.fn(async (url: string | URL | Request) => {
    const path = new URL(String(url)).pathname;
    const body = routes[path];
    if (body === undefined) return new Response('nope', { status: 404 });
    return typeof body === 'string'
      ? new Response(body, { status })
      : new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;

describe('searchEntries', () => {
  it('AND-combines terms and chips', () => {
    expect(searchEntries(index.agents, { query: 'SQL' }).map((a) => a.name)).toEqual(['pg-query-optimizer']);
    expect(searchEntries(index.agents, { category: 'Security & Audit', framework: 'AutoGen' }).map((a) => a.name)).toEqual(['smart-contract-sentinel']);
    expect(searchEntries(index.agents, { query: 'solidity compliance' })).toHaveLength(0);
    expect(searchEntries(index.agents, { limit: 2 })).toHaveLength(2);
  });
});

describe('RegistryClient', () => {
  it('fetches, caches the index and resolves cards', async () => {
    const f = fakeFetch({ '/api/agents.json': index, '/agents/pg-query-optimizer/agent.json': { name: 'pg-query-optimizer' } });
    const c = new RegistryClient({ baseUrl: 'https://reg.test/', fetch: f });
    expect(c.baseUrl).toBe('https://reg.test');
    expect((await c.search({ query: 'postgres' }))[0].name).toBe('pg-query-optimizer');
    expect((await c.get('eu-ai-act-auditor'))?.framework).toBe('LangGraph');
    expect(await c.get('nope')).toBeNull();
    expect((await c.card('pg-query-optimizer')).name).toBe('pg-query-optimizer');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('surfaces HTTP and network errors as RegistryError', async () => {
    const c = new RegistryClient({ baseUrl: 'https://reg.test', fetch: fakeFetch({}) });
    await expect(c.index()).rejects.toBeInstanceOf(RegistryError);
    const down = new RegistryClient({ baseUrl: 'https://reg.test', fetch: (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch });
    await expect(down.index()).rejects.toThrow(/unreachable/);
    await expect(c.card('Bad Name')).rejects.toThrow(/invalid agent name/);
  });
});

describe('installSnippet', () => {
  const e = entry({ name: 'pg-query-optimizer', author: 'dbforge', version: '3.0.4', tags: ['sql'], capabilities: ['explain.analyze'] });
  it('claude snippet is valid JSON pinned to author/name@version', () => {
    const parsed = JSON.parse(installSnippet(e, 'claude')) as { mcpServers: Record<string, { args: string[] }> };
    expect(parsed.mcpServers['pg-query-optimizer'].args).toContain('dbforge/pg-query-optimizer@3.0.4');
  });
  it('cursor and cli snippets mention the agent', () => {
    expect(installSnippet(e, 'cursor')).toContain('"pg-query-optimizer" agent via MCP');
    expect(installSnippet(e, 'cli')).toContain('agent-cli add pg-query-optimizer');
  });
});
