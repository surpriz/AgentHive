# LinkedIn Profile Opportunities

LinkedIn Profile Opportunities takes the text of a profile and a goal, and answers the question
most people cannot answer about themselves: where is the opening? It reads the experience,
skills and recent posts as evidence, matches them against the goal, and returns a short list of
opportunities that the profile already supports (a role type, a client segment, a partnership, a
content angle, a community to join), each with the evidence from the profile, the single next
step, and the gap in the profile that would stop a reader from believing it.

It works only from what you paste. It never browses LinkedIn, never scrapes, and never invents
companies or people. For each opportunity it says how confident it is and why.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull linkedin-profile-opportunities --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `profile`: the profile text, copied from the page (headline, about, experience, skills, posts).
- `goal`: what you want in the next months, in one or two sentences.
- `constraints` (optional): location, availability, things you refuse.

## Output

A JSON object with `summary`, `opportunities`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `growth` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
