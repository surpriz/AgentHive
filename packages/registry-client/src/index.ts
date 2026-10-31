import type { AgentCard, InstallTarget, RegistryEntry, RegistryIndex, SearchOptions } from './types.js';

export * from './types.js';

export const DEFAULT_REGISTRY = 'https://agenthive.sh';

export class RegistryError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'RegistryError';
  }
}

export interface RegistryClientOptions {
  /** Base URL, no trailing slash. Env AGENTHIVE_REGISTRY overrides the default. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Cache TTL for the index, ms. 0 disables. */
  ttlMs?: number;
}

export class RegistryClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ttlMs: number;
  private indexCache: { at: number; value: RegistryIndex } | null = null;

  constructor(opts: RegistryClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.AGENTHIVE_REGISTRY ?? DEFAULT_REGISTRY).replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.ttlMs = opts.ttlMs ?? 60_000;
  }

  private async getJson<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: { accept: 'application/json' } });
    } catch (e) {
      throw new RegistryError(`registry unreachable at ${this.baseUrl}: ${(e as Error).message}`);
    }
    if (!res.ok) throw new RegistryError(`${path} → HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  private async getText(path: string): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`);
    } catch (e) {
      throw new RegistryError(`registry unreachable at ${this.baseUrl}: ${(e as Error).message}`);
    }
    if (!res.ok) throw new RegistryError(`${path} → HTTP ${res.status}`, res.status);
    return res.text();
  }

  async index(force = false): Promise<RegistryIndex> {
    const now = Date.now();
    if (!force && this.indexCache && now - this.indexCache.at < this.ttlMs) return this.indexCache.value;
    const value = await this.getJson<RegistryIndex>('/api/agents.json');
    this.indexCache = { at: now, value };
    return value;
  }

  async search(opts: SearchOptions = {}): Promise<RegistryEntry[]> {
    const { agents } = await this.index();
    return searchEntries(agents, opts);
  }

  async get(name: string): Promise<RegistryEntry | null> {
    const { agents } = await this.index();
    return agents.find((a) => a.name === name) ?? null;
  }

  async card(name: string): Promise<AgentCard> {
    assertName(name);
    return this.getJson<AgentCard>(`/agents/${name}/agent.json`);
  }

  async manifestYaml(name: string): Promise<string> {
    assertName(name);
    return this.getText(`/agents/${name}/agent.yaml`);
  }
}

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function assertName(name: string): void {
  if (!NAME_RE.test(name)) throw new RegistryError(`invalid agent name "${name}" (kebab-case expected)`);
}

/** Pure, same semantics as the web catalog: every term must match, chips are AND. */
export function searchEntries(agents: RegistryEntry[], opts: SearchOptions = {}): RegistryEntry[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  const out = agents.filter((a) => {
    if (opts.framework && a.framework !== opts.framework) return false;
    if (opts.category && a.category !== opts.category) return false;
    if (opts.grade && a.grade !== opts.grade) return false;
    if (terms.length === 0) return true;
    const hay = [a.name, a.tagline, a.author, a.category, a.framework, ...a.tools, ...a.tags].join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/** MCP server entry that Claude Code / Cursor need to run an agent from the registry. */
export function mcpServerEntry(entry: Pick<RegistryEntry, 'name' | 'author' | 'version'>) {
  return {
    command: 'npx',
    args: ['-y', '@agenthive/cli', 'serve', `${entry.author}/${entry.name}@${entry.version}`],
    env: { AGENTHIVE_TOKEN: '${AGENTHIVE_TOKEN}' },
  };
}

export function installSnippet(entry: Pick<RegistryEntry, 'name' | 'author' | 'version' | 'tags' | 'capabilities'>, target: InstallTarget): string {
  switch (target) {
    case 'claude':
      return JSON.stringify({ mcpServers: { [entry.name]: mcpServerEntry(entry) } }, null, 2);
    case 'cursor':
      return [
        `# .cursorrules — ${entry.name}`,
        `# Installed from agenthive.sh/${entry.author}/${entry.name}@${entry.version}`,
        '',
        `You have access to the "${entry.name}" agent via MCP.`,
        `Use it when the task involves: ${entry.tags.slice(0, 4).join(', ')}.`,
        `Capabilities: ${entry.capabilities.join(', ')}.`,
        'Always pass inputs matching its input schema and surface its structured output verbatim.',
        '',
      ].join('\n');
    case 'cli':
      return `agent-cli add ${entry.name}\nagent-cli add ${entry.author}/${entry.name}@${entry.version}`;
  }
}
