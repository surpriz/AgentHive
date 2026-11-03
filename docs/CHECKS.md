# Checks on packages

Declarative agents (`apiVersion: agenthive.sh/v2`) are text: a prompt, copied
skills, pinned MCP servers and typed settings. The registry does not grade them
with a letter. It runs a fixed list of checks and shows the list, each one passed
or failed with a reason, because a static check cannot vouch for what a prompt
asks a model to do. Install only what you have read.

| Check | What it verifies | Fails when |
|---|---|---|
| `secrets` | No credential-looking string in the manifest or any file (AWS, GitHub, OpenAI, Slack, Stripe, Google keys, private key blocks, JWTs, credentials in URLs, AgentHive keys) | a match is found: the publish is refused |
| `bricks` | Every MCP server is `npm:name@x.y.z` or `pypi:name==x.y.z` and that exact version exists on its registry | a version is missing (high), a registry could not be reached (low, capped) |
| `vulnerabilities` | The pinned MCP packages queried against [OSV](https://osv.dev) | a known advisory matches (high or medium by its severity) |
| `permissions` | Each MCP server declares what it touches; hosts are hostnames | unrestricted network (medium), write access (low), malformed hosts (low) |
| `scripts` | Files are instructions, not programs | a shebang line (medium) or a download piped into a shell (high) |
| `completeness` | Input and output schemas, README, use cases, tags, a forkable licence, tests or examples, at least one brick | each gap is low |

What they do not do:

- read the prompt or the skills for intent. A prompt can ask a model to do
  harmful things in plain language and pass every check;
- verify what an MCP server does at runtime. The version is pinned and queried
  against OSV, nothing more;
- run the agent. Recorded runs and a sandbox are on the roadmap.

A package with a failed `secrets` check is not published. The score behind the
checks is kept for ranking only; the card shows the list.

Forkable licences: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, CC-BY-4.0,
CC0-1.0, ISC, MPL-2.0. Another licence publishes fine but is flagged, and the
fork button stays off.

Hosted agents (`agenthive.sh/v1`, an endpoint run by the author) keep the grade
described in [GRADING.md](GRADING.md).
