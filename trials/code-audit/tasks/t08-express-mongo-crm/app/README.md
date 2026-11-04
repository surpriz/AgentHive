# pipeline-crm

Contacts, companies and deals for a small sales team. Express 5, Mongoose on
MongoDB Atlas, JWT sessions. Deployed on Render from `main`.

```
cp .env.example .env
pnpm install
pnpm dev
```

Routes in `src/routes`, models in `src/models`, shared middleware in `src/middleware`.
Roles: `agent` (default), `manager`, `admin`.
