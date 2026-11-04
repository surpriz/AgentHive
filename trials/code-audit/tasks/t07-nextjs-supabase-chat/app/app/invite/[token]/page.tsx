import { redirect } from 'next/navigation';
import { currentUser, serverClient } from '@/lib/supabase/server';

/** Accepts a workspace invitation. The token is single-use and expires after 7 days (enforced in the RPC). */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/invite/${encodeURIComponent(token)}`);
  const client = await serverClient();
  const { data, error } = await client.rpc('accept_invite', { invite_token: token });
  if (error || !data) {
    return (
      <main>
        <h1>This invitation is not valid</h1>
        <p>Ask the person who invited you for a new link.</p>
      </main>
    );
  }
  redirect(`/w/${data as string}`);
}
