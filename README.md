# AgentHive · agenthive.sh

The registry for interoperable AI agents. V0: public catalog, A2A/MCP manifests, CLI install snippets, live sandbox simulation, publish flow.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · lucide-react. No backend, mock data in `src/data`.

## Run

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # type-check + production bundle in dist/
pnpm test       # unit (vitest)
pnpm test:e2e   # Playwright, uses local Chrome (CI installs Chromium)
pnpm og         # regenerate public/og.png from scripts/og-template.html
```

## Routes & machine endpoints

| Path | What |
|---|---|
| `/` | catalog |
| `/agents/<name>` | agent drawer, shareable deep link (unknown name → 404 banner) |
| `/api/agents.json` | registry index, CORS open |
| `/agents/<name>/agent.json` | A2A agent card |
| `/sitemap.xml`, `/robots.txt`, `/og.png` | SEO |

JSON endpoints are generated from `src/data/mockAgents.ts` by `vite-plugin-registry.ts`: served in dev, emitted as static files at build. Agents pushed from the Publish modal persist in `localStorage` only.

## Deploy

Vercel: `vercel.json` rewrites `/agents/:name` to the SPA, sets CORS + cache on JSON, security headers everywhere. Netlify works too via `public/_redirects`.

## Layout

```
src/
  App.tsx                      state: filters, selected agent, publish modal
  types.ts                     Agent, Framework, Category, SecurityGrade, SandboxStep
  data/mockAgents.ts           6 seed agents
  data/sandboxScenarios.ts     scripted reasoning chains per agent
  lib/filters.ts               search + chip filters
  lib/manifest.ts              YAML manifest, A2A agent card, registry index, install snippets
  lib/router.ts                history-based /agents/<name> routing
  lib/storage.ts               localStorage for published agents
  components/                  Navbar, FilterBar, AgentCard, AgentGrid, AgentDetailModal, PublishModal
  components/tabs/             OverviewTab, ManifestTab, SandboxView
  components/ui/               Badge, CodeBlock, Modal, Tabs
e2e/                           Playwright specs (desktop + mobile projects)
vite-plugin-registry.ts        emits /api/agents.json, agent cards, sitemap
```

## Packages (pnpm workspace)

| Package | What |
|---|---|
| `@agenthive/registry-client` | typed client for `/api/agents.json`, agent cards, manifests, install snippets |
| `@agenthive/mcp` | stdio MCP server: `search_agents`, `get_agent`, `get_manifest`, `install_snippet` + `agenthive://registry` resource |
| `@agenthive/cli` | `agent-cli search | info | manifest | add | setup`, writes `mcpServers` entries for Claude Code / Cursor |

```sh
pnpm -r build && pnpm -r test
AGENTHIVE_REGISTRY=http://localhost:5173 pnpm --filter @agenthive/mcp smoke   # needs pnpm dev running
AGENTHIVE_REGISTRY=http://localhost:5173 pnpm --filter @agenthive/cli smoke
```

Neither package is published to npm yet. `agent-cli serve` and the `.claude.json` snippets point at the V1 runtime and fail with a clear message today.

## Roadmap

- **V0** catalog + registry, universal MCP server, developer CLI
- **V1** managed serverless runtime, reasoning logs, automatic security audit, pay-as-you-go
- **V2** A2A mesh, enterprise marketplace, private registries
