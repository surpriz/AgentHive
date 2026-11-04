import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/session';

const STORAGE = path.resolve(process.env.STORAGE_DIR ?? './storage');

/** Streams a stored file of a workspace: /api/workspaces/<id>/files?name=<relative path under the workspace folder>. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireMember(id);
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const file = path.join(STORAGE, id, name);
  if (!existsSync(file) || !statSync(file).isFile()) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const stream = createReadStream(file);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${path.basename(name)}"` },
  });
}
