import type { AgentBricks, AgentSetting, Goal } from '../types';

/** What /agents/<name>/package.json serves for a declarative (v2) agent. */
export interface PackageDoc {
  name: string;
  version: string;
  author: string;
  apiVersion: 'v2';
  goal: Goal | null;
  license: string;
  value: string;
  tagline: string;
  settings: AgentSetting[];
  bricks: AgentBricks;
  /** path → text, as published. */
  files: Record<string, string>;
  sha256: string | null;
  publishedAt: string;
  url: string;
  layouts: Record<RetrievalTarget, Layout>;
}

export type RetrievalTarget = 'claude' | 'cursor';
export const RETRIEVAL_TARGETS: RetrievalTarget[] = ['claude', 'cursor'];
export const TARGET_LABEL: Record<RetrievalTarget, string> = { claude: 'Claude Code', cursor: 'Cursor' };

export interface FileWrite {
  path: string;
  content: string;
}

export interface McpWrite {
  name: string;
  entry: { command: string; args: string[]; env: Record<string, string> };
  /** Human-readable permissions, shown before anything is written. */
  permissions: { network: string[]; filesystem: 'none' | 'read' | 'write' };
  package: string;
}

export interface Layout {
  target: RetrievalTarget;
  /** Files to write, relative to the project root. */
  files: FileWrite[];
  /** MCP servers to merge into the target's config under `mcpServers`. */
  mcp: McpWrite[];
  mcpConfigPath: string;
}

type PackageInput = Pick<PackageDoc, 'name' | 'version' | 'author' | 'value' | 'settings' | 'bricks' | 'files'>;

const PLACEHOLDER_RE = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

/** Substitutes {{setting}} placeholders with defaults. Unknown placeholders stay as they are. */
export function renderPrompt(prompt: string, settings: AgentSetting[], values: Record<string, unknown> = {}): string {
  const map = new Map<string, string>();
  for (const s of settings) {
    const v = values[s.name] ?? s.default;
    if (v !== undefined) map.set(s.name, String(v));
  }
  return prompt.replace(PLACEHOLDER_RE, (whole, name: string) => (map.has(name) ? map.get(name)! : whole));
}

/** The MCP config entry a host needs for one brick. Env values are left empty for the user to fill in. */
export function mcpEntryFor(brick: AgentBricks['mcp'][number]): McpWrite {
  const env = Object.fromEntries(brick.env.map((v) => [v, '']));
  const npm = /^npm:(.+)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(brick.package);
  const pypi = /^pypi:(.+)==(.+)$/.exec(brick.package);
  const entry = npm
    ? { command: 'npx', args: ['-y', `${npm[1]}@${npm[2]}`, ...brick.args], env }
    : pypi
      ? { command: 'uvx', args: [`${pypi[1]}==${pypi[2]}`, ...brick.args], env }
      : { command: 'npx', args: ['-y', brick.package, ...brick.args], env };
  return { name: brick.name, entry, permissions: brick.permissions, package: brick.package };
}

const skillFiles = (pkg: PackageInput) => Object.entries(pkg.files).filter(([p]) => p.startsWith('skills/'));

function yamlString(s: string): string {
  return JSON.stringify(s);
}

/** Files and MCP entries that make the package run inside a given tool. Deterministic, no network. */
export function buildLayout(pkg: PackageInput, target: RetrievalTarget): Layout {
  const prompt = renderPrompt(pkg.files['prompt.md'] ?? '', pkg.settings);
  const skills = skillFiles(pkg);
  const header = `Retrieved from agenthive.sh/agents/${pkg.name} (${pkg.name}@${pkg.version} by ${pkg.author}).`;
  const mcp = pkg.bricks.mcp.map(mcpEntryFor);

  if (target === 'claude') {
    const files: FileWrite[] = skills.map(([path, content]) => ({ path: `.claude/${path}`, content }));
    const skillNote = pkg.bricks.skills.length ? `\n\n## Skills\n\nRead these before starting, they ship with the agent:\n${pkg.bricks.skills.map((s) => `- .claude/skills/${s}/SKILL.md`).join('\n')}\n` : '\n';
    const mcpNote = mcp.length ? `\n## Tools\n\nMCP servers configured in .mcp.json: ${mcp.map((m) => m.name).join(', ')}. Use them to read, never guess.\n` : '';
    files.unshift({
      path: `.claude/agents/${pkg.name}.md`,
      content: `---\nname: ${pkg.name}\ndescription: ${yamlString(pkg.value)}\n---\n<!-- ${header} -->\n\n${prompt.trim()}${skillNote}${mcpNote}`,
    });
    return { target, files, mcp, mcpConfigPath: '.mcp.json' };
  }

  // Cursor has no skill loader: the skills are inlined after the prompt.
  const inlined = skills.filter(([p]) => p.endsWith('/SKILL.md')).map(([p, c]) => `\n\n---\n\n## Skill: ${p.split('/')[1]}\n\n${c.replace(/^---[\s\S]*?---\n/, '').trim()}`).join('');
  const mcpNote = mcp.length ? `\n\n## Tools\n\nMCP servers configured in .cursor/mcp.json: ${mcp.map((m) => m.name).join(', ')}. Use them to read, never guess.\n` : '';
  return {
    target,
    files: [{ path: `.cursor/rules/${pkg.name}.mdc`, content: `---\ndescription: ${yamlString(pkg.value)}\nalwaysApply: false\n---\n<!-- ${header} -->\n\n${prompt.trim()}${inlined}${mcpNote}` }],
    mcp,
    mcpConfigPath: '.cursor/mcp.json',
  };
}

/** One prompt the user pastes into their tool. It points at the package URL and never embeds author text. */
export function copyPrompt(name: string, target: RetrievalTarget, origin: string): string {
  const url = `${origin}/agents/${name}/package.json`;
  const tool = TARGET_LABEL[target];
  return [
    `Install the AgentHive agent "${name}" into this project for ${tool}.`,
    `1. Fetch ${url} and read the JSON.`,
    `2. Write every file listed under layouts.${target}.files (path and content), creating folders as needed. Do not overwrite a file that already exists without asking me.`,
    `3. For each entry under layouts.${target}.mcp, add it to layouts.${target}.mcpConfigPath under "mcpServers" (create the file if missing, keep existing servers). Leave env values empty for me to fill in.`,
    `4. Show me the files you wrote and the permissions each MCP server declares (layouts.${target}.mcp[].permissions).`,
    'Do not run anything else.',
  ].join('\n');
}

export function cliPull(name: string, target: RetrievalTarget, cliSpec: string): string {
  return `npx -y -p ${cliSpec} agent-cli pull ${name} --target ${target}`;
}
