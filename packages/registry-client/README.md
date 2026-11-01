# @agenthive-sh/registry-client

Typed client for the [agenthive.sh](https://agenthive.sh) registry. Used by
`@agenthive-sh/cli` and `@agenthive-sh/mcp`; usable on its own from any Node 20+
or edge runtime with `fetch`.

```bash
npm i @agenthive-sh/registry-client
```

```ts
import { RegistryClient } from '@agenthive-sh/registry-client';

const registry = new RegistryClient(); // AGENTHIVE_REGISTRY env overrides the base URL

const hits = await registry.search({ query: 'postgres', grade: 'AA' });
const entry = await registry.get('pg-query-optimizer');
const card = await registry.card('pg-query-optimizer');     // A2A agent card
const yaml = await registry.manifestYaml('pg-query-optimizer');
```

Helpers that do not touch the network:

- `searchEntries(entries, opts)` filters an index you already fetched
- `mcpServerEntry(entry)` builds the `mcpServers` block for Claude Code or Cursor
- `installSnippet(entry, target)` renders the snippet for `claude`, `cursor` or `cli`

Errors are thrown as `RegistryError` with an optional HTTP `status`.

Apache-2.0.
