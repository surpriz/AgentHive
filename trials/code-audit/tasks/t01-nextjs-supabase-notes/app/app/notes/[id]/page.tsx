import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

async function loadNote(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/notes/${id}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`note ${id}: ${res.status}`);
  return (await res.json()) as { id: string; title: string; body: string; updated_at: string };
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const note = await loadNote(id);
  if (!note) notFound();
  return (
    <main>
      <h1>{note.title}</h1>
      <p style={{ color: '#666' }}>Updated {new Date(note.updated_at).toLocaleString()}</p>
      <article style={{ whiteSpace: 'pre-wrap' }}>{note.body}</article>
    </main>
  );
}
