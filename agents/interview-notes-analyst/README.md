# Interview Notes Analyst

Interview Notes Analyst reads several interviews and does the coding work: it finds the themes
bottom-up from what people said, counts how many participants raised each one, keeps the quote
that says it best, separates what several people said from what only one person said, and then
answers the research questions you started with, each with its support and a confidence level.

It never counts a theme a participant did not raise, and it keeps quotes verbatim.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull interview-notes-analyst --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `notes`: the interviews, each with a label line like `[P1 role, company size]`.
- `questions`: what the interviews were meant to answer.

## Output

A JSON object with `summary`, `themes`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `research` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
