# AI Tell Remover

AI Tell Remover edits a text so it no longer carries the fingerprints of generated prose: the
"it's not X, it's Y" reveal, lists of three for rhythm, em dashes as glue, "in today's fast-paced
world", "let's dive in", hedges stacked on hedges, every sentence the same length, a closing
line that restates the paragraph. It keeps the meaning and the author's facts, changes only
what reads as a pattern, and returns the edited text next to a list of each change and the tell
it removed, so the author learns the patterns too.

It will not add facts, claims or jokes, and it will not change the register unless asked.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull ai-tell-remover --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `text`: the text to edit.
- `audience` (optional): who reads it and where; it sets how short the sentences can get.

## Output

A JSON object with `summary`, `edited`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `writing` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
