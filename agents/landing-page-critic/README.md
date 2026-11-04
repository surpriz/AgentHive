# Landing Page Critic

Landing Page Critic reads the copy of a page the way its visitor does: in order, in a hurry, with
one question in mind ("is this for me and does it do what I came for?"). From the audience, the
traffic source and the goal, it finds the exact lines where the visitor stops believing or stops
reading, ranks the fixes by expected impact on the one action the page exists for, and rewrites
the lines that matter most in plain words that the audience would use.

It judges copy and structure, not design or load time. It never invents proof: if the page needs
a number it does not have, the fix says what to measure.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull landing-page-critic --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `page`: the page text in reading order. Copy it from the page, including CTAs and proof.
- `audience`: who lands here, from where, and what they already believe.
- `goal` (optional): the one action the page should produce.

## Output

A JSON object with `summary`, `fixes`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `growth` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
