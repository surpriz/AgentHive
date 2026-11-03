import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface AgentSetting {
  name: string;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'enum';
  default?: string | number | boolean;
}

export interface McpBrick {
  name: string;
  package: string;
  args: string[];
  env: string[];
  permissions: { network: string[]; filesystem: 'none' | 'read' | 'write' };
}

/** The parts of a v2 package the harness needs. Validation is the registry's job; this reader trusts the files. */
export interface LoadedPackage {
  dir: string;
  name: string;
  version: string;
  author: string;
  value: string;
  settings: AgentSetting[];
  bricks: { skills: string[]; mcp: McpBrick[] };
  io: { input: unknown; output: unknown };
  prompt: string;
  /** skill name → SKILL.md text, in the order the manifest lists them. */
  skills: Record<string, string>;
}

const PLACEHOLDER_RE = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

/** Same substitution as the registry's retrieval: defaults in, unknown placeholders left alone. */
export function renderPrompt(prompt: string, settings: AgentSetting[], values: Record<string, unknown> = {}): string {
  const map = new Map<string, string>();
  for (const s of settings) {
    const v = values[s.name] ?? s.default;
    if (v !== undefined) map.set(s.name, String(v));
  }
  return prompt.replace(PLACEHOLDER_RE, (whole, name: string) => (map.has(name) ? map.get(name)! : whole));
}

export async function loadPackage(dir: string): Promise<LoadedPackage> {
  const manifest = parseYaml(await readFile(path.join(dir, 'agent.yaml'), 'utf8')) as {
    apiVersion?: string;
    metadata?: { name: string; version: string; value?: string; author?: string };
    spec?: { settings?: AgentSetting[]; bricks?: { skills?: string[]; mcp?: McpBrick[] }; io?: { input: unknown; output: unknown } };
  };
  if (manifest.apiVersion !== 'agenthive.sh/v2' || !manifest.metadata || !manifest.spec) throw new Error(`${dir}/agent.yaml is not a v2 package`);
  const prompt = await readFile(path.join(dir, 'prompt.md'), 'utf8');
  const skillNames = manifest.spec.bricks?.skills ?? [];
  const skills: Record<string, string> = {};
  for (const name of skillNames) skills[name] = await readFile(path.join(dir, 'skills', name, 'SKILL.md'), 'utf8');
  return {
    dir,
    name: manifest.metadata.name,
    version: manifest.metadata.version,
    author: manifest.metadata.author ?? 'local',
    value: manifest.metadata.value ?? '',
    settings: manifest.spec.settings ?? [],
    bricks: { skills: skillNames, mcp: manifest.spec.bricks?.mcp ?? [] },
    io: manifest.spec.io ?? { input: { type: 'object' }, output: { type: 'object' } },
    prompt,
    skills,
  };
}

/** Lists package directories under `root`, sorted. */
export async function listPackages(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(root, e.name)).sort();
}

const stripFrontmatter = (md: string) => md.replace(/^---[\s\S]*?---\n/, '').trim();

/**
 * The system prompt for a run: the rendered prompt, then every skill inlined (the
 * loop has no on-demand skill loader, so this is what Claude Code would end up
 * reading), then the tool note. Deterministic for a given package and settings, so
 * it caches across runs.
 */
export function buildSystemPrompt(pkg: LoadedPackage, values: Record<string, unknown> = {}): string {
  const prompt = renderPrompt(pkg.prompt, pkg.settings, values).trim();
  const skills = pkg.bricks.skills.map((name) => `\n\n---\n\n## Skill: ${name}\n\n${stripFrontmatter(pkg.skills[name] ?? '')}`).join('');
  const tools = pkg.bricks.mcp.length
    ? `\n\n---\n\n## Tools\n\nMCP servers available as tools: ${pkg.bricks.mcp.map((m) => m.name).join(', ')}. Tool names are prefixed with the server name (for example \`${pkg.bricks.mcp[0].name}__list_directory\`). Use them to read, never guess. The project root is the current directory, \`.\`.`
    : '';
  return `${prompt}${skills}${tools}`;
}
