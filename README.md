# AgentHive · agenthive.sh

The registry for interoperable AI agents. V0: public catalog, A2A/MCP manifests, CLI install snippets, live sandbox simulation, publish flow.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · lucide-react. No backend, mock data in `src/data`.

## Run

```sh
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # type-check + production bundle in dist/
```

## Layout

```
src/
  App.tsx                      state: filters, selected agent, publish modal
  types.ts                     Agent, Framework, Category, SecurityGrade, SandboxStep
  data/mockAgents.ts           6 seed agents
  data/sandboxScenarios.ts     scripted reasoning chains per agent
  lib/filters.ts               search + chip filters
  lib/manifest.ts              YAML manifest, .claude.json, .cursorrules, CLI snippets
  components/                  Navbar, FilterBar, AgentCard, AgentGrid, AgentDetailModal, PublishModal
  components/tabs/             OverviewTab, ManifestTab, SandboxView
  components/ui/               Badge, CodeBlock, Modal, Tabs
```

## Roadmap

- **V0** catalog + registry, universal MCP server, developer CLI
- **V1** managed serverless runtime, reasoning logs, automatic security audit, pay-as-you-go
- **V2** A2A mesh, enterprise marketplace, private registries
