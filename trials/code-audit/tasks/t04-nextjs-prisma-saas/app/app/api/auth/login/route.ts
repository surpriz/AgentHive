import { timingSafeEqual, scryptSync } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

const body = z.object({ email: z.string().email().max(200), password: z.string().min(10).max(200) });

function verify(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const given = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid credentials' }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !verify(parsed.data.password, user.passwordHash)) return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  return NextResponse.json({ ok: true });
}
