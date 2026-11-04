# FastAPI Security Triage

FastAPI Security Triage is the generalist for Python web apps. In one time-boxed pass it covers
the five areas that matter before launch (secrets, access control, API surface, dependencies,
configuration) with checks written for the Python stack: a `Depends(current_user)` missing on one
route, `jwt.decode` with the algorithm taken from the token, `text()` with an f-string, a
Pydantic model that accepts `is_admin`, `subprocess` with `shell=True`, a `/docs` or debug
route left open, `verify=False` on an outbound call.

It ranks what it finds by who can reach it and what they get, merges duplicates, and ends with a
verdict and an honest coverage table. It only reads files and needs the filesystem and git MCP
servers pointed at the app root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull fastapi-security-triage --target claude
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
