import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RegistryClient } from '@agenthive-sh/registry-client';
import type { RegistryIndex } from '@agenthive-sh/registry-client';
import { createServer } from './server.js';

const index: RegistryIndex = {
  apiVersion: 'agenthive.sh/v0', generatedAt: '', count: 2,
  agents: [
    { name: 'pg-query-optimizer', version: '3.0.4', author: 'dbforge', tagline: 'Tunes SQL.', framework: 'MCP Server', category: 'Data & Analytics', grade: 'AA', successRate: 97.2, costPerRun: 0.006, tools: ['Postgres'], tags: ['sql'], capabilities: ['explain.analyze'], url: 'https://reg.test/agents/pg-query-optimizer', agentCard: '', install: '' },
    { name: 'eu-ai-act-auditor', version: '1.8.0', author: 'lexgraph', tagline: 'Audits.', framework: 'LangGraph', category: 'Security & Audit', grade: 'AAA', successRate: 96.9, costPerRun: 0.041, tools: ['PDF Parser'], tags: ['compliance'], capabilities: ['classify.risk'], url: '', agentCard: '', install: '' },
  ],
};

const fetchStub = (async (url: string | URL | Request) => {
  const path = new URL(String(url)).pathname;
  if (path === '/api/agents.json') return new Response(JSON.stringify(index));
  if (path === '/agents/pg-query-optimizer/agent.json') return new Response(JSON.stringify({ name: 'pg-query-optimizer', skills: [] }));
  if (path === '/agents/pg-query-optimizer/agent.yaml') return new Response('apiVersion: agenthive.sh/v0\nkind: Agent\n');
  return new Response('not found', { status: 404 });
}) as unknown as typeof fetch;

async function connect() {
  const server = createServer(new RegistryClient({ baseUrl: 'https://reg.test', fetch: fetchStub }));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(b);
  return client;
}

const textOf = (r: Awaited<ReturnType<Client['callTool']>>) => (r.content as { type: string; text: string }[])[0].text;

describe('@agenthive-sh/mcp', () => {
  it('lists five tools and one resource', async () => {
    const c = await connect();
    expect((await c.listTools()).tools.map((t) => t.name).sort()).toEqual(['get_agent', 'get_leaderboard', 'get_manifest', 'install_snippet', 'search_agents']);
    expect((await c.listResources()).resources.map((r) => r.uri)).toEqual(['agenthive://registry']);
  });

  it('search_agents filters and formats', async () => {
    const c = await connect();
    const r = await c.callTool({ name: 'search_agents', arguments: { query: 'sql' } });
    expect(textOf(r)).toMatch(/^1 agent\(s\):/);
    expect(textOf(r)).toContain('pg-query-optimizer@3.0.4 by dbforge');
    const none = await c.callTool({ name: 'search_agents', arguments: { grade: 'B' } });
    expect(textOf(none)).toMatch(/^No agent matches/);
  });

  it('get_agent / get_manifest proxy the registry, unknown names error cleanly', async () => {
    const c = await connect();
    expect(JSON.parse(textOf(await c.callTool({ name: 'get_agent', arguments: { name: 'pg-query-optimizer' } }))).name).toBe('pg-query-optimizer');
    expect(textOf(await c.callTool({ name: 'get_manifest', arguments: { name: 'pg-query-optimizer' } }))).toContain('kind: Agent');
    const missing = await c.callTool({ name: 'get_agent', arguments: { name: 'nope' } });
    expect(missing.isError).toBe(true);
    expect(textOf(missing)).toContain('HTTP 404');
  });

  it('install_snippet returns a pinned mcpServers entry', async () => {
    const c = await connect();
    const r = await c.callTool({ name: 'install_snippet', arguments: { name: 'pg-query-optimizer' } });
    expect(JSON.parse(textOf(r)).mcpServers['pg-query-optimizer'].args).toContain('dbforge/pg-query-optimizer@3.0.4');
    const cursor = await c.callTool({ name: 'install_snippet', arguments: { name: 'eu-ai-act-auditor', target: 'cursor' } });
    expect(textOf(cursor)).toContain('.cursorrules — eu-ai-act-auditor');
  });

  it('resource exposes the raw index', async () => {
    const c = await connect();
    const r = await c.readResource({ uri: 'agenthive://registry' });
    expect(JSON.parse((r.contents[0] as { text: string }).text).count).toBe(2);
  });
});
