# docspace

Shared document workspaces for small teams. Next.js 15, Prisma on Postgres,
iron-session cookies, files on local disk under `storage/` (S3 later).

```
pnpm install
cp .env.example .env   # then fill in DATABASE_URL and a real SESSION_SECRET
pnpm db:push
pnpm dev
```

The public API under `/api/public` is consumed by the browser extension, which runs
on arbitrary origins, hence the CORS handling in `lib/cors.ts`.
