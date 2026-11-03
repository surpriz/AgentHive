# v2 — the proving ground: trials, declarative packages, one-click retrieval

Status: design, written 2026-11-02 and revised 2026-11-03 from `../VISION.md`.
Decided by the project owner: declarative agents first and `owner/name` names
(2026-11-02), a first pool of agents built by AgentHive and the proving-ground
direction, trials instead of a trust layer, which replaces the 2026-11-02 strategy
(2026-11-03).
Everything marked (proposed) is the builder's call; numbers marked (tbd) are
placeholders until prices and tool behaviours are verified. Replaces the v1
decision "AgentHive exposes agents, it does not host them".

## Intent

AgentHive is the proving ground for AI agents: for each professional goal it
publishes a trial, a set of realistic tasks with verifiable results, runs every
submitted agent through the same trial and publishes which one does the job, at
what cost, with what variance. The package format, retrieval and remix exist so
the winner can be installed and improved.

A visitor reads the ranking, watches recorded runs, retrieves the agent into
Cursor, Claude Code or Codex in one action, adapts it and resubmits it to the
trial under their own name with visible lineage.

## Goals

- One trial done well in six months: code and security audit of vibe-coded demo
  apps with planted flaws, public methodology, private rotating tasks, several runs
  per agent with cost and variance shown.
- A package format that is a thin layer over SKILL.md and MCP, with no code of its own.
- Names under an owner namespace, so forks and organisations have a home.
- A first pool of 5 to 10 agents built by AgentHive, marked as baselines, then
  third-party submissions.
- Trust that does not overclaim: static checks shown as a list, and trial traps
  (injection, exfiltration) reported as "resisted X of Y", never as a letter.
- Recorded trial runs on every card; live runs are a bonus, not a prerequisite.
- Retrieval into Claude Code and Cursor, then Codex, in one action, with permissions
  shown first.
- Fork and resubmit with lineage, scores never inherited.
- Neutrality rules: no paid ranking, no paid badge. Revenue comes from private
  trials, later.

## Non-goals (v2)

- Agents that ship their own code (LangGraph, CrewAI, custom loops). They stay in the
  "hosted by the author" mode through the existing gateway, without fork. Uploaded
  code and local containers come later, if at all.
- A marketplace, creator payouts, Stripe.
- The general public. No consumer chat surface.
- Beating MCP directories on volume, and indexing public skills or MCP servers as
  the main bet (skills.sh, Glama and Snyk already do it).
- A live sandbox and an on-site fork editor before the trial has third-party
  submissions.
- A prompt-injection scanner. We do not claim to detect malicious instructions written
  in natural language.
- Connecting the sandbox to a visitor's own accounts or data.

## Decided versus proposed

| Topic | Status | Content |
|---|---|---|
| Declarative agents first | decided | prompt + skills + pinned MCP + typed settings, no code in the agent |
| `owner/name` | decided | every artifact lives under a user or organisation; flat names redirect |
| First pool of agents | decided | 5 to 10 agents built by AgentHive, plus open-source assemblies with credit |
| First goal | decided | code and security audit |
| Proving-ground positioning | decided | trials and rankings first; indexing dropped as the main bet; sandbox and fork after submissions |
| Package layout | proposed | `agent.yaml`, `prompt.md`, `skills/`, `examples/` |
| Three artifact kinds | proposed | `Agent`, `Skill`, `McpServer`; `Prompt` folded into `Agent` |
| Storage in Postgres | proposed | packages are text and small; no object storage in v2 |
| Trust display | proposed | "checks" with a list, grade letters retired for declarative kinds |
| Sandbox provider and model | open | after a pricing check, within ~300 EUR/month |
| Retrieval form per tool | open | command or copy-prompt, deep links to verify |
| Licences allowed for fork | proposed | MIT, Apache-2.0, BSD-2/3, CC-BY-4.0, CC0 |

## Artifact kinds

`kind` already exists in the manifest with `Agent` as its only value. v2 adds two.

