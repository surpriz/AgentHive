# AgentHive · agenthive.sh

The registry for interoperable AI agents. v1: database-backed catalog, GitHub sign-in, API keys, real publishing from the web form or `agent-cli push`, A2A/MCP manifests, pre-rendered agent pages. Execution is not part of v1.0 (the sandbox is a labelled simulation).

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · lucide-react on the front. Hono · better-auth · Drizzle · Postgres (Neon in the cloud, PGlite in memory for dev/tests) on the back, deployed as one Vercel function. Design notes: `docs/specs/2026-10-31-v1-registry-design.md`.

## Run

```sh
pnpm install
pnpm dev        # http://localhost:5173 — SPA + API in one process
pnpm build      # type-check + production bundle in dist/
pnpm test       # unit + server tests (vitest, PGlite)
pnpm test:e2e   # Playwright against pnpm dev on PGlite; uses local Chrome (CI installs Chromium)
BASE_URL=https://agenthive-omega.vercel.app pnpm test:e2e   # same suite against a deployment
pnpm og         # regenerate public/og.png from scripts/og-template.html
```

Without a `.env.local`, `pnpm dev` runs on an in-memory database with the agents from `agents/` published at boot, a test user and password sign-in (the "Sign in" button uses it when GitHub OAuth is not configured). The dev server prints a test API key at boot.

```sh
cp .env.example .env.local   # DATABASE_URL (Neon dev branch), BETTER_AUTH_SECRET, GITHUB_CLIENT_ID/SECRET
pnpm db:generate             # new migration after editing server/db/schema.ts
pnpm db:migrate              # apply migrations to DATABASE_URL (Vercel runs this before each build)
pnpm auth:schema             # regenerate server/db/auth-schema.ts after changing better-auth plugins
```

## Routes & machine endpoints

| Path | What |
|---|---|
| `/` | catalog |
| `/agents/<name>` | agent drawer, shareable deep link, pre-rendered with per-agent meta (unknown name → 404 banner) |
| `/dashboard` | your agents and API keys (signed in) |
| `/leaderboard`, `/api/leaderboard.json`, `/api/leaderboard/history.json` | agents ranked per category from measured numbers ([docs/LEADERBOARD.md](docs/LEADERBOARD.md)) |
| `/api/agents.json` | registry index, CORS open, cached |
| `/api/catalog.json` | full agent objects for the SPA |
| `/agents/<name>/agent.json`, `agent.yaml` | A2A agent card, AgentHive manifest |
| `/agents/<name>/audit.json` | public audit report behind the grade (hosted agents) or the checks list (packages, [docs/CHECKS.md](docs/CHECKS.md)) |
| `/agents/<name>/package.json` | a declarative agent's files, bricks and per-tool layouts for Claude Code, Cursor and Codex |
| `POST /api/v1/run/<name>` | run gateway: forwards JSON to the author's endpoint, signed and logged; `x-agenthive-async: 1` returns a run id, `x-agenthive-webhook` posts the signed result ([docs/GATEWAY.md](docs/GATEWAY.md)) |
| `GET /api/v1/runs/<runId>`, `/api/v1/webhooks/secret` | async run state and output, caller webhook secret |
| `POST /api/v1/echo` | public echo upstream to try the gateway |
| `/agents/<name>/benchmark.json`, `POST /api/v1/agents/<name>/benchmark` | registry benchmark (probes + `spec.tests`), public report and owner re-run |
| `/api/v1/runs`, `/api/v1/agents/<name>/runs`, `…/secret` | run logs (caller / owner), gateway secret |
| `/api/v1/me`, `POST /api/v1/agents`, `POST /api/v1/packages`, `POST /api/v1/agents/<name>/audit`, `/api/v1/keys` | authenticated: session cookie or `Authorization: Bearer <api key>` |
| `POST /api/agents/<name>/report` | anyone reports a card (security, rights, other); mailed to `REPORTS_TO` when a sender exists, five per hour per address |
| `POST /api/v1/agents/<name>/unpublish` | the owner takes it off the catalog: listings drop it, its name answers 410 with a tombstone, trial results stay |
| `GET /api/v1/reports`, `POST /api/v1/agents/<name>/takedown`, `…/restore` | admins only (`ADMIN_LOGINS`, comma separated logins) |
| `/api/auth/*` | better-auth: GitHub and Google OAuth, email + password with a verification link (`EMAIL_FROM` plus `SES_REGION`/`SES_ACCESS_KEY_ID`/`SES_SECRET_ACCESS_KEY`, or `RESEND_API_KEY`), all env-gated |
| `/sitemap.xml`, `/robots.txt`, `/og.png` | SEO |

