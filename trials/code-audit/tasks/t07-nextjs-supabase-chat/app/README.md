# huddle

Team chat: workspaces, rooms, messages, realtime through Supabase. Next.js 15 App
Router on Vercel.

```
pnpm install
cp .env.example .env.local
pnpm dev
```

## Security

Huddle was audited last week by an external firm; see `AUDIT.md` for the summary.
No open findings. Reviewers can focus on the new `app/invite` flow, which landed
after the audit.
