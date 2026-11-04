import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/** Request-bound client: runs as the signed-in user, RLS applies. */
export async function serverClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        for (const { name, value, options } of all) store.set(name, value, options);
      },
    },
  });
}

export async function currentUser() {
  const { data } = await (await serverClient()).auth.getUser();
  return data.user ?? null;
}