| Kind | Contains | Who runs it | Measured by |
|---|---|---|---|
| `Agent` | prompt, settings, copied skills, pinned MCP references, examples, tests | the sandbox, or the user's tool | checks, benchmark in the sandbox |
| `Skill` | a `SKILL.md` and optional resources, no scripts in v2 | the user's own agent | checks, optional eval (later) |
| `McpServer` | a reference to a published package (npm or PyPI) with pinned version, declared tools and permissions | the user's tool | checks, protocol probes (later) |

Prompts without skills or MCP are an `Agent` with an empty `bricks` list. One kind
fewer to explain.

Leaderboards rank within a kind and a goal, never across kinds.

## Names

Names become `owner/name`:

- `owner` is a user login or an organisation slug, 2 to 39 characters, same rules as
  GitHub logins so an imported artifact can keep its author's handle.
- `name` keeps the v1 rule: kebab-case, 3 to 48 characters.
- The first publisher of `owner/name` owns it. There is no race for short names any
  more, so the v1 "first publisher owns the name" rule in `server/publish.ts`
  survives unchanged under the namespace.
- Flat v1 names redirect: `/agents/cron-translator` → `/agents/surpriz/cron-translator`
  (HTTP 301), same for the JSON endpoints and the CLI, which prints the new name once.
- Seeds are removed, not migrated.
- Reserved owners: `agenthive`, `system`, `admin`, `api`, `docs`, and the existing
  system caller names used by the benchmark.

Indexed artifacts (see Indexing) live under the handle of their upstream author with
an `unclaimed` flag, and are claimed by signing in with the matching GitHub login.
An unclaimed page says so.

Database: `agents.owner` column, unique index on `(owner, name)` replacing
`agents_name_idx`, `agent_versions` unchanged (already immutable per version).
Migration backfills `owner` from the publishing user's login.

## Package

```
my-agent/
  agent.yaml            manifest, apiVersion agenthive.sh/v2
  prompt.md             the agent's logic, with {{setting}} placeholders
  skills/<name>/SKILL.md   skills copied into the package
  examples/             example inputs the sandbox and the Run tab start from
  README.md             optional, shown on the card
```

- Text only. Every file must be UTF-8 and under 256 KiB; the package under 2 MiB
  (proposed). Binary files are rejected. This keeps the package inside Vercel's
  request body limit and in a `jsonb` column, and makes "show it as text before
  install" trivially true.
- A version is immutable, stored with its SHA-256 over the canonical archive.
  Withdrawing a version hides it and leaves a tombstone. This is how
  `agent_versions` already behaves; the row gains `files jsonb` and `sha256`.
- `agent-cli push <dir>` sends the manifest plus the files; the web upload form
  accepts a zip or a folder drop with the same validation.

### Manifest (`agenthive.sh/v2`)

```yaml
apiVersion: agenthive.sh/v2
kind: Agent
metadata:
  name: vibe-code-audit             # owner comes from the publishing account
  version: 1.0.0
  license: MIT
  goal: code-audit                  # replaces category for Agent; see Goals
  value: Finds exposed secrets and broken access control in a vibe-coded app.
  tagline: ...
  tags: [security, nextjs, supabase]
spec:
  model:
    requires: { toolCalling: true, minContextTokens: 32000 }
    recommended: [claude-haiku-5-5]   # informative, shown on the card
  settings:                           # typed, rendered as a form, injected into prompt.md
    - { name: severity_floor, type: enum, values: [low, medium, high], default: medium }
    - { name: max_findings, type: integer, min: 1, max: 50, default: 10 }
  bricks:
    skills: [owasp-top-10, secret-patterns]           # must exist under skills/
    mcp:
      - { name: filesystem, package: npm:@modelcontextprotocol/server-filesystem@2026.1.3, permissions: { filesystem: read } }
      - { name: github, package: npm:@modelcontextprotocol/server-github@2026.2.0, env: [GITHUB_TOKEN], permissions: { network: [api.github.com] } }
  io:
    input: { ...json schema... }
    output: { ...json schema... }
  tests:                              # unchanged from v1.3
    - { name: finds the leaked key, input: { repo: examples/leaky-app }, expect: { jsonPath: { path: findings.length, min: 1 } } }
```

- `spec.endpoint`, `spec.transport` and `spec.framework` are v1 fields for the
  hosted mode. A v2 `Agent` has none of them; a manifest with `endpoint` keeps
  `apiVersion: agenthive.sh/v1` and the gateway path, and cannot be forked.
