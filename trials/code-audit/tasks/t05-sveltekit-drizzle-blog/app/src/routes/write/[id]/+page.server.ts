import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import kebabCase from 'lodash/kebabCase';
import { db, posts } from '$lib/server/db';

/** The editor. Drafts are private to their author until published. */
export async function load({ params }) {
  const rows = await db.select().from(posts).where(eq(posts.id, params.id)).limit(1);
  const post = rows[0];
  if (!post) error(404, 'not found');
  return { post };
}

export const actions = {
  save: async ({ params, request, locals }) => {
    const form = await request.formData();
    const title = String(form.get('title') ?? '').trim();
    const body = String(form.get('body') ?? '');
    if (!title || title.length > 200) return fail(400, { message: 'title required' });
    const rows = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, params.id)).limit(1);
    if (!rows[0] || rows[0].authorId !== locals.author!.id) error(403, 'not your post');
    await db.update(posts).set({ title, body, slug: kebabCase(title), updatedAt: new Date() }).where(eq(posts.id, params.id));
    return { saved: true };
  },
  publish: async ({ params, locals }) => {
    const rows = await db.select({ authorId: posts.authorId, slug: posts.slug }).from(posts).where(eq(posts.id, params.id)).limit(1);
    if (!rows[0] || rows[0].authorId !== locals.author!.id) error(403, 'not your post');
    await db.update(posts).set({ published: true, updatedAt: new Date() }).where(eq(posts.id, params.id));
    redirect(303, `/p/${rows[0].slug}`);
  },
};
