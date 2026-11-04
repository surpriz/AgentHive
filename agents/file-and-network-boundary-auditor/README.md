# File and Network Boundary Auditor

File and Network Boundary Auditor looks at the four places where a request stops being data and
starts doing something outside the database: a path on disk, a URL the server fetches, a command
the server runs, and HTML the browser renders. For each it follows the request value to the sink
and checks the guard in front of it: is the resolved path inside the upload folder, is the host
allowlisted or only checked for `https://`, is the argument passed to `execFile` or glued into
`exec`, is the string escaped before `dangerouslySetInnerHTML` or `{@html}`.

It is built for the decoy case: a safe helper exists in the project and one route does not use
it. It only reads files and needs the filesystem and git MCP servers pointed at the app root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull file-and-network-boundary-auditor --target claude
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
