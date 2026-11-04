# Doc Page Writer

Doc Page Writer takes whatever exists about a feature (notes, a PR description, code comments,
a support reply) and writes the page a reader needs: what they can do after reading it, what
they need first, the steps in order with the exact commands or clicks, one example that works
end to end, and the things that go wrong with their fix. It chooses the shape (how-to, reference,
concept) and the level of explanation from the settings, and lists the gaps where the material
did not say enough, instead of guessing.

It writes from the input only; every command, flag and path comes from the material.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull doc-page-writer --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `material`: everything you have about the feature, raw.
- `topic`: what the page covers and who reads it.

## Output

A JSON object with `summary`, `page`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `writing` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