- MCP references are `npm:` or `pypi:` with an exact version. Git URLs are not
  accepted in v2, because the audit cannot pin them.
- Env names are declared, values never. A package containing anything that looks
  like a secret is rejected at publish, as today.
- Settings are the only templating. `prompt.md` placeholders must match a declared
  setting; unknown placeholders fail validation.

### Goals

`metadata.category` becomes `metadata.goal` for `Agent`, a closed list that starts
small and grows with supply: `code-audit`, `code-review`, `data-analysis`,
`financial-analysis`, `growth`, `devops`, `research`, `writing` (proposed). The v1
categories map onto it for the redirect period. Skills and MCP servers keep a
`category` since they are components, not goals.

## Indexing existing artifacts (deferred)

Dropped as the main bet on 2026-11-03: skills.sh, Glama and a dozen trust-score
projects already index and score components. Kept here as an optional complement
once the trial exists, mainly to give indexed MCP authors a page to claim when
their server ranks in a trial. If built, it works as follows:

- Sources: the official MCP registry, npm and PyPI packages tagged as MCP servers,
  GitHub repositories with a `SKILL.md` (tbd: exact queries and allowlist of
  sources). Pulled by a scheduled job on the existing cron, batched, budgeted.
- Each indexed artifact gets a page under its author's handle, marked `unclaimed`,
  with its checks, its declared tools and permissions, and a link upstream. Nothing
  is copied beyond what the checks need; the page links to the source.
- Claiming: sign in with the matching GitHub login. The claimant can then publish
  versions, add tests and examples, or ask for removal.
- Removal on request from the upstream author, no questions asked, within 48 hours.
- The audit engine already reads a public repository (`spec.source` in v1, OSV on
  dependencies, secret scan); indexing reuses it with the same budgets and the
  same safe fetch.

This is the international content of month one, and the search-engine entry
"is `<thing>` safe to install".

## Trust

### What the checks say

For declarative kinds the word "grade" and the letters AAA to B are retired. A card
shows **checks**: a list, each passed or failed with a one-line reason, and a
single summary line.

| Check | Applies to | What it verifies |
|---|---|---|
| secrets | all | no secret-looking strings in any file (existing `secrets` check, widened to the package) |
| pinned bricks | Agent | every MCP reference has an exact version and resolves on npm or PyPI |
| known vulnerabilities | Agent, McpServer | OSV on the pinned packages and their lockfile when published (existing `dependencies` check) |
| permissions declared | Agent, McpServer | every MCP reference declares permissions; network hosts are explicit |
| no scripts | Skill, Agent | skills carry no executable files in v2 |
| completeness | all | value, tagline, tests or examples present, licence in the allowed list |
| upstream reachable | McpServer, indexed | the package or repository exists and matches the declared version |

The summary line is honest by construction: "7 checks passed. These checks do not
read the prompt for intent; install only what you have read." The `endpoint` check
and the latency probes stay in the hosted mode only.

The existing score, caps and `docs/GRADING.md` apply to the hosted mode until it
is retired; a new `docs/CHECKS.md` describes the list above.

### Before install

Retrieval shows, before anything is copied: every MCP server with its permissions
and env names, every skill as text, the prompt as text, and the licence. A package
with a failed `secrets`, `pinned bricks` or `no scripts` check cannot be retrieved
nor run live; the card says which check blocks it.

### Moderation and terms

Required before the public upload form opens, and before any community promotion:
report button on every card, takedown with a tombstone, repeat-offender bans,
name-squatting rule (an owner inactive for 12 months with an empty namespace can be
reclaimed), terms of service and a notice-and-action process reviewed by a lawyer,
because the service is operated from the EU and hosts instructions third parties
execute. Publishing is already open to any GitHub account today; this item closes
that gap.

## Trials

A trial is the unit of measurement and the product. One per professional goal.

- **Tasks.** Realistic, with a verifiable result. For `code-audit`: demo
  applications with planted flaws (secret in a client bundle, missing row-level
  security, open redirect, IDOR, prompt-injection trap in a README). A public part,
  shown with the methodology, and a private rotating part, so authors cannot tune
  for the test. Ratio and rotation cadence: tbd.
