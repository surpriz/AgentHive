# Source Synthesis

Source Synthesis takes the excerpts you paste, each with a label, and one question, and writes
the brief a careful analyst would: findings that answer the question, each with the citations
that support it and a confidence level; the places where sources disagree, with each position
attributed; what the question needs that the sources do not cover; and a note per source on
what kind of evidence it is and how much to trust it.

It uses only the pasted text. It does not know the sources beyond the excerpts, and it says so
when an excerpt is too thin to carry a claim.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull source-synthesis --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `sources`: the excerpts, one label per source on its own line, like `[S1 Author, Year, Type]`.
- `question`: the one question to answer.

## Output

A JSON object with `summary`, `findings`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `research` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
