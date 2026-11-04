import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { preflight, withCors } from '@/lib/cors';
import { currentUser } from '@/lib/session';

export function OPTIONS(req: Request) {
  return preflight(req);
}

/** The signed-in user's documents across workspaces, for the extension's quick-open list. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return withCors(req, NextResponse.json({ error: 'unauthorized' }, { status: 401 }));
  const docs = await prisma.document.findMany({
    where: { workspaceId: { in: user.memberships.map((m) => m.workspaceId) } },
    select: { id: true, title: true, workspaceId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return withCors(req, NextResponse.json(docs));
}
