import type { AgentCard, AuditReport, AuditResponse, BenchmarkReport, BenchmarkResponse, InstallTarget, Leaderboard, ManifestIssue, Me, PublishResponse, RegistryEntry, RegistryIndex, RunLog, RunResult, SearchOptions } from './types.js';

export * from './types.js';

export const DEFAULT_REGISTRY = 'https://agenthive.sh';

/** Pinned package specs for generated install snippets: an unpinned npx would pick up any later (or squatted) release. */
export const CLI_PACKAGE_SPEC = '@agenthive-sh/cli@0.4.0';
export const MCP_PACKAGE_SPEC = '@agenthive-sh/mcp@0.4.0';

export class RegistryError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    /** Field-level problems for a 422 on publish. */
    public readonly issues?: ManifestIssue[],
    /** The audit report when a publish was refused by a blocker finding. */
    public readonly audit?: AuditReport,
  ) {
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
  /** API key for authenticated calls (me, publish). Env AGENTHIVE_TOKEN is the usual source. */
  token?: string;
}

export class RegistryClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ttlMs: number;
  private indexCache: { at: number; value: RegistryIndex } | null = null;
  private readonly token?: string;

  constructor(opts: RegistryClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.AGENTHIVE_REGISTRY ?? DEFAULT_REGISTRY).replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.ttlMs = opts.ttlMs ?? 60_000;
    this.token = opts.token;
  }

  private authHeaders(): Record<string, string> {
    if (!this.token) throw new RegistryError('not logged in: run `agent-cli login` or set AGENTHIVE_TOKEN', 401);
    return { authorization: `Bearer ${this.token}` };
  }

  /** Who the configured token belongs to. */
  async me(): Promise<Me> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/me`, { headers: { accept: 'application/json', ...this.authHeaders() } });
    if (!res.ok) throw new RegistryError(res.status === 401 ? 'invalid or revoked API key' : `registry returned ${res.status}`, res.status);
    return (await res.json()) as Me;
  }

  /**
   * Call an agent through the gateway. The input is sent verbatim to the author's endpoint;
   * the registry signs it, logs it and enforces quotas. Non-2xx upstream answers resolve too
   * (status carries the upstream code); gateway refusals throw RegistryError.
   */
  async run<T = unknown>(name: string, input: unknown): Promise<RunResult<T>> {
    assertName(name);
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/run/${name}`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(input),
    });
    const text = await res.text();
    const runId = res.headers.get('x-agenthive-run-id') ?? '';
    const latencyMs = Number(res.headers.get('x-agenthive-latency-ms') ?? 0);
    let output: unknown = text;
    try {
      output = JSON.parse(text);
    } catch {
      /* upstream body stays raw */
    }
    if (!runId || res.status === 401 || res.status === 404 || res.status === 409 || res.status === 413 || res.status === 429 || res.status === 400) {
      const err = (output as { error?: string } | null)?.error ?? `gateway returned ${res.status}`;
      throw new RegistryError(err, res.status);
    }
    if (res.status === 502 || res.status === 504) throw new RegistryError(`${(output as { error?: string }).error ?? 'upstream failed'} (run ${runId})`, res.status);
    return { runId, status: res.status, latencyMs, output: output as T };
  }

  /** Runs you made (no name) or runs received by an agent you own. */
  async runs(name?: string): Promise<RunLog[]> {
    if (name) assertName(name);
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/${name ? `agents/${name}/runs` : 'runs'}`, { headers: { accept: 'application/json', ...this.authHeaders() } });
    const body = (await res.json().catch(() => ({}))) as { error?: string; runs?: RunLog[] };
    if (!res.ok || !body.runs) throw new RegistryError(body.error ?? `registry returned ${res.status}`, res.status);
    return body.runs;
  }

  /** Public leaderboard, optionally one category. */
  async leaderboard(category?: string): Promise<Leaderboard> {
    return this.getJson<Leaderboard>(`/api/leaderboard.json${category ? `?category=${encodeURIComponent(category)}` : ''}`);
  }

  /** Latest public benchmark for an agent. */
  async benchmark(name: string): Promise<BenchmarkResponse> {
    assertName(name);
    return this.getJson<BenchmarkResponse>(`/agents/${name}/benchmark.json`);
  }

  /** Run the benchmark on your own agent now (once per hour). */
  async runBenchmark(name: string): Promise<BenchmarkReport> {
    assertName(name);
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/agents/${name}/benchmark`, { method: 'POST', headers: { accept: 'application/json', ...this.authHeaders() } });
    const body = (await res.json().catch(() => ({}))) as { error?: string; benchmark?: BenchmarkReport };
    if (!res.ok || !body.benchmark) throw new RegistryError(body.error ?? `registry returned ${res.status}`, res.status);
    return body.benchmark;
  }

  /** Latest public audit report for an agent. */
  async audit(name: string): Promise<AuditResponse> {
    assertName(name);
    return this.getJson<AuditResponse>(`/agents/${name}/audit.json`);
  }

  /** Re-run the audit on your own agent (once per hour). */
  async rerunAudit(name: string): Promise<{ audit: AuditReport }> {
    assertName(name);
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/agents/${name}/audit`, { method: 'POST', headers: { accept: 'application/json', ...this.authHeaders() } });
    const body = (await res.json().catch(() => ({}))) as { error?: string; audit?: AuditReport };
    if (!res.ok || !body.audit) throw new RegistryError(body.error ?? `registry returned ${res.status}`, res.status);
    return { audit: body.audit };
  }

  /** Publish a manifest (YAML or JSON text). 422 surfaces as RegistryError.issues or RegistryError.audit. */
  async publish(manifest: string): Promise<PublishResponse> {
    const isJson = manifest.trimStart().startsWith('{');
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/agents`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': isJson ? 'application/json' : 'application/yaml', ...this.authHeaders() },
      body: manifest,
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: ManifestIssue[]; audit?: AuditReport } & Partial<PublishResponse>;
    if (!res.ok) throw new RegistryError(body.error ?? `registry returned ${res.status}`, res.status, body.issues, body.audit?.blocked ? body.audit : undefined);
    return body as PublishResponse;
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
    args: ['-y', CLI_PACKAGE_SPEC, 'serve', `${entry.author}/${entry.name}@${entry.version}`],
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
