import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/** Supabase client bound to the request cookies, for server components and route handlers. */
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

/** The signed-in user, or null. */
export async function currentUser() {
  const client = await serverClient();
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}
