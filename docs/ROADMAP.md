# AgentHive roadmap

Working notes on where the project goes after v0 and why. Decisions are
recorded here so they do not get re-argued every month. Last update:
2026-11-02.

## Direction change, 2026-11-02

Decided by the project owner, and it overrides the sections below where they
disagree. Design: `specs/2026-11-02-v2-hub-design.md`.

- AgentHive is the Hugging Face of AI agents, and does not depend on GitHub.
- Community and free for now. No billing until usage is proven, then a paid offer
  for teams. The marketplace and creator payouts are dropped.
- Agents are uploaded packages, tested on the site, retrieved in one click, then
  forked and republished. This reverses "AgentHive exposes agents, it does not
  host them".
- An agent packages its prompt, plugs into MCP servers and uses skills.
- The audience is vibe coders, tech professionals, product managers and founders,
  along with experienced developers. Not the general public.
- Fictional agents go, replaced by real ones. Sandbox and fork come first.
- The first goal covered is code and security audit.

The validated vision and the proposed steps are in `VISION.md`, which takes
precedence over everything below.

## Positioning, in one paragraph

AgentHive is the registry for interoperable AI agents: npm for agents, Hugging
Face for agents. It is developer-first. The user is someone who builds with
LangGraph, CrewAI, AutoGen, MCP or A2A and wants to find, trust and install
agents written by others. End users of chat products are not the target;
other people build consumer products on top of a registry, the registry does
not try to be one.

The reason to use a registry instead of GitHub search is trust: a security
grade and a success rate that nobody else provides, computed by us, not
declared by the author. That is the differentiator and it moves up the list
accordingly.

## Status of v0

Live at the Vercel preview, source on GitHub. Real today:

- catalog, filters, per-agent deep links, SEO meta, sitemap
- one manifest per agent, served as YAML and as an A2A agent card
- JSON registry endpoints (`/api/agents.json`, `/agents/<name>/agent.json`)
- `@agenthive-sh/registry-client`, `@agenthive-sh/mcp`, `@agenthive-sh/cli` packages
  (not yet published to npm)
- CI with unit and end-to-end tests

Simulated today, and labelled as such in the UI:

- the six seed agents are fictional
- the sandbox replays a scripted trace, no model is called
- "Push Agent" validates and stores the agent in the browser only
- `agent-cli serve` exits with "not available in v0"

## Closing v0

All done.

1. `agenthive.sh` attached to the Vercel project. Done 2026-11-01.
2. Packages on npm as `@agenthive-sh/*` 0.1.0 (the `@agenthive` scope
   belongs to an unrelated account). Done 2026-11-01.
3. Per-agent pre-rendering with Open Graph tags. Done 2026-10-31, moved to
   request time with v1.
4. Onboarding: "How it works" modal, plain-language value line under each
   agent name, "try example" in the sandbox, explicit "simulated" labelling.
   Done 2026-10-31.

## v1: a real registry with real agents

The ordering below is deliberate. Supply comes before compute, measurement
before billing. Items 1 and 2 shipped 2026-10-31 (v1.0, see
`docs/specs/2026-10-31-v1-registry-design.md`); deprecation is still open.

1. Backend: database, publish API, semantic versioning, deprecation, name
   ownership.
2. GitHub OAuth, API keys, author dashboard.
3. Publish pipeline: manifest validation, static checks (secrets in code,
   requested permissions, network egress, known-vulnerable dependencies),
   grade assigned from public criteria.
