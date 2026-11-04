import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMember } from '@/lib/session';

const STORAGE = path.resolve(process.env.STORAGE_DIR ?? './storage');
const meta = z.object({ title: z.string().min(1).max(200) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireMember(id))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await prisma.document.findMany({ where: { workspaceId: id }, orderBy: { createdAt: 'desc' } }));
}

/** multipart upload: `file` plus a `title` field; the stored name is random, the original name is kept only as the title. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireMember(id))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const form = await req.formData();
  const parsed = meta.safeParse({ title: form.get('title') });
  const file = form.get('file');
  if (!parsed.success || !(file instanceof File)) return NextResponse.json({ error: 'title and file required' }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'too large' }, { status: 413 });
  const storagePath = `${id}/${randomUUID()}${path.extname(file.name).slice(0, 10)}`;
  await mkdir(path.join(STORAGE, id), { recursive: true });
  await writeFile(path.join(STORAGE, storagePath), Buffer.from(await file.arrayBuffer()));
  const doc = await prisma.document.create({ data: { workspaceId: id, title: parsed.data.title, storagePath } });
  return NextResponse.json(doc, { status: 201 });
}
