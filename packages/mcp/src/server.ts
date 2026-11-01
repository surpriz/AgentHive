import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RegistryClient, RegistryError, installSnippet } from '@agenthive-sh/registry-client';
import type { RegistryEntry } from '@agenthive-sh/registry-client';

const FRAMEWORKS = ['LangGraph', 'CrewAI', 'AutoGen', 'MCP Server', 'Custom A2A'] as const;
const GRADES = ['AAA', 'AA', 'A', 'B', 'pending'] as const;

const summary = (a: RegistryEntry) =>
  `${a.name}@${a.version} by ${a.author} · ${a.framework} · ${a.category} · grade ${a.grade} · ${a.successRate === null ? 'not benchmarked' : `${a.successRate}% success · $${a.costPerRun}/run`}\n  ${a.tagline}\n  tools: ${a.tools.join(', ')}\n  ${a.url}`;

const text = (s: string) => ({ content: [{ type: 'text' as const, text: s }] });
const fail = (e: unknown) => ({ content: [{ type: 'text' as const, text: e instanceof RegistryError ? e.message : String(e) }], isError: true });

export function createServer(client = new RegistryClient()): McpServer {
  const server = new McpServer({ name: 'agenthive', version: '0.1.0' });

  server.registerTool(
    'search_agents',
    {
      title: 'Search the AgentHive registry',
      description:
        'Find AI agents on agenthive.sh by keyword, framework, category or security grade. Returns name, version, framework, grade, benchmark and install hint. Use get_agent for full details.',
      inputSchema: {
        query: z.string().optional().describe('Free-text terms, all must match (name, tagline, tools, tags). Example: "sql postgres"'),
        framework: z.enum(FRAMEWORKS).optional(),
        category: z.string().optional().describe('Exact category, e.g. "Security & Audit"'),
        grade: z.enum(GRADES).optional().describe('Minimum-looking but exact security grade'),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async (args) => {
      try {
        const hits = await client.search(args);
        if (hits.length === 0) return text(`No agent matches ${JSON.stringify(args)} on ${client.baseUrl}.`);
        return text(`${hits.length} agent(s):\n\n${hits.map(summary).join('\n\n')}`);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_agent',
    {
      title: 'Get an agent card',
      description: 'Full A2A agent card for one agent: skills, tools, model, license, benchmark, input/output JSON schemas.',
      inputSchema: { name: z.string().describe('Agent name, kebab-case, e.g. "pg-query-optimizer"') },
    },
    async ({ name }) => {
      try {
        return text(JSON.stringify(await client.card(name), null, 2));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_manifest',
    {
      title: 'Get an agent manifest (YAML)',
      description: 'AgentHive manifest for one agent: transport, endpoint, capabilities, tools, security grade, A2A agent card URL.',
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      try {
        return text(await client.manifestYaml(name));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'install_snippet',
    {
      title: 'Install snippet for an agent',
      description:
        'Ready-to-paste config to install an agent: "claude" → mcpServers entry for ~/.claude.json or .mcp.json, "cursor" → .cursorrules block, "cli" → agent-cli commands.',
      inputSchema: {
        name: z.string(),
        target: z.enum(['claude', 'cursor', 'cli']).default('claude'),
      },
    },
    async ({ name, target }) => {
      try {
        const entry = await client.get(name);
        if (!entry) return text(`No agent named "${name}" on ${client.baseUrl}.`);
        return text(installSnippet(entry, target));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerResource(
    'registry-index',
    'agenthive://registry',
    { title: 'AgentHive registry index', description: 'Every agent in the registry, JSON.', mimeType: 'application/json' },
    async (uri) => {
      const idx = await client.index();
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(idx, null, 2) }] };
    },
  );

  return server;
}
