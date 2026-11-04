# Metrics Definition Reviewer

Metrics Definition Reviewer takes the way your metrics are currently defined (a glossary, a
dashboard tooltip, a thread) and makes each one explicit: numerator, denominator, grain, time
window, filters, source system. Then it lists what is still ambiguous (logged in by whom, lost
when, counted in which currency), the edge cases nobody decided (trials, refunds, reactivations,
time zones), and proposes a definition precise enough that two analysts would get the same
number.

It flags conflicts between metrics defined on different bases, and it never picks a business
rule for you: edge cases come back as questions with the options.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull metrics-definition-reviewer --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `definitions`: the metrics as written today.
- `context` (optional): the business and the systems; it makes edge cases concrete.

## Output

A JSON object with `summary`, `metrics`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `data-analysis` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
