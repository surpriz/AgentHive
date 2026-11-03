import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC = ['/', '/login', '/signup'];

export async function middleware(req: NextRequest) {
  if (PUBLIC.includes(req.nextUrl.pathname)) return NextResponse.next();
  const res = NextResponse.next();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (all) => {
        for (const { name, value, options } of all) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await client.auth.getUser();
  if (!data.user) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return res;
}

export const config = { matcher: ['/((?!_next|favicon.ico|api/health).*)'] };
