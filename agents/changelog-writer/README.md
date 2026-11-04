# Changelog Writer

Changelog Writer reads the raw material of a release (commit messages, PR titles, ticket notes)
and writes the notes the audience will actually read. It drops what the audience does not care
about (refactors, CI, dependency bumps, unless asked), groups the rest by what it changes for
them, puts breaking changes first with what to do, writes each item as an outcome in the
audience's words, keeps the references, and gives the release a one-line headline.

It never invents a change: every item traces back to a line in the input.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull changelog-writer --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `changes`: the raw lines, one change per line, with ids if you want them cited.
- `product` (optional): what it is and who uses it.
- `version` (optional): the version or date.

## Output

A JSON object with `summary`, `notes`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `writing` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
