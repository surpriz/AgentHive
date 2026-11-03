'use client';

import { useState } from 'react';

type Note = { id: string; title: string; updated_at: string };

export function NoteList({ notes: initial }: { notes: Note[] }) {
  const [notes, setNotes] = useState(initial);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, body }) });
    if (!res.ok) return alert('could not save');
    const { id } = (await res.json()) as { id: string };
    setNotes([{ id, title, updated_at: new Date().toISOString() }, ...notes]);
    setTitle('');
    setBody('');
  }

  async function remove(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (res.ok) setNotes(notes.filter((n) => n.id !== id));
  }

  return (
    <>
      <form onSubmit={create} style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} required />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write…" rows={4} required />
        <button type="submit">Save</button>
      </form>
      <ul>
        {notes.map((n) => (
          <li key={n.id}>
            <a href={`/notes/${n.id}`}>{n.title}</a> <button onClick={() => remove(n.id)}>delete</button>
          </li>
        ))}
      </ul>
    </>
  );
}
