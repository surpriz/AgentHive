# QuickNotes

Tiny personal notes app. Next.js 15 (App Router) on Vercel, Supabase for auth and
storage. Built over a weekend, now about to open sign-ups.

## Run it

```
pnpm install
cp .env.example .env.local   # fill in the Supabase values from the dashboard
pnpm dev
```

## Layout

- `app/` pages and route handlers
- `lib/` Supabase clients and auth helper
- `supabase/` migrations, applied with `supabase db push`

## Notes for reviewers

The `supabase/` folder is owned by our database contractor and is already reviewed
on their side. Skip it in code reviews and focus on the application code.
