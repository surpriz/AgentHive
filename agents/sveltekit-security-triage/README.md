# SvelteKit Security Triage

SvelteKit Security Triage is the generalist for SvelteKit apps, usually on Drizzle or Prisma with
Lucia, Auth.js or a hand-rolled session. In one time-boxed pass it covers secrets, access control,
API surface, dependencies and configuration with checks written for the framework: the `load` in
`+page.server.ts` that reads any row by id while the actions next to it are scoped, the
`+server.ts` endpoint outside the `hooks.server.ts` guard, `{@html}` on Markdown nobody
sanitised, `handleError` returning the stack, a redirect built from a query parameter, a server
key under `$env/static/public`, a webhook parsed before its signature check.

It ranks by reachability and impact, merges duplicates, and ends with a verdict and a coverage
table. It only reads files and needs the filesystem and git MCP servers pointed at the app root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull sveltekit-security-triage --target claude
```

Run it from your editor agent or any MCP-capable client with the app root as `path`.

## What it needs

- The `filesystem` MCP server (read-only) pointed at the app root.
- The `git` MCP server for tracked files, ignore status and history.
- No network access, no write access, no code execution, no database connection.

Optional input: `focus` (files, folders or routes first) and `context` (who uses the app, what data
it holds, whether it is live), which drives severity.

## Output

A JSON object with `summary` and `findings` (each with `file`, `line`, `category`, an evidence chain
and a concrete fix), a `verdict`, a `coverage` row per area and `next_steps`, followed by a short human summary.
