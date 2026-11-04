import { desc, eq } from 'drizzle-orm';
import { authors, db, posts } from '$lib/server/db';

export async function load() {
  const rows = await db
    .select({ slug: posts.slug, title: posts.title, author: authors.name, updatedAt: posts.updatedAt })
    .from(posts)
    .innerJoin(authors, eq(authors.id, posts.authorId))
    .where(eq(posts.published, true))
    .orderBy(desc(posts.updatedAt))
    .limit(30);
  return { posts: rows };
}
