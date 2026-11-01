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

Without a `.env.local`, `pnpm dev` runs on an in-memory database with the seed agents, a test user and password sign-in (the "Sign in" button uses it when GitHub OAuth is not configured). The dev server prints a test API key at boot.

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
| `/api/agents.json` | registry index, CORS open, cached |
| `/api/catalog.json` | full agent objects for the SPA |
| `/agents/<name>/agent.json`, `agent.yaml` | A2A agent card, AgentHive manifest |
| `/agents/<name>/audit.json` | public audit report behind the grade |
| `/api/v1/me`, `POST /api/v1/agents`, `POST /api/v1/agents/<name>/audit`, `/api/v1/keys` | authenticated: session cookie or `Authorization: Bearer <api key>` |
| `/api/auth/*` | better-auth (GitHub OAuth) |
| `/sitemap.xml`, `/robots.txt`, `/og.png` | SEO |

All of it is one Hono app (`server/app.ts`), mounted in the Vite dev server by `vite-plugin-api.ts` and exported by `api/index.ts` on Vercel. Publishing rules: first publisher owns the name, re-publish needs a greater semver, seeds are read-only. Every publish runs the audit in `server/audit/` (secrets, endpoint, permissions, dependencies via OSV, completeness); the grade is computed from it, the report is public at `/agents/<name>/audit.json`, criteria in [docs/GRADING.md](docs/GRADING.md). Benchmark numbers stay null until the registry measures them.

## Deploy

Vercel project `agenthive`, Neon project `agenthive` (branch `main` → production, `dev` → previews and local). `vercel.json` rewrites every API path and `/agents/:name` to the function; the build runs `pnpm db:migrate` first. Required env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. `BETTER_AUTH_URL` and `PUBLIC_ORIGIN` default to the deployment's own URL.

## Layout

```
src/
  App.tsx                      state: filters, selected agent, publish modal
  types.ts                     Agent, Framework, Category, SecurityGrade, SandboxStep
  data/mockAgents.ts           6 seed agents
  data/sandboxScenarios.ts     scripted reasoning chains per agent
  lib/filters.ts               search + chip filters
  lib/manifest.ts              YAML manifest, A2A agent card, registry index, install snippets
  lib/router.ts                history-based routing (/, /agents/<name>, /dashboard)
  lib/api.ts, lib/auth-client.ts   fetch helpers, better-auth React client
  components/                  Navbar, FilterBar, AgentCard, AgentGrid, AgentDetailModal, PublishModal, Dashboard, HowItWorksModal
  components/tabs/             OverviewTab, ManifestTab, SandboxView
  components/ui/               Badge, CodeBlock, Modal, Tabs
server/
  app.ts                       Hono app: public registry, auth, publish, keys
  auth.ts                      better-auth config (GitHub, api-key plugin)
  manifest.ts                  zod schema for agenthive.sh/v1 manifests
  publish.ts                   ownership + version rules, runs the audit
  audit/                       checks, grading, report (see docs/GRADING.md)
  db/schema.ts, db/auth-schema.ts, db/migrations/, db/seed.ts
api/index.ts                   Vercel function
vite-plugin-api.ts             mounts the app in the dev server
e2e/                           Playwright specs (desktop + mobile projects)
```

## Packages (pnpm workspace)

| Package | What |
|---|---|
| `@agenthive-sh/registry-client` | typed client for `/api/agents.json`, agent cards, manifests, install snippets |
| `@agenthive-sh/mcp` | stdio MCP server: `search_agents`, `get_agent`, `get_manifest`, `install_snippet` + `agenthive://registry` resource |
| `@agenthive-sh/cli` | `agent-cli search | info | manifest | audit | add | setup | login | whoami | push`, writes `mcpServers` entries for Claude Code / Cursor |

```sh
pnpm -r --include-workspace-root build && pnpm -r --include-workspace-root test   # includes the web app at the root
AGENTHIVE_REGISTRY=http://localhost:5173 pnpm --filter @agenthive-sh/mcp smoke   # needs pnpm dev running
AGENTHIVE_REGISTRY=http://localhost:5173 pnpm --filter @agenthive-sh/cli smoke
```

Published on npm as `@agenthive-sh/registry-client`, `@agenthive-sh/mcp` and `@agenthive-sh/cli` (0.1.0). `agent-cli serve` and the `.claude.json` snippets point at the run gateway and fail with a clear message today.

## Roadmap

- **V0** catalog + registry, universal MCP server, developer CLI
- **V1** publish API, run gateway, computed benchmarks and grades, usage metering
- **V2** full A2A compliance, private registries, public leaderboard, SDKs

Details, ordering and the decisions behind them: [docs/ROADMAP.md](docs/ROADMAP.md).
