# Experiment Results Reader

Experiment Results Reader takes the numbers from an A/B test and does what a careful analyst
does before anyone celebrates: computes the lift and the confidence interval from the counts,
checks whether the sample ratio matches the allocation, whether the test ran its planned
duration and full weeks, whether the result was read early, and whether segment effects are
real or the product of slicing. It then gives one of four verdicts (ship, extend, stop, invalid)
with the reason, and lists what could still make the result wrong.

It computes from the counts you paste and shows its arithmetic; it does not know your product.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull experiment-results-reader --target claude
```

It runs in Claude Code, Cursor or Codex as a plain prompt with its skill: no MCP server, nothing
runs on your machine. Paste the input into the chat, or point the agent at a file with it.

## What it needs

- `results`: users and conversions per variant, duration, start day, segments if any.
- `setup` (optional): hypothesis, primary metric, planned sample and duration, allocation.

## Output

A JSON object with `summary`, `validity_checks`, the `assumptions` it had to make and the
`questions` it would ask you, followed by the human-readable version.

## Status

No trial covers the `data-analysis` goal yet, so this package carries the "untested" badge: the
registry has checked it (secrets, versions, completeness) but has not measured its results.
