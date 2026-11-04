import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser, serverClient } from '@/lib/supabase/server';

const input = z.object({ body: z.string().min(1).max(4000) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const client = await serverClient();
  const { data, error } = await client.from('messages').select('id, author_id, body, created_at').eq('room_id', id).order('created_at', { ascending: true }).limit(200);
  if (error) return NextResponse.json({ error: 'query failed' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'body required' }, { status: 400 });
  const client = await serverClient();
  const { data, error } = await client.from('messages').insert({ room_id: id, author_id: user.id, body: parsed.data.body }).select('id').single();
  if (error) return NextResponse.json({ error: 'not allowed' }, { status: 403 });
  return NextResponse.json(data, { status: 201 });
}
