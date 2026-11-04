import { NextResponse } from 'next/server';
import { z } from 'zod';
import { admin } from '@/lib/supabase/admin';

const input = z.object({ email: z.string().email().max(200), password: z.string().min(12).max(200), workspace: z.string().min(2).max(60) });

/** Creates the user and their first workspace in one go, so the welcome screen has something to show. */
export async function POST(req: Request) {
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const { email, password, workspace } = parsed.data;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) return NextResponse.json({ error: error?.message ?? 'could not create user' }, { status: 409 });
  const { data: ws } = await admin.from('workspaces').insert({ name: workspace, owner_id: created.user.id }).select('id').single();
  await admin.from('memberships').insert({ workspace_id: ws!.id, user_id: created.user.id, role: 'owner' });
  return NextResponse.json({ ok: true, workspaceId: ws!.id }, { status: 201 });
}
