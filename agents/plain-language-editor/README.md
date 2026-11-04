# Plain Language Editor

Plain Language Editor rewrites a text so a named reader understands it on first reading and
knows what to do. It shortens sentences, replaces abstract and formal words with concrete ones,
puts the action first, keeps every fact, date and obligation, and keeps the technical terms the
reader needs (with a definition the first time). It reports the before and after sentence
length and lists the terms it chose to keep.

It changes words and structure, never the rules or commitments in the text.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull plain-language-editor --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `text`: what to rewrite.
- `reader`: who reads it and what they must do afterwards.

## Output

A JSON object with `summary`, `rewritten`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `writing` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