- **Harness.** Open source, in this repository. It loads a declarative package
  (prompt with default settings, copied skills, pinned MCP servers from the
  validated list), runs it on a reference model against each task, and scores the
  output with a deterministic checker per task. Protocol published.
- **Runs.** Several per agent per task (tbd: 3 to 5), with mean and spread shown.
  Each run records model, cost, time and the full trace. Runs are the recorded
  examples on the card; nothing is run twice for display.
- **Traps.** Security traps are scored separately and shown as "resisted X of Y".
- **Ranking.** Per trial. Columns: score, spread, cost per task, time, model.
  AgentHive's own agents are marked as baselines. A single reference model at
  first; per-model and per-tool rankings when the budget allows (open question).
- **Neutrality.** No paid ranking, no paid badge, ever. Private trials (see Teams)
  never feed the public ranking.
- **Submission.** `agent-cli push` of a package to a trial, or the web form. The
  trial runs on the next batch; batches are scheduled to stay under the monthly cap.
- **Report.** A monthly results page, citable, with the methodology version.

The v1.3 author cases (`spec.tests`) stay as the author's own smoke tests, labelled
as such, and never enter a ranking.

## Measurement

### Where the benchmark runs

The v1.3 benchmark calls the author's endpoint through the gateway. In v2 the
benchmark of an `Agent` runs in the sandbox: AgentHive's agent loop loads the
prompt with default settings, the copied skills and the pinned MCP servers from the
validated list, on the sandbox model, and runs the author's `spec.tests`. The gate
(one claim per 24 hours, atomic `benchmark_at`), the retention, the version-guarded
score write and the owner re-run endpoint in `server/benchmark.ts` are unchanged;
only the executor behind `runBenchmark` changes.

Liveness, malformed-input and latency probes are hosted-mode probes and are skipped
for packages. Each run records the model and the date; the card shows
`claude-haiku-5-5 · 6/8 · 2026-11-20` (model tbd).

### Who wrote the cases

Every result says so: author, registry or community.

- **Author cases** (`spec.tests`): the baseline, labelled as the author's.
- **Registry cases**: for the first goal, a set of demo applications with planted,
  known vulnerabilities (secret in client bundle, missing row-level security, open
  redirect, IDOR). Each `code-audit` agent runs on them; only these results enter
  the leaderboard's top tier. The set is private; a rotating public sample is shown.
- **Community cases**: any signed-in user proposes a case on an artifact; the
  author can dispute, not delete. Later than v2's first release (proposed).

Task contracts (`summarize.v1` style) are kept as the mechanism for other goals and
added when a goal has enough agents to justify one.

### Recorded examples, live trial, own key

Three levels on every card, none needing the author's machine:

1. **Recorded examples**: the benchmark's runs, with input, output, trace, model and
   date. Real, labelled as recordings, zero marginal cost. Outputs are scrubbed
   of secret-looking strings before display. Only test cases and `examples/` are
   shown, never a visitor's input.
2. **Live trial**: a run in the sandbox on AgentHive's model, labelled as such.
   Requires sign-in. Caps: per-run tokens and steps, per-account daily runs,
   per-IP, and a global monthly spend. Reaching the cap turns live runs off with a
   clear message; recordings stay.
3. **Own key**: the visitor's key for one run, passed to the model proxy, never
   stored or logged. Otherwise retrieve and run locally.

A package whose `spec.model.requires` the sandbox model does not meet gets no live
trial, and the card says why.

### The sandbox service

One external service runs both the benchmark and live trials, driven by the
existing async-run plumbing: a run is created as `queued`, a job is dispatched, the
service posts back on a signed webhook, `sweepRuns` marks lost runs. The 60-second
Vercel function limit never applies to the loop itself.

Inside the service: the agent loop, the sandbox model behind a proxy that holds the
key and enforces the token cap, and MCP servers from a validated, read-only list,
one process per run, no network beyond the declared hosts, no filesystem beyond a
scratch directory seeded with the example data. A brick outside the list makes the
agent not testable live, and the card says so.

