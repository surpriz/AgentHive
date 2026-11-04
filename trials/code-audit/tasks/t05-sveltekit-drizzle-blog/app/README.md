# inkwell

A small multi-author blog. SvelteKit 2, Drizzle on SQLite (libsql), Markdown
posts rendered with marked. Authors sign in with a magic link and write drafts;
published posts are public.

```
pnpm install
pnpm db:push
pnpm dev
```

- `src/routes/(public)` public pages
- `src/routes/write` the author area
- `src/lib/server` database and session helpers
