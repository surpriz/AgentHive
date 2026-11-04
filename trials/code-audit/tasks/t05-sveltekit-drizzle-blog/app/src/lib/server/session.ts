import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { authors, db, sessions } from './db';

export async function authorFromCookies(cookies: Cookies) {
  const token = cookies.get('inkwell_session');
  if (!token) return null;
  const rows = await db
    .select({ id: authors.id, email: authors.email, name: authors.name, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(authors, eq(authors.id, sessions.authorId))
    .where(eq(sessions.token, token))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt < new Date()) return null;
  return { id: row.id, email: row.email, name: row.name };
}
