# sync-worker

Nightly exports for every tenant, plus webhook notifications when an export is
ready. BullMQ on Redis for the queue, pino for logs, a tiny Express admin API on
port 9090 (reachable from the office VPN only) to enqueue jobs by hand.

```
cp .env.example .env
pnpm install
pnpm dev
```

- `src/index.ts` boots the worker and the admin API
- `src/jobs/` one file per job type
- `src/lib/` shell helpers, webhook delivery, logging
