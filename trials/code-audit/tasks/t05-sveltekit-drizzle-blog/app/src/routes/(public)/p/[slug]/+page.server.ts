import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { authors, db, posts } from '$lib/server/db';
import { render } from '$lib/server/markdown';

export async function load({ params }) {
  const rows = await db
    .select({ title: posts.title, body: posts.body, published: posts.published, author: authors.name })
    .from(posts)
    .innerJoin(authors, eq(authors.id, posts.authorId))
    .where(eq(posts.slug, params.slug))
    .limit(1);
  const post = rows[0];
  if (!post || !post.published) error(404, 'not found');
  return { title: post.title, author: post.author, html: render(post.body) };
}
