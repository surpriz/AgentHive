import { cookies } from 'next/headers';
import { getIronSession, type SessionOptions } from 'iron-session';
import { prisma } from './db';

export interface SessionData {
  userId?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'docspace_session',
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function currentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return prisma.user.findUnique({ where: { id: session.userId }, include: { memberships: true } });
}

export async function requireMember(workspaceId: string) {
  const user = await currentUser();
  if (!user) return null;
  return user.memberships.some((m) => m.workspaceId === workspaceId) ? user : null;
}
