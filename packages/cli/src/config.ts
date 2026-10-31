import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export type Target = 'claude' | 'claude-project' | 'cursor';

export const TARGETS: Target[] = ['claude', 'claude-project', 'cursor'];

/** Where each target keeps its MCP server list. */
export function targetPath(target: Target, cwd = process.cwd(), home = homedir()): string {
  switch (target) {
    case 'claude':
      return path.join(home, '.claude.json');
    case 'claude-project':
      return path.join(cwd, '.mcp.json');
    case 'cursor':
      return path.join(cwd, '.cursor', 'mcp.json');
  }
}

export interface McpServerEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpConfig {
  mcpServers?: Record<string, McpServerEntry>;
  [k: string]: unknown;
}

/** Immutable merge: keeps every other key, upserts one server. */
export function mergeMcpServer(config: McpConfig, name: string, entry: McpServerEntry): McpConfig {
  return { ...config, mcpServers: { ...(config.mcpServers ?? {}), [name]: entry } };
}

export async function readConfig(file: string): Promise<McpConfig> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw e;
  }
  if (raw.trim() === '') return {};
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${file} is not a JSON object`);
  return parsed as McpConfig;
}

export async function writeConfig(file: string, config: McpConfig): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
