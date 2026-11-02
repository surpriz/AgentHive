# v2 — the hub: uploaded packages, local runs, hosted demos

Status: draft, on hold, partly superseded by `../VISION.md`, which holds the
validated vision (Test & Remix, declarative packages first). To rewrite from it:
intent, kinds, package, local runtime, demos and rollout. Replaces
the "exposes agents, does not host them" decision of v1. Numbers marked (tbd) are
placeholders.

## Intent

The Hugging Face of AI agents, community-driven and free for now. Authors
upload what they built, developers download it and run it on their own machine
with their own model, and anyone can try it in the browser first.

Doing better than Hugging Face means three things it does not offer for
agents today: one portable package format, scores measured per model, and
safe execution by default.

Decisions behind this design, made by the project owner on 2026-11-02:

- Code is uploaded and runs on the user's side, plus hosted demos.
- Everything can be published: agents, MCP servers, skills, prompts.
- Developers come first. No no-code surface.
- Full-time, moderate budget for six months. Community and free: no billing.

## Publishable kinds

`kind` already exists in the manifest with `Agent` as its only value. It
becomes the switch that decides what can be measured.

| Kind | Contains | Runs | Scores |
|---|---|---|---|
| `Agent` | code with its own loop | container, local or sandbox | audit, benchmark per model |
| `McpServer` | code exposing tools | container, driven by the host's model | audit, protocol probes, tool test cases |
| `Skill` | instructions and optional scripts | inside the user's own agent | audit, optional eval |
| `Prompt` | text and variables | any model | secrets check, optional eval |

Leaderboards rank within a kind, never across kinds. An artifact without a
measured benchmark shows "not benchmarked" and does not enter a leaderboard.

## Names

Names move to `owner/name`, as on Hugging Face. It ends the race for short
names and gives organisations a home. Existing flat names keep working as
redirects to `<owner>/<name>`; seeds are removed (see Rollout).

## Package

```
my-agent/
  agent.yaml        manifest, apiVersion agenthive.sh/v2
  README.md
  src/...
  lockfile          required for Agent and McpServer
```

- `agent-cli push` builds a `.tar.gz`; the web form accepts the same archive.
- A version is immutable: stored by SHA-256, never overwritten. Withdrawing a
  version hides it and leaves a tombstone.
- Size cap 50 MiB per version (tbd). Model weights do not belong here: a
  manifest points at a Hugging Face or Ollama model instead.
- Stored in object storage with no egress fees, since downloads are the main
  cost. Candidate: Cloudflare R2. Pricing to confirm before choosing.
- Quotas per account, in storage and in versions per day (tbd).

### Manifest additions

```yaml
apiVersion: agenthive.sh/v2
kind: Agent
spec:
  runtime:
    language: node        # node | python
    entry: src/server.js
  model:
    requires:
      toolCalling: true
      minContextTokens: 16000
    recommended: [ollama/llama3.2]
```

`spec.endpoint` becomes optional and remains a supported mode: "hosted by the
author", through the existing gateway. `spec.source` stays optional and accepts
any public git host, since the audit now reads the uploaded code.

## Running locally

```sh
agent-cli run owner/my-agent --model ollama/llama3.2 --input '{...}'
```

1. Download, verify the SHA-256, cache by hash.
2. Start the package in a container (Docker or Podman). With neither present
   the command refuses, unless the user passes `--unsafe-no-sandbox`.
3. Apply `spec.permissions`: network default-deny plus the declared hosts,
   no filesystem beyond a scratch directory, only the declared env vars.
4. Send the input with the same HTTP contract as the gateway (`POST /run`,
   JSON in, JSON out), so an agent written for the gateway also runs locally.

**Model access goes through a proxy owned by the CLI.** The agent receives
`AGENTHIVE_LLM_BASE_URL`, a throwaway token and `AGENTHIVE_LLM_MODEL`. The API
is OpenAI-compatible, which covers Ollama, LM Studio, vLLM and OpenRouter;
other providers go through a translation layer. The user's real key stays
outside the container, so a malicious agent cannot read it.

## Measurement

### Correction to the earlier plan

Registry-written test sets per category cannot work as stated: agents do not
share an input schema, as `2026-11-01-v1.3-benchmark-design.md` already notes.
Today the benchmark is author cases plus generic probes, so authors partly
grade themselves.

### Plan

