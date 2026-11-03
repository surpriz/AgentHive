# Vibe App Security Triage

The first thing to run on an app you built fast and want to put in front of real users. In about
twenty minutes it goes through the four areas where AI-assisted apps most often go wrong: leaked
secrets, missing access control (Supabase RLS, API routes without checks, ids trusted from the URL),
an unguarded API surface (no validation, no rate limits, loose CORS, unsigned webhooks) and risky
dependencies.

It does not try to be complete. It confirms each issue in the source, ranks them by what an attacker
would do first, gives a fix with an effort estimate, and ends with a verdict (`do-not-ship`,
`fix-before-launch`, `ship-with-followups`, `looks-ok`) plus the list of what it did not have time to
check, so the specialist agents know where to go next.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull vibe-app-security-triage --target claude
```

Run it from your editor agent or any MCP-capable client with the app root as `path`. Add one
paragraph of `context` (what the app does, what data it holds, whether it is live): the ranking and
the verdict depend on it.

## What it needs

- The `filesystem` MCP server (read-only) pointed at the app root.
- The `git` MCP server for tracked files, ignore status and history.
- No network access, no write access, no code execution.

Settings let you change the time budget, cap the number of findings, force a stack, or skip areas.

## Related agents

For a deeper pass on one area: `secret-exposure-hunter`, `access-control-auditor`,
`api-surface-reviewer`, `dependency-risk-triage`. This agent's `next_steps` tells you which to run.

## Output

A JSON object with `summary`, `verdict`, ranked `findings` (each with `area`, `effort`, `file`,
`line`, evidence chain and fix), `coverage` per area and `next_steps`, followed by a twelve-line
human summary.
