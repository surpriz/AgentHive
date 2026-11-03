# merch-api

Backend for the merch shop: products, customer accounts, orders, Stripe checkout.
Express 5, Prisma on Postgres, deployed on Railway.

```
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

Routes are under `src/routes`. Auth is a JWT in the `Authorization: Bearer` header,
issued by `POST /auth/login`. Stripe calls back on `POST /webhooks/stripe` when a
checkout session completes.
