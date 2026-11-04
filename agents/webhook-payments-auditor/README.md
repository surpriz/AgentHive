# Webhook and Payments Auditor

Webhook and Payments Auditor reads the two places where money meets your code: the webhook
receivers that providers call to say "this was paid", and the routes that start a payment or show
an invoice. It checks that every receiver verifies the provider's signature on the raw body with a
secret that exists, that an event cannot be replayed to mark things paid twice, that amounts and
prices come from your database rather than the client, and that an invoice or subscription can
only be paid, viewed or cancelled by its owner.

The comment that says "verified upstream" is not a check. The auditor reads the code and tells you
what a forged POST would do. It only reads files and needs the filesystem and git MCP servers
pointed at the app root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull webhook-payments-auditor --target claude
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
