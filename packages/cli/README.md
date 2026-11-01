# @agenthive-sh/cli · `agent-cli`

```sh
npx @agenthive-sh/cli search sql
agent-cli search -g AAA -c "Security & Audit"
agent-cli info pg-query-optimizer
agent-cli manifest eu-ai-act-auditor
agent-cli add pg-query-optimizer                      # → ~/.claude.json
agent-cli add dbforge/pg-query-optimizer@3.0.4 -t claude-project   # → ./.mcp.json
agent-cli add pg-query-optimizer -t cursor            # → ./.cursor/mcp.json
agent-cli add pg-query-optimizer --print --target cursor   # .cursorrules block
agent-cli setup                                       # installs the catalog MCP server (@agenthive-sh/mcp)
```

`add` merges one `mcpServers` entry into the target file and leaves everything else untouched. `--dry-run` prints the result instead of writing.

`serve <ref>` is reserved for the V1 runtime and exits with code 2 today.

Registry: `--registry <url>` or `AGENTHIVE_REGISTRY` (default `https://agenthive.sh`).
