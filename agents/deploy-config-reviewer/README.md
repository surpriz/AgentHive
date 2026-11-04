# Deploy Config Reviewer

Deploy Config Reviewer looks at everything that is true about your app before a single user
signs in: the CORS policy, the security headers, the routes that dump the environment or expose
internals, the catch blocks that send stack traces to the browser, the TLS checks switched off
"for now", the env files committed to the repository and the keys that reach the client bundle.

These are the mistakes that come from copying a config from a tutorial and never reading it
again. Each finding names the file, the line and the exact value to change. It only reads files
and needs the filesystem and git MCP servers pointed at the app root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull deploy-config-reviewer --target claude
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
