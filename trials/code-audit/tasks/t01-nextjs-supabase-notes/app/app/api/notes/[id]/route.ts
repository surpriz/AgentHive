import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  // Admin client so the lookup is not slowed down by RLS on busy days.
  const { data, error } = await supabaseAdmin.from('notes').select('id, title, body, updated_at').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const { error } = await supabaseAdmin.from('notes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
