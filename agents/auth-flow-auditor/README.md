# Auth Flow Auditor

Auth Flow Auditor reads every path that turns a visitor into a user and a user into something
more: sign-up, login, password reset, magic links, OAuth callbacks, session cookies and the
JWT helpers behind them. For each it asks the questions AI-written auth code gets wrong: is the
token's signature verified with a real secret, does the code accept the algorithm the token
declares, does the reset link expire, can the redirect after login point off-site, can the role
be chosen by the person signing up, and can anyone try ten thousand passwords in a minute.

It only reads files. It needs the filesystem and git MCP servers pointed at the app root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull auth-flow-auditor --target claude
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
