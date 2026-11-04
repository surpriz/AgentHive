# Competitive Landscape Mapper

Competitive Landscape Mapper takes your notes about a set of players and organises them: it
picks the few axes that matter for the decision you named, fills a comparison table from the
notes (and marks the cells the notes do not fill), groups players that compete on the same
thing, and names the open spaces and the crowded ones. It separates competitors from potential
partners when the question asks.

It uses only the notes you paste. Empty cells stay empty; it does not fill them from memory.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull competitive-landscape-mapper --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `players`: notes per player with a label line `[Name]`.
- `question`: the decision the map should inform.

## Output

A JSON object with `summary`, `table`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `research` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
