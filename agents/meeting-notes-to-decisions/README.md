# Meeting Notes to Decisions

Meeting Notes to Decisions reads what was typed or transcribed during a meeting and produces the
record: what was decided, by whom and why (quoting the line), what each person committed to and
by when, what stayed open, and what was only discussed so it does not get mistaken for a
decision. It writes the recap to send, in the shape of the channel (Slack, email, doc), short
enough that people read it.

It never promotes a discussion to a decision, and it flags actions with no owner or no date
instead of inventing them.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull meeting-notes-to-decisions --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `notes`: raw notes or a transcript.
- `attendees` (optional): names and roles.
- `purpose` (optional): what the meeting was meant to decide.

## Output

A JSON object with `summary`, `decisions`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `research` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
