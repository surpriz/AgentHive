# How AgentHive grades an agent

Every publish runs the same automated audit on the manifest. The grade is
computed from the report, never declared by the author, and the full report
is public at `/agents/<name>/audit.json` and in the Audit tab.

What the audit can see in v1.1 is the manifest, the declared endpoint and,
when `spec.source` points at a public GitHub repository, that repository's
dependency manifests. It does not execute the agent and it does not read
private code. Items it cannot verify cap the grade rather than lower it.

## Checks

| Check | What it looks at | Findings |
|---|---|---|
| `secrets` | the whole manifest text | API keys, tokens, private keys, credentials in URLs → **blocker**, publish refused |
| `endpoint` | `spec.endpoint`, if declared | private, loopback, link-local or cloud-metadata addresses → **blocker**; unreachable → high; TLS error → high; no A2A agent card at `/.well-known/agent.json` → low |
| `permissions` | `spec.permissions` | not declared → medium and **cap A**; `shell: true` → medium; `network: ["*"]` → medium; `filesystem: write` → low |
| `dependencies` | `spec.source` (GitHub) → `package.json`, `requirements.txt`, `pyproject.toml` checked against [OSV](https://osv.dev) | critical/high vulnerability → high; other vulnerability → medium; no dependency manifest found → low; no source declared or database unreachable → **cap AA** |
| `completeness` | schemas, README, use cases, license, tags, tools | each missing item → low |

## Score and grade

Start at 100. High findings cost 25, medium 10, low 3. Then apply caps.

| Grade | Score | Conditions |
|---|---|---|
| AAA | ≥ 90 | source declared and dependency check ran, permissions declared, endpoint reachable if declared |
| AA | ≥ 75 | permissions declared |
| A | ≥ 55 | |
| B | < 55 | |

A check that cannot complete never helps the grade: an unreachable
endpoint, an unreadable dependency manifest, a vulnerability database that
does not answer, a check that ran out of time or a dependency list longer
than 100 entries all cap the grade at AA, and the report says why. The
audit never follows redirects and only connects to public addresses.

`pending` is only shown while an audit has not run yet (for example when the
audit service was unreachable at publish time). Authors can re-run the audit
from the dashboard or with `agent-cli audit <name> --rerun` at most once per
hour per agent.

The six seed agents shipped with the registry carry illustrative grades and
are marked as such in their Audit tab.

## Declaring permissions and source

```yaml
spec:
  permissions:
    network: [api.github.com, "*.openai.com"]   # hostnames the agent calls, or ["*"]
    filesystem: read                              # none | read | write
    shell: false
    env: [GITHUB_TOKEN]                           # environment variables it reads
  source:
    repo: https://github.com/acme/pr-reviewer
    ref: v2.3.1                                   # optional, default branch otherwise
    path: .                                       # optional, folder holding the dependency manifest
```

Both blocks are optional. Declaring them is how an agent reaches AA and AAA.
