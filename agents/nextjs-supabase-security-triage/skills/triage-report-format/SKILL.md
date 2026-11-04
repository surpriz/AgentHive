---
name: triage-report-format
description: How a time-boxed security triage ranks findings, merges duplicates, picks a verdict, reports coverage honestly and writes the short human summary.
---

# Triage report format

A triage is judged by whether its top three items are the right three. Everything in this skill
serves that.

## Ranking

Order findings by these keys, in this order; use the next key only to break ties.

1. Reachability. Who can trigger it: anyone on the internet (1), anyone with a free account (2),
   a paying or invited user (3), only an insider with repo access (4).
2. Impact on the data in the `context` input. Read or write of other users' personal or financial
   data, or a live credential with admin power: highest. Then: write to own data in unexpected ways,
   denial of service or cost, information leakage about the system, hygiene.
3. Effort to fix. Between two findings of equal reachability and impact, the one fixed in minutes
   goes first: the reader should be able to start now.
4. Certainty. Confirmed chain before partial chain.

Severity is a label; the order above is what decides position. A medium that is reachable by anyone
and fixed in minutes can sit above a high that needs an insider.

## Merging

Merge findings that share a root cause and a fix:
- Several routes missing the same auth helper: one finding, affected files listed in the evidence,
  fix is the helper plus the list.
- Every table with RLS off: one finding, tables listed, fix is one migration.
- Several `catch` blocks returning `err.message`: one finding.
Do not merge findings that have different fixes even when they are in the same file.

## Verdict

- `do-not-ship`: at least one critical that is reachable by anyone, or a live secret in a public repo.
- `fix-before-launch`: critical reachable only by accounts, or two or more highs.
- `ship-with-followups`: no critical, at most one high with a fix under an hour, mediums present.
- `looks-ok`: nothing above medium, coverage at least `done` on secrets and access.
When the app is already live, `do-not-ship` reads as "take it private or fix within the hour"; say
that in the summary.

## Coverage

One row per area (`secrets`, `access`, `api`, `deps`, `config`) with `done`, `partial` or
`skipped` and a notes field that says what was not reached: numbers help ("5 of 14 entry points",
"history not scanned", "storage policies not read"). A triage that claims `done` everywhere in
twenty minutes on a large app is not credible; partial is fine, silence is not.

## Next steps

Three to six lines. Each names the specialist agent or tool to run, the setting or focus to use,
and why (what this pass could not reach). Order by the same ranking as the findings.

## The human summary

At most twelve lines, in this order, no headings:

1. One line: verdict, counts, time spent. "Verdict: fix-before-launch. 1 critical, 2 high, 3 medium
   in 18 minutes."
2. One line per finding, ranked, in the form `[critical] title (file:line, minutes)`. Keep titles
   under twelve words and make them say what an attacker gets, not what the code lacks: "anyone can
   read all profiles" beats "RLS not enabled".
3. One line on what was not covered, pointing at `next_steps`.
4. One line: the single most valuable hour of work, usually the first two or three fixes together.

No preamble, no praise, no generic advice. If there are no findings, say what was checked and how
deep, so the reader can trust it.

## Evidence and fix style

- Evidence is a chain: location, reachability, exposure. Quote the line, redacted if needed.
- Fix is imperative and specific: the file, the code or SQL to add, the dashboard step. Name the
  library already in the project rather than introducing a new one. Rotation before cleanup when a
  secret is live.
- Effort: `minutes` (a one-file change or a dashboard toggle), `hour` (a helper plus call sites, a
  migration plus a check), `day` (a refactor across many routes, a dependency replacement).
