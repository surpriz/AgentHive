# SQL Query Explainer

SQL Query Explainer reads a query the way the database does, in logical order (from, joins,
where, group by, having, select, order), and explains each part in plain words. Then it states
what one row of the result represents and checks the query against the mistakes that produce
plausible wrong numbers: a left join cancelled by a where clause, a join that multiplies rows,
COUNT(*) counting the wrong thing, NULLs dropped by a comparison, a date range that misses the
last day, a window function partitioned on the wrong key.

For every warning it gives the one check query that would confirm or clear it.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull sql-query-explainer --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `query`: the SQL.
- `intent` (optional): what it should compute; warnings compare the query to it.
- `schema` (optional): tables and their grain; it makes join warnings precise.

## Output

A JSON object with `summary`, `explanation`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `data-analysis` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
