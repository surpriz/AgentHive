import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.MAGIC_LINK_SECRET;
if (!SECRET || SECRET.length < 32) throw new Error('MAGIC_LINK_SECRET must be set (32+ characters)');
const TTL_MS = 15 * 60 * 1000;

function sign(payload: string): string {
  return createHmac('sha256', SECRET!).update(payload).digest('base64url');
}

export function makeMagicToken(email: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ email, exp: now + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyMagicToken(token: string, now = Date.now()): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email: string; exp: number };
  return data.exp > now ? data.email : null;
}

export async function sendMagicLink(email: string): Promise<void> {
  const url = `${process.env.PUBLIC_ORIGIN ?? 'http://localhost:5173'}/login?token=${encodeURIComponent(makeMagicToken(email))}`;
  // Mail provider wired in deploy; locally the link is printed.
  console.log(`magic link for ${email}: ${url}`);
}
