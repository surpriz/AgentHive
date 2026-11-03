'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setError(error.message);
    const next = params.get('next') ?? '/notes';
    router.push(next.startsWith('/') && !next.startsWith('//') ? next : '/notes');
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
        <button type="submit">Sign in</button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </form>
    </main>
  );
}
