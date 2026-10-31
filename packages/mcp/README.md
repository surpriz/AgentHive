# @agenthive/mcp

MCP server (stdio) that puts the agenthive.sh registry inside Claude Code, Cursor or any MCP client. Catalog only in V0: search, inspect, get install snippets. Running agents arrives with the V1 runtime.

## Tools

| Tool | Does |
|---|---|
| `search_agents` | keyword + framework / category / grade filters |
| `get_agent` | A2A agent card with schemas and benchmark |
| `get_manifest` | AgentHive YAML manifest |
| `install_snippet` | config for `claude`, `cursor` or `cli` |

Resource `agenthive://registry` returns the whole index as JSON.

## Install in Claude Code

```json
{
  "mcpServers": {
    "agenthive": {
      "command": "npx",
      "args": ["-y", "@agenthive/mcp"]
    }
  }
}
```

Point it at a local registry with `AGENTHIVE_REGISTRY=http://localhost:5173` in `env`.

Then ask: "find me an agent that tunes Postgres queries and give me the Claude Code snippet".
