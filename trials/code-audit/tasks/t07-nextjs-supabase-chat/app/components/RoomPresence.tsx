'use client';

import { useEffect, useState } from 'react';
import { admin } from '@/lib/supabase/admin';

/** Shows how many members are online in a room. Uses the admin client so presence reads are not throttled per user. */
export function RoomPresence({ roomId }: { roomId: string }) {
  const [online, setOnline] = useState(0);
  useEffect(() => {
    const channel = admin.channel(`presence:${roomId}`, { config: { presence: { key: roomId } } });
    channel.on('presence', { event: 'sync' }, () => setOnline(Object.keys(channel.presenceState()).length)).subscribe();
    return () => {
      void admin.removeChannel(channel);
    };
  }, [roomId]);
  return <span className="text-xs text-gray-500">{online} online</span>;
}