All of it is one Hono app (`server/app.ts`), mounted in the Vite dev server by `vite-plugin-api.ts` and exported by `api/index.ts` on Vercel. Publishing rules: first publisher owns the name, re-publish needs a greater semver. Every publish runs the audit in `server/audit/` (secrets, endpoint, permissions, dependencies via OSV, completeness); the grade is computed from it, the report is public at `/agents/<name>/audit.json`, criteria in [docs/GRADING.md](docs/GRADING.md). The numbers on a hosted agent's card are measured: success = benchmark pass rate, availability = gateway ok-rate after 20 runs, latency and runs over 30 days; cost stays null until billing exists.

## Deploy

Vercel project `agenthive`, Neon project `agenthive` (branch `main` → production, `dev` → previews and local). `vercel.json` rewrites every API path and `/agents/:name` to the function; the build runs `pnpm db:migrate` first. Required env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. `BETTER_AUTH_URL` and `PUBLIC_ORIGIN` default to the deployment's own URL. Optional: `ADMIN_LOGINS` (who can read reports and take agents down), `REPORTS_TO` (report notifications, defaults to `EMAIL_FROM`).

## Layout

```
src/
  App.tsx                      state: filters, selected agent, publish modal
  types.ts                     Agent, Framework, Category, SecurityGrade, SandboxStep
  data/sandboxScenarios.ts     scripted reasoning chains per agent
  lib/filters.ts               search + chip filters
  lib/manifest.ts              YAML manifest, A2A agent card, registry index, install snippets
  lib/router.ts                history-based routing (/, /agents/<name>, /dashboard)
  lib/api.ts, lib/auth-client.ts   fetch helpers, better-auth React client
  components/                  Navbar, FilterBar, AgentCard, AgentGrid, AgentDetailModal, PublishModal, Dashboard, Leaderboard, HowItWorksModal
  components/tabs/             OverviewTab, ManifestTab, SandboxView
  components/ui/               Badge, CodeBlock, Modal, Tabs
server/
  app.ts                       Hono app: public registry, auth, publish, keys
  auth.ts                      better-auth config (GitHub, api-key plugin)
  manifest.ts                  zod schema for agenthive.sh/v1 manifests
  publish.ts                   ownership + version rules, runs the audit
  gateway.ts                   run gateway: signing, quotas, logs, measured metrics
  benchmark.ts                 registry probes + author cases, pass rate shown as success
  leaderboard.ts               composite ranking per category, daily snapshots
  audit/                       checks, grading, report (see docs/GRADING.md)
  db/schema.ts, db/auth-schema.ts, db/migrations/
api/index.ts                   Vercel function
vite-plugin-api.ts             mounts the app in the dev server
e2e/                           Playwright specs (desktop + mobile projects)
```

## Agents

Two kinds live in the registry:

- **Packages** (`apiVersion: agenthive.sh/v2`): a folder with `agent.yaml`, `prompt.md`, `skills/<name>/SKILL.md`, `examples/`. Text only, no code; the code lives in pinned MCP servers. Published with `agent-cli push ./folder`, checked ([docs/CHECKS.md](docs/CHECKS.md)), retrieved into Claude Code or Cursor with `agent-cli pull <name> --target claude|cursor` or the copy prompt on the card. The first five, all on code and security audit, are in [`agents/`](agents/).
- **Hosted agents** (`agenthive.sh/v1`): an https endpoint run by the author, called through the gateway, graded and benchmarked. `examples/cron-translator/` is the reference, deployed at https://agenthive-cron-translator.vercel.app and published as [cron-translator](https://agenthive.sh/agents/cron-translator).

## Packages (pnpm workspace)

| Package | What |
|---|---|
| `@agenthive-sh/registry-client` | typed client for the index, cards, manifests, packages, publishing and the gateway |
| `@agenthive-sh/mcp` | stdio MCP server: `search_agents`, `get_agent`, `get_manifest`, `install_snippet` + `agenthive://registry` resource |
| `@agenthive-sh/cli` | `agent-cli search | info | manifest | leaderboard | audit | benchmark | pull | push | run | result | runs | setup | login | whoami`; `pull` writes a package into Claude Code or Cursor |

```sh
pnpm -r --include-workspace-root build && pnpm -r --include-workspace-root test   # includes the web app at the root
AGENTHIVE_REGISTRY=http://localhost:5173 pnpm --filter @agenthive-sh/mcp smoke   # needs pnpm dev running
AGENTHIVE_REGISTRY=http://localhost:5173 pnpm --filter @agenthive-sh/cli smoke
```

Published on npm as `@agenthive-sh/registry-client`, `@agenthive-sh/mcp` and `@agenthive-sh/cli`.

## Roadmap

- **V0** catalog + registry, universal MCP server, developer CLI
- **V1** publish API, run gateway, computed benchmarks and grades, usage metering
- **V2** full A2A compliance, private registries, public leaderboard, SDKs

Details, ordering and the decisions behind them: [docs/ROADMAP.md](docs/ROADMAP.md).
