import type { Agent } from '../types';

export const PUBLISHED_KEY = 'agenthive:published:v1';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadPublished(store: Storage | null = storage()): Agent[] {
  try {
    const raw = store?.getItem(PUBLISHED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed.filter(isAgentLike) as Agent[]).map((a) => ({ ...a, value: typeof a.value === 'string' ? a.value : a.tagline }));
  } catch {
    return [];
  }
}

export function savePublished(agents: Agent[], store: Storage | null = storage()): boolean {
  try {
    store?.setItem(PUBLISHED_KEY, JSON.stringify(agents));
    return store !== null;
  } catch {
    return false;
  }
}

function isAgentLike(x: unknown): x is Agent {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.name === 'string' && typeof o.version === 'string' && Array.isArray(o.tools);
}
