// End-to-end: spawn the built stdio server against a registry and call every tool.
// Usage: AGENTHIVE_REGISTRY=http://localhost:5173 node scripts/smoke.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'bin.js');
const transport = new StdioClientTransport({ command: process.execPath, args: [bin], env: { ...process.env } });
const client = new Client({ name: 'smoke', version: '0' });
await client.connect(transport);

const text = (r) => r.content[0].text;
console.log('tools:', (await client.listTools()).tools.map((t) => t.name).join(', '));
console.log('search sql →', text(await client.callTool({ name: 'search_agents', arguments: { query: 'sql' } })).split('\n')[1]);
console.log('search AAA security →', text(await client.callTool({ name: 'search_agents', arguments: { grade: 'AAA', category: 'Security & Audit' } })).split('\n')[0]);
console.log('get_agent →', JSON.parse(text(await client.callTool({ name: 'get_agent', arguments: { name: 'pg-query-optimizer' } }))).skills.length, 'skills');
console.log('get_manifest →', text(await client.callTool({ name: 'get_manifest', arguments: { name: 'pg-query-optimizer' } })).split('\n')[1]);
console.log('install_snippet →', JSON.parse(text(await client.callTool({ name: 'install_snippet', arguments: { name: 'pg-query-optimizer' } }))).mcpServers['pg-query-optimizer'].args.at(-1));
const bad = await client.callTool({ name: 'get_agent', arguments: { name: 'nope' } });
console.log('unknown →', bad.isError, text(bad));
await client.close();
