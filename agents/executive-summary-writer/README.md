# Executive Summary Writer

Executive Summary Writer reads the whole document (a report, a proposal, a long thread, meeting
notes) and writes the page a decision maker reads first: the recommendation in the first line,
the three to five facts that support it with where they come from in the text, the risks and
what is still unknown, and the exact ask with its deadline. It writes to the reader's decision,
not to the document's structure, and keeps numbers exactly as they appear.

It does not add information. When the document does not support a recommendation, it says so and
writes a neutral brief instead.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull executive-summary-writer --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `document`: the full text.
- `reader`: who decides, and what they must decide.

## Output

A JSON object with `summary`, `brief`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `writing` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
