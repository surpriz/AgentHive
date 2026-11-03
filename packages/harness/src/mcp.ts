import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpBrick } from './package.js';

/** A tool as the model sees it. `input_schema` is the MCP schema passed through. */
export interface HarnessTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  call(input: Record<string, unknown>): Promise<{ text: string; isError: boolean }>;
}

export interface ToolSet {
  tools: HarnessTool[];
  close(): Promise<void>;
}

/** How a brick's process is started. The local host spawns it here; the sandbox host will spawn it in the sandbox. */
export interface ToolHost {
  transportFor(brick: McpBrick, cwd: string): Transport;
}

/** The command a brick resolves to: pinned npm or PyPI package, nothing else. Mirrors the registry's `mcpEntryFor`. */
export function commandFor(brick: McpBrick): { command: string; args: string[] } {
  const npm = /^npm:(.+)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(brick.package);
  const pypi = /^pypi:(.+)==(.+)$/.exec(brick.package);
  if (npm) return { command: 'npx', args: ['-y', `${npm[1]}@${npm[2]}`, ...brick.args] };
  if (pypi) return { command: 'uvx', args: [`${pypi[1]}==${pypi[2]}`, ...brick.args] };
  throw new Error(`unsupported brick package: ${brick.package}`);
}

/** Runs bricks as child processes of the harness, in the task directory. For local runs and tests only. */
export const localHost: ToolHost = {
  transportFor(brick, cwd) {
    const { command, args } = commandFor(brick);
    // The SDK's default environment is a safe subset (PATH, HOME, ...): no key from the harness leaks into the brick.
    return new StdioClientTransport({ command, args, cwd, stderr: 'pipe' });
  },
};

const MAX_RESULT_CHARS = 40_000;

/** Starts every brick, lists its tools and exposes them under `brick__tool` names. */
export async function startBricks(bricks: McpBrick[], cwd: string, host: ToolHost = localHost): Promise<ToolSet> {
  const clients: Client[] = [];
  const tools: HarnessTool[] = [];
  try {
    for (const brick of bricks) {
      const client = new Client({ name: 'agenthive-harness', version: '0.1.0' });
      await client.connect(host.transportFor(brick, cwd));
      clients.push(client);
      const listed = await client.listTools();
      for (const t of listed.tools) {
        tools.push({
          name: `${brick.name}__${t.name}`,
          description: t.description ?? '',
          input_schema: t.inputSchema as Record<string, unknown>,
          call: async (input) => {
            const res = await client.callTool({ name: t.name, arguments: input });
            const content = Array.isArray(res.content) ? (res.content as { type: string; text?: string }[]) : [];
            const text = content.map((c) => (c.type === 'text' ? (c.text ?? '') : `[${c.type} content omitted]`)).join('\n');
            return { text: text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n[truncated at ${MAX_RESULT_CHARS} characters]` : text, isError: Boolean(res.isError) };
          },
        });
      }
    }
  } catch (err) {
    await Promise.allSettled(clients.map((c) => c.close()));
    throw err;
  }
  return {
    tools,
    close: async () => {
      await Promise.allSettled(clients.map((c) => c.close()));
    },
  };
}
