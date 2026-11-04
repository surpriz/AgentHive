# Express and Mongo Security Triage

Express and Mongo Security Triage is the generalist for Node APIs on MongoDB. In one time-boxed
pass it covers secrets, access control, API surface, dependencies and configuration, with checks
written for this stack: a router mounted without the auth middleware, `req.body` passed to
`find()` or `findOne()` so an operator object matches everything, `$where` with a string from the
request, `role` accepted at sign-up, `findByIdAndUpdate(id, req.body)`, the error handler that
returns `err.stack`, a webhook that trusts its body.

It ranks by reachability and impact, merges duplicates, and ends with a verdict and a coverage
table. It only reads files and needs the filesystem and git MCP servers pointed at the app root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull express-mongo-security-triage --target claude
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
