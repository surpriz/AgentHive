# API Surface Reviewer

Builds the list of every way a request can reach your server code: Next.js Route Handlers and server
actions, Express and Hono routes, Pages Router API routes, Supabase Edge Functions, webhooks and cron
handlers. For each one it checks what a hostile caller can do: send a body nobody validated, set
fields they should not control (mass assignment), call it ten thousand times a minute, call it from
any website (CORS), read a stack trace or an ORM error, upload any file, or spoof a webhook.

Every finding has a file and line, the one-line request that triggers it, and a fix in the libraries
the app already uses (zod, valibot, Upstash ratelimit, the framework's own CORS and error handling).

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull api-surface-reviewer --target claude
```

Run it from your editor agent or any MCP-capable client with the app root as `path`.

## What it needs

- The `filesystem` MCP server (read-only) pointed at the app root.
- The `git` MCP server to focus on recently changed routes.
- No network access, no write access, no code execution. It never sends a request to your app.

Optional input: `focus` (route prefixes or folders) and `public_origins` (the browser origins that
are meant to call the API, used by the CORS check).

## Output

A JSON object with `summary`, `findings` (each with `endpoint`, `file`, `line`, `category`,
evidence and fix) and an `endpoints` table with one row per route, followed by a ten-line human
summary naming the two systemic fixes that remove the most findings at once.
