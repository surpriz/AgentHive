import { redirect } from 'next/navigation';
import { currentUser, serverClient } from '@/lib/auth';
import { NoteList } from '@/components/NoteList';

export default async function NotesPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/notes');
  const client = await serverClient();
  const { data: notes } = await client.from('notes').select('id, title, updated_at').eq('owner_id', user.id).order('updated_at', { ascending: false });
  return (
    <main>
      <h1>My notes</h1>
      <NoteList notes={notes ?? []} />
    </main>
  );
}
