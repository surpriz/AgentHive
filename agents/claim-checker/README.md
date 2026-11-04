# Claim Checker

Claim Checker reads a draft, pulls out every statement that can be checked (a number, a date, a
cause-and-effect, an attribution, a superlative), and checks each one against the sources you
paste. For each claim it returns a verdict (supported, contradicted, partly supported, not
covered), the quote from the source that decides it, and when the verdict is bad, the smallest
rewrite that makes the claim honest.

It checks against the pasted sources only. It does not use outside knowledge to confirm or deny,
and it says "not covered" rather than guessing.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull claim-checker --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `text`: the draft.
- `sources`: the material to check against, labelled.

## Output

A JSON object with `summary`, `claims`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `research` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
