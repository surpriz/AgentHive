import { beforeAll, describe, expect, it } from 'vitest';
import { createApp, type AppContext } from './app';
import type { Mail } from './email';
import { purgeUnverifiedUsers } from './auth';
import { user as userTable } from './db/auth-schema';
import { eq } from 'drizzle-orm';

let ctx: AppContext;
const outbox: Mail[] = [];

beforeAll(async () => {
  ctx = await createApp({
    databaseUrl: 'pglite://memory',
    origin: 'https://agenthive.sh',
    devLogin: false,
    auth: { secret: 'x'.repeat(40), baseURL: 'https://agenthive.sh', email: { send: async (m) => void outbox.push(m) } },
  });
});

const req = (path: string, init?: RequestInit) => ctx.app.request(path, { ...init, headers: { 'content-type': 'application/json', origin: 'https://agenthive.sh', ...(init?.headers as Record<string, string>) } });
const body = { email: 'jane@example.com', password: 'a-long-enough-password-1', name: 'Jane' };

describe('email sign-in', () => {
  it('is announced in the config', async () => {
    expect(((await (await req('/api/config')).json()) as { email: boolean }).email).toBe(true);
  });

  it('sends a verification link on sign-up, refuses sign-in until it is used, then signs the user in', async () => {
    const up = await req('/api/auth/sign-up/email', { method: 'POST', body: JSON.stringify(body) });
    expect(up.status).toBe(200);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(body.email);
    expect(outbox[0].subject).toMatch(/Confirm/);
    const url = /https:\/\/\S+/.exec(outbox[0].text)?.[0];
    expect(url).toMatch(/\/api\/auth\/verify-email\?token=/);

    const early = await req('/api/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email: body.email, password: body.password }) });
    expect(early.status).toBe(403);
    // no handle is held while the address is unproven
    expect((await ctx.db.query.user.findFirst({ where: eq(userTable.email, body.email) }))?.login).toMatch(/^pending-/);

    const verify = await ctx.app.request(url!, { headers: { origin: 'https://agenthive.sh' } });
    expect([200, 302]).toContain(verify.status);
    // the link alone does not sign anyone in
    expect(verify.headers.get('set-cookie') ?? '').not.toContain('better-auth.session_token=');

    const ok = await req('/api/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email: body.email, password: body.password }) });
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('better-auth.session_token');
    const me = await req('/api/v1/me', { headers: { cookie: cookie.split(';')[0] } });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: { login: string } }).user.login).toBe('jane');
  });

  it('purges password-only accounts that never verified, after the grace period', async () => {
    const up = await req('/api/auth/sign-up/email', { method: 'POST', body: JSON.stringify({ email: 'parked@example.com', password: 'a-long-enough-password-2', name: 'Parker' }) });
    expect(up.status).toBe(200);
    expect(await purgeUnverifiedUsers(ctx.db, 60_000)).toBe(0);
    expect(await purgeUnverifiedUsers(ctx.db, 0, new Date(Date.now() + 1000))).toBe(1);
    expect(await ctx.db.query.user.findFirst({ where: eq(userTable.email, 'parked@example.com') })).toBeUndefined();
    expect(await ctx.db.query.user.findFirst({ where: eq(userTable.email, body.email) })).toBeDefined();
  });

  it('sends a reset link that mentions the account', async () => {
    const res = await req('/api/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email: body.email, redirectTo: '/' }) });
    expect(res.status).toBe(200);
    const last = outbox[outbox.length - 1];
    expect(last.subject).toMatch(/Reset/);
    expect(last.text).toMatch(/reset-password/);
  });
});
