import { redirect } from 'next/navigation';
import { RoomPresence } from '@/components/RoomPresence';
import { currentUser, serverClient } from '@/lib/supabase/server';

export default async function RoomPage({ params }: { params: Promise<{ workspace: string; id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect('/login');
  const client = await serverClient();
  const { data: room } = await client.from('rooms').select('id, name').eq('id', id).single();
  if (!room) redirect('/');
  const { data: messages } = await client.from('messages').select('id, author_id, body, created_at').eq('room_id', id).order('created_at').limit(200);
  return (
    <main>
      <h1>
        #{room.name} <RoomPresence roomId={room.id} />
      </h1>
      <ul>
        {(messages ?? []).map((m) => (
          <li key={m.id}>
            <small>{m.author_id.slice(0, 8)}</small> {m.body}
          </li>
        ))}
      </ul>
    </main>
  );
}
