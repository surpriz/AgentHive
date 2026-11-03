# Secret Exposure Hunter

Finds credentials that have leaked into a web app's repository: committed `.env` files, API keys pasted
into source, server-only keys that end up in the browser bundle, tokens printed by `console.log`, and
secrets deleted from the tree but still present in git history.

Built for apps written fast on Next.js, Supabase, Express, Prisma and Vercel. It knows a Supabase anon
key is public by design and a `service_role` key never is, tells placeholders from live values, and
gives you a rotation checklist ordered by blast radius.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull secret-exposure-hunter --target claude
```

Then run it from your editor agent or any MCP-capable client with the app root as `path`.

## What it needs

- The `filesystem` MCP server (read-only) pointed at the app root.
- The `git` MCP server for history and ignore checks.
- No network access, no write access, no code execution.

Optional input: `focus` (paths to look at first) and `known_public_vars` (env names you know are
public, so they are not reported).

## Output

A JSON object with `summary`, `findings` (each with `file`, `line`, redacted `evidence`, `fix`, `kind`
and `exposure`) and a `rotation_checklist`, followed by an eight-line human summary.
