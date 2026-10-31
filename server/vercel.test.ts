import { describe, expect, it } from 'vitest';
import { resolveRequestUrl } from './vercel';

const h = (o: Record<string, string>) => new Headers(o);

describe('resolveRequestUrl', () => {
  it('builds an absolute url from forwarding headers and strips rewrite params', () => {
    const u = resolveRequestUrl('/api/agents.json?__path=%2Fapi%2Fagents.json&ahp=agents.json', h({ 'x-forwarded-host': 'agenthive.sh', 'x-forwarded-proto': 'https' }));
    expect(u.href).toBe('https://agenthive.sh/api/agents.json');
  });

  it('restores the original path when the platform rewrote to the function itself', () => {
    const u = resolveRequestUrl('/api/index?__path=%2Fagents%2Fpg-query-optimizer&ahname=pg-query-optimizer', h({ host: 'agenthive-omega.vercel.app' }));
    expect(u.href).toBe('https://agenthive-omega.vercel.app/agents/pg-query-optimizer');
  });

  it('keeps the caller query string and handles absolute urls', () => {
    expect(resolveRequestUrl('/api/auth/callback/github?code=abc&state=xyz&ahp=auth%2Fcallback%2Fgithub', h({ host: 'localhost:3000' })).href).toBe('http://localhost:3000/api/auth/callback/github?code=abc&state=xyz');
    expect(resolveRequestUrl('https://x.test/a?b=1', h({})).href).toBe('https://x.test/a?b=1');
  });
});
