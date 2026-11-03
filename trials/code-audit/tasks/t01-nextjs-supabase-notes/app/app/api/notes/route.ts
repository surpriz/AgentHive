import { NextResponse } from 'next/server';
import { currentUser, serverClient } from '@/lib/auth';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const client = await serverClient();
  const { data, error } = await client.from('notes').select('id, title, updated_at').eq('owner_id', user.id);
  if (error) return NextResponse.json({ error: 'query failed' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { title?: unknown; body?: unknown } | null;
  if (!body || typeof body.title !== 'string' || typeof body.body !== 'string') return NextResponse.json({ error: 'title and body required' }, { status: 400 });
  if (body.title.length > 200 || body.body.length > 20_000) return NextResponse.json({ error: 'too long' }, { status: 400 });
  const client = await serverClient();
  const { data, error } = await client.from('notes').insert({ owner_id: user.id, title: body.title, body: body.body }).select('id').single();
  if (error) return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
