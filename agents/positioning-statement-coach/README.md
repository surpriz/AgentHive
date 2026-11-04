# Positioning Statement Coach

Positioning Statement Coach takes the notes you already have (what the product does, who buys
it and what they did before, who you lose to) and produces a positioning you can defend in a
sentence: the category you choose to be compared in, the customer you choose to serve first,
the alternative you are unlike, and the reason a customer should believe it. It lists the proofs
the statement needs, the messaging it rules out, and the alternatives it rejected and why, so the
choice is a choice and not a slogan.

It works from your input only; it does not know your market beyond what you paste, and says
where that limits the answer.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull positioning-statement-coach --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `product`: what it does and what you believe is different, in your words.
- `customers`: who buys, what they used before, why they switched, who churned.
- `competitors` (optional): who you lose to and how they describe themselves.

## Output

A JSON object with `summary`, `positioning`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `growth` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
