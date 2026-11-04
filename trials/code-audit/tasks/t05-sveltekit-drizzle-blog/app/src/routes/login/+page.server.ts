import { randomBytes } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { authors, db, sessions } from '$lib/server/db';
import { sendMagicLink, verifyMagicToken } from '$lib/server/magic';

export async function load({ url, cookies }) {
  const token = url.searchParams.get('token');
  if (!token) return {};
  const email = verifyMagicToken(token);
  if (!email) return { message: 'This link has expired.' };
  const author = (await db.select().from(authors).where(eq(authors.email, email)).limit(1))[0];
  if (!author) return { message: 'Unknown author.' };
  const session = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({ token: session, authorId: author.id, expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000) });
  cookies.set('inkwell_session', session, { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 14 * 24 * 3600 });
  redirect(303, '/write');
}

export const actions = {
  default: async ({ request }) => {
    const email = String((await request.formData()).get('email') ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, { message: 'enter an email' });
    const author = (await db.select().from(authors).where(eq(authors.email, email)).limit(1))[0];
    if (author) await sendMagicLink(email);
    return { message: 'If that address belongs to an author, a link is on its way.' };
  },
};
