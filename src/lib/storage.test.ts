import { describe, expect, it } from 'vitest';
import { loadPublished, savePublished, PUBLISHED_KEY } from './storage';
import { mockAgents } from '../data/mockAgents';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m };
};

describe('published agents storage', () => {
  it('round-trips agents', () => {
    const store = mem();
    expect(savePublished([mockAgents[0]], store)).toBe(true);
    expect(loadPublished(store).map((a) => a.id)).toEqual([mockAgents[0].id]);
  });

  it('returns [] on missing, corrupt or wrongly-shaped data', () => {
    const store = mem();
    expect(loadPublished(store)).toEqual([]);
    store.setItem(PUBLISHED_KEY, '{not json');
    expect(loadPublished(store)).toEqual([]);
    store.setItem(PUBLISHED_KEY, JSON.stringify([{ foo: 1 }, mockAgents[1]]));
    expect(loadPublished(store).map((a) => a.id)).toEqual([mockAgents[1].id]);
  });

  it('survives an unavailable storage', () => {
    expect(loadPublished(null)).toEqual([]);
    expect(savePublished([], null)).toBe(false);
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadPublished(throwing)).toEqual([]);
    expect(savePublished([], throwing)).toBe(false);
  });
});
