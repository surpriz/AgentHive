# Spreadsheet Formula Auditor

Spreadsheet Formula Auditor reads formulas with their addresses and the layout you describe,
traces which cells feed the outputs that matter, and finds the mistakes that do not raise an
error: a SUM that stops one row short, a lookup without exact match, a constant typed into a
formula instead of a cell, a relative reference copied where an absolute one was needed, a
percentage divided by the wrong base, totals that mix units. Each finding names the cell, the
problem, how much it can change the output, and the corrected formula.

It works from the text you paste; it cannot see values, so it says when a check needs one.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull spreadsheet-formula-auditor --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `formulas`: cell addresses with formulas, one per line, and the layout (what rows and columns hold).
- `purpose` (optional): the output cells that matter.

## Output

A JSON object with `summary`, `findings`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `data-analysis` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