4. Run gateway: `POST api.agenthive.sh/v1/run/<agent>` that proxies to the
   author's own endpoint, with auth, quotas, timeouts, retries and completion
   webhooks. Shipped 2026-11-01 (v1.2) as `POST /api/v1/run/<name>` with
   signing, quotas, logs and measured metrics. Async runs and signed
   webhooks shipped 2026-11-01 (v1.4). See `GATEWAY.md`. AgentHive exposes agents, it does not host them. This is the A2A
   assumption (the agent card points at the provider's URL), it is an order of
   magnitude cheaper than a managed runtime, and it keeps the customer
   relationship and the usage data on our side.
5. Usage metering per key and per agent, call logs (latency, errors, declared
   tokens), a logs console. Logs and console shipped with v1.2; token
   metering open.
6. Automated benchmark (v1.3 shipped 2026-11-01: author-declared cases + registry probes, after publish, daily, on demand; category task sets still open): a task set per category, run at every publish,
   success rate displayed. The security grade is computed, never declared.
7. Supply bootstrap: port 20 to 30 existing open-source agents (well-known MCP
   servers, LangGraph and CrewAI templates) together with their authors. This
   is the most important item in v1. A gateway with nothing to route is an
   empty data center.
8. Billing: free with quotas first, then pay-as-you-go on standard Stripe.
   Stripe Connect and creator payouts only once there is volume to pay out.
9. Optional managed hosting for authors without infrastructure, only after
   the gateway has shown demand.

## v2: interop and enterprise

1. Full A2A compliance: agent cards served by the gateway, tasks, streaming,
   delegation between agents in the registry. Implement the existing standard,
   do not invent a discovery or negotiation layer.
2. Private registries per organisation, SAML SSO, RBAC, exportable audit logs
   (SOC 2, EU AI Act).
3. Continuous public leaderboard, per category, with history. Shipped
   2026-11-01 (`/leaderboard`, daily snapshots, `LEADERBOARD.md`).
4. TypeScript and Python SDKs to call an agent from code, next to the CLI and
   the MCP server.

## Cross-cutting, easy to forget

- Terms of service, moderation policy, takedown of malicious agents, name
  squatting rules.
- Abuse protection: rate limiting, email verification, spam detection at
  publish time.
- Public docs, versioned manifest spec, changelog, status page.
- Product analytics, per-agent SEO, one landing page per category.
- Backups, recovery plan, external security review before any enterprise
  offer.

## Decisions

### Kept

- Developer-first. One interface, one audience.
- Gateway over managed runtime for v1 (see v1 item 4).
- Benchmarks and computed grades in v1, not v2. They are the product.
- Static, verifiable security checks instead of a "prompt injection scanner".
  Nobody can block prompt injection reliably; promising it is a liability.
- "Simulated" written on anything that is simulated. A visitor who believes
  they ran an agent and later learns it was theatre is worse than friction.

### Rejected, with the reason

- **Dual mode (one-click run for non-developers next to the developer
  view).** Doubles the UI surface, dilutes the positioning, and commits us to
  a consumer chat runtime, consumer auth, moderation and paying for every run.
  Revisit only once the v1 gateway exists and someone asks for it.
- **"Run in browser" as the main button on each card.** In v0 it would promise
  an execution we cannot deliver. The sandbox stays a labelled demo until runs
  are real; then the button becomes "Run" and means it.
- **A "General / No-Code" category.** Vocabulary, not product. It creates no
  agent that is usable without code.
- **Stripe Connect with 80 % creator payout in v1.** KYC, payouts and
  per-country tax for zero revenue until there is volume. Meter first, bill
  later, pay out last.
- **A shared-memory standard between agents (was in v2).** Nobody has
  specified it; it is research, not a roadmap item.
- **Managed serverless runtime as the first v1 deliverable.** It is the most
  expensive item on the list and depends on supply that does not exist yet.

### Feedback received on v0, and what was taken from it

An external review of v0 argued that a visitor who does not know what
`.claude.json` is gets lost in three seconds, and proposed the dual mode
above. The diagnosis was right, the fix was not. What was kept:

- a plain-language outcome line under every agent name
- a "How it works" entry in the navigation, three steps, developer-oriented
- the sandbox example runnable in one click
- exact tool names stay on the cards (`AST Parser`, `Semgrep`); the value
  line above them gives the context
