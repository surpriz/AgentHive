# Dependency Risk Triage

Reads your `package.json`, lockfile, `requirements.txt` or `pyproject.toml` and tells you which
dependencies are a liability: version ranges that let a compromised release walk in, packages nobody
maintains, names that look like a typo of a popular package, packages with install scripts that run
code on `npm install`, git and URL dependencies, and packages the community knows to avoid.

It does not run `npm audit` and does not replace it. It finds what audit does not: structural risk.
It ends with a minimal upgrade plan, ordered so you can do the first three items in an afternoon.

## Get it

```
npx -y -p @agenthive-sh/cli@0.6.0 agent-cli pull dependency-risk-triage --target claude
```

Run it from your editor agent or any MCP-capable client with the app root as `path`.

## What it needs

- The `filesystem` MCP server (read-only) pointed at the app root.
- The `git` MCP server to find when and in which commit a package arrived.
- Optional: the `github` MCP server with a personal access token, used only when the
  `check_upstream_activity` setting is on, to read a package repository's archived flag and last
  activity. The only network host it may reach is `api.github.com`.
- No code execution, no package installs, no writes.

Optional input: `focus` (package names or manifest paths) and `allowlist` (packages you already
reviewed).

## Output

A JSON object with `summary`, `findings` (each with `file`, `line`, `package`, `category`, evidence
and fix), an ordered `upgrade_plan` and an `inventory`, followed by an eight-line human summary.
