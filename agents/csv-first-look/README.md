# CSV First Look

CSV First Look is the ten minutes you should spend before analysing a table and usually do not.
From a pasted sample it names what each column holds and what role it plays (identifier,
dimension, measure, date), then lists what is wrong: blanks, duplicated keys, mixed date formats,
case variants of the same value, numbers stored as text, outliers that look like unit errors.
It ends with the questions the table can answer as is, the ones it cannot, and the fix for each
issue.

It reasons on the rows you paste; it says when a sample is too small to judge a column.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull csv-first-look --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `data`: the CSV text with a header, or a pasted table.
- `goal` (optional): what you want to learn; the can/cannot answer lists use it.

## Output

A JSON object with `summary`, `columns`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `data-analysis` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
