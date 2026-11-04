# Cold Email Sequence Writer

Cold Email Sequence Writer turns what you paste (your offer in your words, the proof you may
cite, who you are writing to and why now) into a short sequence: a first email, two or three
follow-ups and one LinkedIn note, with send delays, one ask per message and a stop rule the
moment they reply. It writes the way a busy person writes: short, plain, specific to the
trigger, with no "I hope this finds you well", no "it's not X, it's Y" reveals, no triads.

It marks every place where you must personalise before sending and refuses to invent proof,
numbers or customer names you did not give it.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull cold-email-sequence-writer --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `offer`: what you sell and the result, in your words.
- `target`: the segment and the trigger that makes now the right moment.
- `proof` (optional): results you are allowed to cite. Nothing is invented.
- `sender` (optional): who signs.

## Output

A JSON object with `summary`, `sequence`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `growth` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
