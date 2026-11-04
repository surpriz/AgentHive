# Worker and Cron Auditor

Worker and Cron Auditor is for the code nobody reviews because no user ever sees it: the nightly
export, the notifier, the queue consumer, the scheduler, and the small internal API that triggers
them. It checks what the job logs at startup and on error (configs with keys in them), what it
executes (`exec` with a tenant name or a file path in the string), how it talks to the outside
(TLS verification off for a partner, webhooks to stored URLs without host checks, shared secrets
sent in the URL), where it writes (export paths built from tenant data), and who can trigger it
(an admin endpoint behind a header nobody rotates, or behind nothing).

It only reads files and needs the filesystem and git MCP servers pointed at the project root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull worker-and-cron-auditor --target claude
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
and a concrete fix), followed by a short human summary.
