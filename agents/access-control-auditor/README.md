# Access Control Auditor

Answers one question for every piece of data in your app: who can read or change it, and did the code
actually check? It maps API routes, server actions, Supabase queries, Prisma calls and Express
handlers, then checks each for authentication, authorization and object scoping (is the row the
caller's own?).

Dedicated checks for the mistakes AI-assisted apps make most: Supabase tables with Row Level Security
off or a `using (true)` policy, the `service_role` client used inside a request handler, Next.js
middleware that protects pages but not `/api`, admin flags read from the request or `user_metadata`,
and ids taken from the URL and passed straight to the database.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull access-control-auditor --target claude
```

Run it from your editor agent or any MCP-capable client with the app root as `path`.

## What it needs

- The `filesystem` MCP server (read-only) pointed at the app root.
- The `git` MCP server to spot recently removed checks.
- No network access, no write access, no code execution, no database connection.

Optional input: `focus` (routes, folders or table names first) and `roles` (the role names your app
uses, so the auditor knows what to look for).

## Output

A JSON object with `summary`, `findings` (each with `file`, `line`, `category`, an evidence chain
and a concrete fix, SQL included for RLS) and an `access_map` with one row per entry point, followed
by a ten-line human summary.
