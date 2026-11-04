import { desc, eq } from 'drizzle-orm';
import { db, posts } from '$lib/server/db';

export async function load({ locals }) {
  const mine = await db
    .select({ id: posts.id, slug: posts.slug, title: posts.title, published: posts.published, updatedAt: posts.updatedAt })
    .from(posts)
    .where(eq(posts.authorId, locals.author!.id))
    .orderBy(desc(posts.updatedAt));
  return { posts: mine };
}
