# Next.js and Supabase Security Triage

Next.js and Supabase Security Triage is the generalist for the stack most apps written with AI
assistance run on: Next.js App Router with Supabase Auth, PostgREST from the browser, server
actions and route handlers, deployed on Vercel. In one time-boxed pass it covers secrets, access
control, API surface, dependencies and configuration with the checks that matter here: Row Level
Security off or `using (true)`, the service-role key in a client component or a `NEXT_PUBLIC_`
variable, a server action that trusts an id from the form, middleware that protects pages but
not `/api`, an auth callback that redirects to any URL, a webhook parsed before verification.

It ranks by reachability and impact, merges duplicates, and ends with a verdict and a coverage
table. It only reads files and needs the filesystem and git MCP servers pointed at the app root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull nextjs-supabase-security-triage --target claude
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