- **Standard tasks where a contract exists.** An agent may declare that it
  implements a task contract, such as `summarize.v1` or `sql-explain.v1`, with
  a shared schema. The registry then runs its own held-out cases on it. Only
  these results count as independent and enter the leaderboard's top tier.
- **Community cases.** Any user can propose a test case on an artifact. The
  author cannot delete it, only dispute it.
- **Author cases and probes** remain, labelled as such.

Every result shows who wrote the cases: registry, community or author.

### Per model

The benchmark runs in the sandbox on two models at first, a cheap hosted one
and a small open one (tbd), once per version with a token cap. The card shows
`Llama 3.2: 6/10`, with the model and date. Agents with no LLM run once.

Without a real model budget this is the first thing to shrink: fewer models,
not fewer versions.

## Hosted demos

Demos and benchmarks share one sandbox service, which is one investment for two
features. Provider to be chosen (E2B, Fly Machines, Vercel Sandbox), pricing to
confirm.

A visitor moves through up to three levels, and none of them needs the author's
machine:

1. **Recorded examples.** Benchmark runs shown on the card with input, output,
   model and date. They are real runs, always labelled as recordings, and add no
   cost since the benchmark already pays for them. Only test cases are shown,
   never a visitor's input. Secrets are scrubbed from outputs before display.
2. **Free trial.** A live run in the sandbox. Agents without an LLM run directly.
   Others use one small open model paid for by AgentHive, labelled as such, since
   a better model may give better results.
3. **Own key or local run.** The visitor's key is sent to the proxy for that run
   and never stored or logged. Otherwise `agent-cli run`.

Limits:

- Only artifacts with a passed audit and no blocker get a live run.
- Limits per run: 30 s, memory cap, egress restricted to declared hosts (tbd).
- The free trial requires sign-in, with a daily quota per account (tbd) and a
  token cap per run enforced by the proxy. The proxy token dies with the run, so
  an agent cannot use it as a free LLM endpoint.
- An agent whose `spec.model.requires` the small model does not meet gets no free
  trial, and the card says why. Its recorded examples remain.
- Quotas per account and per IP, and a global monthly spending cap covering the
  sandbox and the free model. Reaching it turns live runs off with a clear
  message, and recorded examples stay available. Amount: 300 EUR/month (tbd).

These replace the scripted sandbox, which is removed with the fictional agents.

## Trust and safety

Hosting code from strangers changes our exposure.

- The audit reads the package: secrets and dependencies across the code, not
  just the manifest. Static checks only, no "prompt injection scanner".
- Runtime scripts and skills are shown as text before install. Skills and
  prompts are instructions an agent will follow, so their cards say so.
- Report button, takedown process, repeat-offender bans, name-squatting rules.
- Terms of service and a notice-and-action process before public upload opens.
  To be reviewed by a lawyer: the project is operated from the EU.
- Prompts we generate for users never embed author-written text.

## Community

Profiles, organisations, likes, download counts, trending, per-artifact
discussions, forks with visible lineage. Sign-in adds Google and email next to
GitHub, so an account does not require GitHub.

## Metrics

Local runs are invisible to the gateway, so `runs30d` and availability no longer
describe an uploaded package.

- Primary metric: weekly active developers, counted from authenticated or
  anonymous-ID downloads and opt-in CLI telemetry. Off by default and documented.
- Availability only applies to the "hosted by the author" mode.

## Rollout

1. **Clean up.** Fix or remove `agent-cli add`, replace the stale "How it works"
   modal with the copy-prompt modal, remove the six fictional agents, add Google
   and email sign-in.
2. **Packages.** v2 manifest, `owner/name`, upload, download, audit on code,
   moderation tools and terms. Public upload opens at the end of this step.
3. **Local runtime.** Container, permissions, model proxy, `--model`.
4. **Sandbox.** Benchmark per model, then recorded examples, then live runs and
   the free trial on the same service.
5. **Community.** Likes, trending, discussions, forks, community test cases.

Supply runs throughout: 20 to 30 real artifacts ported with their authors before
any launch, starting with MCP servers and no-LLM agents. Volume is not the goal:
MCP directories already list tens of thousands of servers. Measured quality is.

## Open questions

- Sandbox and storage providers, after a pricing check.
- Which small open model serves the free trial, and from which provider.
- Which task contracts come first; they must match what is actually published.
- Whether `Skill` and `Prompt` formats follow an existing standard.
- Compatibility with NVIDIA NemoClaw as a runtime target, worth a spike in step 3.
