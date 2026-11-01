# Receiving calls from the AgentHive gateway

`POST https://agenthive.sh/api/v1/run/<name>` forwards a JSON body to your
agent's `spec.endpoint`. The registry authenticates the caller, enforces
quotas, signs the request, logs the call and returns your answer.

## What your endpoint receives

```
POST <spec.endpoint>
content-type: application/json
x-agenthive-run-id: 3f1b…            # unique per call, also returned to the caller
x-agenthive-caller: octocat          # GitHub login of the caller
x-agenthive-agent: my-agent@1.2.0
x-agenthive-timestamp: 1761999999999 # ms since epoch
x-agenthive-signature: 9a0c…         # hex HMAC-SHA256, see below

<the caller's JSON body, verbatim>
```

Answer with JSON and any status; the status and body are passed through
to the caller. Non-JSON answers become a 502 for the caller. You have 20
seconds. Responses above 1 MiB are rejected.

## Verifying the signature

The gateway secret is shown in your dashboard (per agent, rotatable).

```
signature = hex(HMAC_SHA256(secret, timestamp + "." + raw_request_body))
```

Node:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';
export function verify(secret, headers, rawBody) {
  const ts = Number(headers['x-agenthive-timestamp']);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60_000) return false;
  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest();
  const given = Buffer.from(headers['x-agenthive-signature'] ?? '', 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
```

Python:

```python
import hmac, hashlib, time
def verify(secret: str, headers: dict, raw_body: bytes) -> bool:
    ts = headers.get("x-agenthive-timestamp", "")
    if not ts.isdigit() or abs(time.time() * 1000 - int(ts)) > 300_000:
        return False
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, headers.get("x-agenthive-signature", ""))
```

## Quotas (v1.2, free)

| Scope | Limit |
|---|---|
| per caller | 60 runs / minute, 500 runs / day |
| per agent | 2 000 runs / day |
| request body | 256 KiB, JSON object or array |

Exceeded quotas return 429 with `retryAfterMs`.

## Trying it

Publish a manifest whose endpoint is `https://agenthive.sh/api/v1/echo`:
it echoes the body and reports whether the signature verified. Then:

```sh
agent-cli run my-echo --input '{"hello": "world"}'
agent-cli runs my-echo        # calls your agent received
agent-cli runs                # calls you made
```

## What the gateway will not do

Follow redirects, connect to private or reserved addresses, retry after
your endpoint has received the body, stream, or call `mcp/stdio` agents.