Provider and model: tbd after a pricing check. Budget rule: an agent loop costs 20k
to 100k tokens; with ~300 EUR/month the live trial is a few hundred to a thousand
runs a month. Recordings first, trial quotas tight, own key always available.

### Leaderboard

One ranking per trial, from trial results only. Checks are shown on the card but
do not enter the score; a failed blocking check removes the agent from the ranking.
The availability term disappears for packages, since only the gateway can measure
it. Eligibility: a published version, checks computed, a trial result of the
current version. Daily snapshots, history and deltas in `server/leaderboard.ts`
are unchanged; `runs30d` becomes `retrievals30d` for packages. The v1 category
leaderboard remains for the hosted mode.

## Retrieval

Targets first: Claude Code and Cursor, then Codex. All three converge on MCP plus
Markdown instructions (SKILL.md, AGENTS.md); Claude Code's plugin format already
bundles skills, MCP and subagents and is the likely target there (tbd: verify each
tool's current support for skills, subagents and plugins before freezing the export).

- **Claude Code**: skills go under `.claude/skills/<name>/`, MCP servers into the
  project `.mcp.json` with the pinned package and the declared env names left empty,
  the prompt into a `.claude/agents/<name>.md` subagent file or the project
  `CLAUDE.md` section the user chooses (tbd: verify current layout).
- **Cursor**: skills and prompt into `.cursor/rules/<name>.mdc`, MCP into
  `.cursor/mcp.json` (tbd: verify current layout).
- **Form**: one action. `agent-cli pull owner/name --target claude|cursor` writes
  the files and prints what it wrote, after showing permissions and asking for
  confirmation unless `--yes`. The site offers the same through a "Copy prompt"
  modal: a single prompt the user pastes into their tool, which fetches the package
  from `https://agenthive.sh/agents/owner/name/package.json` and writes the files.
  Generated prompts never embed author-written text; they point at the URL.
- Deep links (`cursor://`, Claude desktop) are used where verified, otherwise the
  copy prompt is the fallback.
- Retrievals are counted (authenticated or anonymous id, opt-in CLI telemetry off
  by default) and become `retrievals30d`.

`agent-cli add` keeps its current meaning, installing the catalog MCP server, and
the How-it-works modal is rewritten around find, try, pull, remix. `agent-cli serve`
is removed.

## Fork and remix

- **Fork**: one button on a card, creates a private draft under the user's owner
  with `parent: owner/name@version` recorded by the server.
- **Editor on the site**: prompt, settings form, skills as text, MCP list limited to
  the validated set for live runs. Nothing to install.
- **Test before publish**: the draft runs in the sandbox against the author's cases
  and the registry cases, side by side with the parent's recorded results.
- **Publish**: the draft becomes `owner/name` 1.0.0 under the forker's namespace,
  with the parent shown on the card and a backlink on the parent's card. Checks
  and benchmark run again; nothing is inherited. Licence must be in the allowed
  list and is carried over; a fork cannot relicense more restrictively.
- **Secrets and private context**: the publish step runs the secrets check and a
  warning on company-looking content (internal hostnames, email domains, names in
  settings). It warns, it does not block, except on secrets.
- **CLI round trip**: `agent-cli pull` then `agent-cli push` from a modified local
  copy creates or updates the fork, and keeps experienced developers in their
  terminal.
- **Families**: the catalog groups variants under their root and shows one card per
  family by default, with the best-scoring variant and a count. A fork that is never
  published does not exist outside its owner's dashboard.
- **Updates**: when a parent publishes a new version, forks get a notice in the
  dashboard. No automatic merge.

Why republish, answered in product terms: a resubmitted fork gets a trial score,
a place in the ranking ("beats the original by 12 points") and credit on the
parent's page; a local copy gets none of that. The on-site editor and live test
come after third-party submissions exist; until then the CLI round trip is the
fork path.

## Community (later)

Profiles with published artifacts and forks, organisations, likes, trending by
retrievals and forks, per-artifact discussions. Sign-in adds Google and email next
to GitHub so an account does not require GitHub; better-auth already supports both.

## Teams and freelancers, prepared not built

Revenue, proposed: free forever for public rankings, cards, recorded runs,
retrieval and submission. First paid offer for freelancers and integrators:
private trials on a client's code or data, a comparative report under their name
or white-label, version history of their agents. Later, a team offer: private
trials on internal code before deployment, an approved-agents registry, approval
policy, SSO; EU hosting and AI Act compliance as the angle against Snyk and Vercel.
Nothing ships in v2; the data model keeps a `visibility` column on trials and
packages so private trials are a flag, not a rewrite. Validation without code:
show a hand-made ranking to five AI freelancers and ask whether they would pay to
run the same trial at a client.

## Metrics

Primary: agents submitted to a trial by third parties. Then retrievals measured
from Claude Code, Cursor and Codex, and freelancers or teams ready to pay for a
private trial. Weekly active users and forks are secondary.

Gateway metrics (`runs30d`, availability) remain for the hosted mode only.

## Rollout

Maps onto VISION's six-month roadmap. Sized for one trial done well; the owner has
two other jobs.

1. **Month 1, the site says what the vision says.** Fictional agents removed,
   How-it-works modal and home page rewritten in English around the trial,
   `serve` removed, server-side rendering of cards and rankings (today the body is
   empty without JavaScript), Google and email sign-in.
2. **Months 1 to 2, the first trial.** v2 package format and `owner/name` with
   redirects, the harness, the `code-audit` trial with public and private tasks,
   the first pool of 5 to 10 agents, recorded runs with cost and variance, the
   ranking page. Terms, report and takedown written.
3. **Months 2 to 3, publish and open.** Results posted (Hacker News, Reddit),
   methodology page, submission open to third parties via `agent-cli push` and the
   web form. Authors of ranked MCP servers contacted one by one.
4. **Month 3, revenue check.** Five freelancers and first teams shown the ranking
   and asked about private trials.
5. **Months 3 to 4, retrieval.** `agent-cli pull` and the copy-prompt modal for
   Claude Code and Cursor, then Codex. Retrievals counted.
6. **Months 4 to 6, reference.** Second trial, monthly report, "best agent for X"
   MCP tool on the existing catalog server, per-model or per-tool columns if the
   budget allows.

After these proofs, and only if third parties submit: live sandbox trial with
quotas, on-site fork editor, families, community features.

## What is reused

The harness is the benchmark executor; trial results reuse the benchmark tables
with a `trial_id`, and the ranking reuses the leaderboard snapshots.

Accounts, API keys, dashboard, Hono app, Drizzle schema and migrations,
`agent_versions`, publish rules, manifest validation (extended), the audit engine's
secrets, dependencies and permissions checks and `createSafeFetch`, the benchmark's
gate and scoring, leaderboard snapshots and history, async runs and signed webhooks
as the sandbox job bus, the CLI's login, push and whoami, the catalog MCP server,
the PGlite test harness, per-agent prerendering. The gateway and `cron-translator`
stay as the hosted mode and its example.

Removed: the scripted sandbox, the six fictional agents, the How-it-works modal
text, `agent-cli serve`, the availability term for packages.

## Open questions

- Public versus private share of trial tasks, and the rotation cadence.
- Runs per agent for an acceptable spread within the monthly cap.
- One reference model, or per-model and per-tool rankings.
- Who reviews the trial tasks (external security experts).
- Price and content of the freelancer offer.
- Response if Vercel connects skills.sh and DeepsecBench.
- Harness provider and model, after a pricing check. Candidates: Vercel Sandbox,
  E2B, Fly Machines; model mid-range with a tight per-run cap.
- Exact file layouts for Claude Code and Cursor, and whether deep links exist.
- Index sources and the allowlist for month one.
- Whether `Skill` follows the SKILL.md frontmatter exactly or adds fields.
- Which goals beyond `code-audit` get registry cases first.
- Fork visibility default once published (public is the proposal).

## Decisions taken by the builder

- Packages are text-only and stored in Postgres. Object storage, a 50 MiB cap and
  model weights are out; a package that needs them is not declarative.
- `Prompt` is not a kind; it is an `Agent` without bricks.
- Grade letters are retired for declarative kinds and replaced by a checks list.
- Flat names redirect for at least 12 months; the CLI accepts both forms during
  that time.
- Community test cases and discussions come after the first remix release, not
  before.
