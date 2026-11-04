# Competitor Teardown

Competitor Teardown turns public material you collected about a competitor (their pages, pricing,
changelog, job posts, review excerpts) into a structured read: what they claim to be, which
segments they serve and court, how their pricing is built and what it signals, what proof they
show, what they shipped or hired for recently, and the weaknesses a focused player can use. It
ends with recommendations tied to the decision you said you are making.

Every statement cites the pasted piece it comes from; nothing is inferred about the competitor
from outside the input, and the output never includes text meant to pass as the competitor's.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull competitor-teardown --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `material`: the public text you collected, with a label per piece ([home], [pricing], [changelog], [jobs], [reviews]).
- `our_context`: who you are and the decision this should inform.

## Output

A JSON object with `summary`, `teardown`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `growth` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
