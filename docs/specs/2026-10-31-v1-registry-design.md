# v1.0 — a real registry

Status: in progress. Scope agreed 2026-10-31. See `docs/ROADMAP.md` for
what comes after.

## Intent

Replace the mock catalog with a database-backed registry that third parties
can publish to. Everything a visitor sees today stays; what changes is that
the agents are real rows, owned by real GitHub accounts, pushed by a real CLI.
Execution, metering and benchmarks are explicitly out of scope for v1.0.

## Goals

- Anyone with a GitHub account can publish an agent manifest and own its name.
- `agent-cli push` and the web form both go through one validated API.
- The public endpoints (`/api/agents.json`, `/agents/<name>/agent.json`,
  `agent.yaml`, sitemap, pre-rendered agent pages) are served from the
  database and stay backward compatible with the v0 shape.
- Local dev, CI and tests run without a cloud database.

## Non-goals (v1.0)

- Running agents. `endpoint` in the manifest is stored and displayed, never
  called.
- Computed grades or benchmarks. New agents get `grade: pending` and no
  success rate. The six seed agents keep their illustrative numbers and are
  marked as seeds.
- Email/password auth, organisations, teams, billing.

## Architecture

One repository, one Vercel project.

- `server/` — Hono app (`server/app.ts`), Drizzle schema and migrations,
  better-auth config, manifest validation. Pure TypeScript, no framework
  coupling, tested with vitest against PGlite.
- `api/index.ts` — Vercel Node function that exports the Hono app. Every
  non-static route is rewritten to it in `vercel.json`.
- `vite-plugin-api.ts` — mounts the same Hono app inside the Vite dev server
  so `pnpm dev` is the full stack and Playwright needs no second process.
- `src/` — the SPA. Reads the registry through `fetch('/api/...')` instead of
  importing mock data. Adds sign-in, a dashboard and a real publish form.
- `packages/cli` — gains `login`, `whoami`, `push`.

### Database

Postgres on Neon (project `agenthive`, branch `main` for production, branch
`dev` for previews and local work). `DATABASE_URL=pglite://memory` switches
the driver to an in-memory PGlite instance with migrations and seed applied
on boot; tests and CI use that.

Tables (snake_case, Drizzle):

- better-auth: `user`, `session`, `account`, `verification`, `apikey`.
  Generated with the better-auth CLI, not hand-written.
- `agents`: `id`, `name` (unique, kebab-case, 3–48 chars), `owner_id` →
  user, `author` (GitHub login at publish time), `value`, `tagline`,
  `framework`, `category`, `grade` (`pending` | `B` | `A` | `AA` | `AAA`),
  `success_rate` (nullable), `cost_per_run` (nullable), `avg_latency_ms`
  (nullable), `runs_30d` (default 0), `tools`, `tags`, `capabilities`
  (jsonb string[]), `readme`, `use_cases` (jsonb), `input_schema`,
  `output_schema` (jsonb), `model`, `license`, `endpoint` (nullable),
  `latest_version`, `is_seed`, `created_at`, `updated_at`.
- `agent_versions`: `id`, `agent_id`, `version`, `manifest` (jsonb, the
  normalised manifest), `created_at`. Unique on (`agent_id`, `version`).

### Manifest (apiVersion `agenthive.sh/v1`)

The YAML the CLI pushes and the site serves. Zod schema in
`server/manifest.ts`; v0 YAML emitted by the site remains readable.

```yaml
apiVersion: agenthive.sh/v1
kind: Agent
metadata:
  name: pg-query-optimizer      # owned by the first publisher
  version: 3.0.4                # semver, must increase
  license: Apache-2.0
  category: Data & Analytics
  value: Makes a slow Postgres query fast and tells you which index to add.
  tagline: Reads EXPLAIN ANALYZE output, rewrites the SQL and proposes indexes.
  tags: [postgres, sql]
spec:
  framework: MCP Server
  model: claude-sonnet-5-5
  transport: mcp/stdio          # or a2a/http+json
  endpoint: https://…           # optional in v1.0, stored only
  capabilities: [sql.explain, sql.rewrite]
  tools: [Postgres, EXPLAIN Analyzer]
  io:
    input:  { type: object, … }  # JSON schema inline
    output: { type: object, … }
readme: |
  Markdown.
useCases:
  - …
```

`author` is never in the manifest; it is the GitHub login of the publisher.
`security` and `benchmark` blocks are ignored on input in v1.0 (the server
owns them).

### API

Public, cached, CORS `*`:

- `GET /api/agents.json` — index, same shape as v0 plus `value`, nullable
  metrics and `grade: "pending"`.
- `GET /agents/:name/agent.json` — A2A agent card.
- `GET /agents/:name/agent.yaml` — manifest.
- `GET /sitemap.xml`
- `GET /agents/:name` (Accept: text/html) — index.html with per-agent meta.

Authenticated (session cookie from the SPA, or `Authorization: Bearer
<api key>` from the CLI):

- `GET /api/v1/me` — user + agents owned.
- `POST /api/v1/agents` — body: manifest as YAML (`text/yaml`) or JSON.
  Validates, checks name ownership (first publisher owns it, others get
  409), checks version increases, upserts `agents`, inserts
  `agent_versions`. Returns the registry entry.
- `GET/POST/DELETE /api/v1/keys` — list, create (returns the key once),
  revoke. Keys are prefixed `ah_` and stored hashed by better-auth.
- `/api/auth/*` — better-auth (GitHub OAuth, session).

Rate limit: better-auth's built-in on auth routes; publish limited to 30 per
hour per user (in-memory counter per function instance, good enough for
v1.0).

### Frontend changes

- Catalog loads `/api/agents.json` on mount with a skeleton grid; the seed
  agents are included so the first paint looks like v0.
- Navbar: "Sign in with GitHub" / avatar menu (Dashboard, Sign out).
- `/dashboard`: my agents (name, version, grade, link), API keys (create
  with a name, shown once, revoke), CLI quick start.
- "Push Agent" modal: same fields, now posts to the API. Signed-out users
  see the GitHub button instead of the form. The simulated terminal log is
  replaced by the real response (validation errors inline, field by field).
- Cards and detail: `pending` grade badge, metrics show "—" when null.
- localStorage "published" agents removed.

### CLI

- `agent-cli login` — prompts for an API key (or `--key`), verifies it
  against `/api/v1/me`, stores it in `~/.config/agenthive/credentials.json`
  (mode 600). `AGENTHIVE_TOKEN` env overrides.
- `agent-cli whoami`
- `agent-cli push [agent.yaml]` — reads the file, posts it, prints the
  registry URL or the validation errors.

### Testing

- vitest, `server/**/*.test.ts`: manifest validation, publish rules
  (ownership, version ordering), public endpoints shape, API key auth. All
  against PGlite via `createApp({ databaseUrl: 'pglite://memory' })`.
- Playwright: existing suite plus dashboard and publish through a seeded
  API key (`AGENTHIVE_TEST_KEY` created at seed time in pglite mode only).
  GitHub OAuth itself is not end-to-end tested.
- CI sets `DATABASE_URL=pglite://memory`.

## Decisions taken by the builder

- Hono over Next.js: the site is a Vite SPA and stays one; no reason to
  migrate a working front for a dozen routes.
- better-auth over hand-rolled OAuth: sessions, CSRF, OAuth state and API
  keys are the kind of code that should not be bespoke.
- Drizzle + Neon HTTP driver: works in Vercel functions and in Node, one
  codepath.
- Pre-rendered agent HTML moves from build time to request time, since
  agents are now created after the build.
