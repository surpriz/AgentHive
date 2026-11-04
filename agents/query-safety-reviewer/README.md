# Query Safety Reviewer

Query Safety Reviewer follows every value that comes from a request (params, query string, body,
headers, cookies) into the database layer and asks whether it can change the shape of the query
rather than just its values. It knows the escape hatches of each library: `$queryRawUnsafe` and
`$executeRawUnsafe` in Prisma, `sql.raw` in Drizzle, `.rpc` and `.filter` string operators in
Supabase, `$where` and operator objects in Mongo, `text()` and f-strings in SQLAlchemy, and
plain string concatenation everywhere.

It also catches the quieter mistake of spreading a request body into a create or update, which
lets a client set columns it was never meant to touch. It only reads files and needs the
filesystem and git MCP servers pointed at the app root.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull query-safety-reviewer --target claude
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
