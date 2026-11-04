---
name: background-jobs-checklist
description: Checklist for workers, cron jobs, queue consumers and their trigger surfaces: startup and error logging, shell execution from data, TLS and outbound calls, stored webhook URLs and signing, export paths, and admin API authentication.
---

# Background jobs checklist

## Logging

- `logger.info('config', config)`, `console.log(process.env)`, `print(settings.dict())` at
  startup: every key in the config is in the log. Critical when the sink is shared (Datadog,
  CloudWatch, a Slack channel).
- Error handlers logging the failed request: `err.config.headers` (axios), `err.request`,
  `response.request.headers`, the outbound body with tokens.
- Pino/winston `redact` lists that name `password` but not `apiKey`, `token`, `secret`,
  `authorization`, `cookie`, `webhookSecret`.
- Queue payloads logged in full when they carry credentials or personal data.

## Execution

| Call | Risk with data |
|---|---|
| `exec(\`cmd ${x}\`)`, `execSync`, `spawn(cmd, { shell: true })`, `os.system`, `subprocess.run(cmd, shell=True)` | critical |
| `execFile(cmd, [x])`, `spawn(cmd, [x])`, `subprocess.run([cmd, x])` | safe from the shell; check options (`-`), `--`, and tools that read paths |
| `eval`, `new Function`, `vm.runInThisContext`, `pickle.loads` of queue messages | critical |

Data sources that reach commands in workers: tenant names and slugs, file names from uploads,
S3 keys, queue message fields, cron parameters, env vars set per job.

## Outbound

- `rejectUnauthorized: false` in `https.Agent`, axios `httpsAgent`, node-fetch agent;
  `NODE_TLS_REJECT_UNAUTHORIZED=0` in code, scripts, Dockerfile, systemd unit; `verify=False`,
  `ssl.CERT_NONE`, `curl -k`.
- Webhooks to stored URLs: validate host at save time and send time (DNS, private ranges,
  metadata endpoints), no redirects, timeouts, response body not stored or echoed.
- Signing: per-customer secret with HMAC over timestamp and body in a header; a single shared key
  for all customers lets any customer forge deliveries to another; the key in the query string
  ends up in access logs.
- Retries that resend a body with a one-time token; backoff absent on 4xx.

## Files

- Export, temp and archive paths from tenant data: `path.join(base, slug)` without resolve;
  `..` in a slug; absolute paths from config overrides.
- Extraction of downloaded archives without entry checks; `tar` with `--absolute-names`.
- Exports written world-readable, or uploaded to a bucket with a public prefix; cleanup `rm -rf`
  with a path from data.

## Triggers

- Admin HTTP routes: `if (req.headers['x-admin-token'] === TOKEN)` is acceptable when `TOKEN` is
  long, random, loaded from the environment with a startup check, compared with
  `timingSafeEqual`, and the route is rate limited. Token in the URL, `TOKEN || 'dev'`, or no check:
  finding.
- CLI entry points that accept paths or tenant ids used in steps above.
- Queue producers: who can enqueue (an unauthenticated route that enqueues an export for any
  tenant id is the same as running it).
- `/health` returning config, `/debug`, `/metrics` with labels carrying secrets.

## Credentials

- Workers with the full service-role or admin key when a scoped one exists; keys in the Dockerfile
  `ENV`; `.env` tracked; secrets read once at startup and printed in the banner.
