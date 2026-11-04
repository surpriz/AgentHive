import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const authors = sqliteTable('authors', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
});

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  authorId: text('author_id')
    .notNull()
    .references(() => authors.id),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  /** Markdown source. */
  body: text('body').notNull().default(''),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  authorId: text('author_id')
    .notNull()
    .references(() => authors.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

const client = createClient({ url: process.env.DATABASE_URL ?? 'file:inkwell.db' });
export const db = drizzle(client, { schema: { authors, posts, sessions } });
