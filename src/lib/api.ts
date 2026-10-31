import type { Agent } from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    throw new ApiError(msg, res.status, body);
  }
  return body as T;
}

const safeJson = (t: string): unknown => {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};

export interface RegistryConfig {
  github: boolean;
  devLogin: boolean;
  devUser?: { email: string; password: string; login: string };
}

export interface Me {
  user: { id: string; login: string; name: string; image: string | null };
  via: 'session' | 'api-key';
  agents: Agent[];
}

export interface ApiKeySummary {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  createdAt: string;
  lastRequest: string | null;
  enabled: boolean | null;
}

export interface ManifestIssue {
  path: string;
  message: string;
}

export const api = {
  config: () => request<RegistryConfig>('/api/config'),
  catalog: () => request<{ agents: Agent[] }>('/api/catalog.json', { cache: 'no-store' }).then((r) => r.agents),
  me: () => request<Me>('/api/v1/me'),
  keys: () => request<{ keys: ApiKeySummary[] }>('/api/v1/keys').then((r) => r.keys),
  createKey: (name: string) =>
    request<{ key: string; id: string; name: string | null; start: string | null }>('/api/v1/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  revokeKey: (id: string) => request<null>(`/api/v1/keys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  publish: (manifest: Record<string, unknown>) =>
    request<{ agent: Agent; url: string }>('/api/v1/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(manifest),
    }),
};

export function issuesFrom(e: unknown): ManifestIssue[] | null {
  if (e instanceof ApiError && e.status === 422) {
    const issues = (e.body as { issues?: ManifestIssue[] } | null)?.issues;
    return Array.isArray(issues) ? issues : null;
  }
  return null;
}
