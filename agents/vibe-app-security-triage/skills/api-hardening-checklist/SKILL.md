---
name: api-hardening-checklist
description: Checklist for reviewing HTTP endpoints, Route Handlers, server actions and webhooks in source: validation, mass assignment, rate limits, CORS, error leakage, uploads, webhook signatures, SSRF, injection and leftovers.
---

# API hardening checklist

Apply to every endpoint in the map. Each item says what to search for, what makes it a finding, and
the fix to recommend with the libraries typically present in a Next.js, Express or Hono app.

## 1. Input validation

Search: `req.body`, `await req.json()`, `request.formData()`, `searchParams.get`, `params.`,
`req.query`, `req.params`, server action arguments.
Finding when the value reaches `prisma.*`, `supabase.from`, `db.query`, `fs.*`, `exec`, `fetch(url)`,
`sendEmail`, `stripe.*` without passing through a schema. Also when the schema exists but the handler
uses the raw object instead of the parsed result, or the schema is `z.any()`, `.passthrough()`,
`z.record(z.unknown())` on a write.
Fix: a `z.object({...}).strict()` schema per endpoint, `safeParse`, 400 with field errors. For server
actions, validate the `FormData` the same way; never trust hidden fields. Add `.max()` on strings and
arrays so a 10 MB body cannot hit the database.

## 2. Mass assignment

Search: `data: body`, `data: req.body`, `...body` or `...input` inside `create` / `update` /
`insert` / `upsert`, `Object.assign`, `Model.create(req.body)`, `set(body)`.
Finding when the model has any of: `role`, `isAdmin`, `admin`, `userId`, `ownerId`, `orgId`,
`tenantId`, `email` on an existing user, `emailVerified`, `verified`, `status`, `plan`, `tier`,
`credits`, `balance`, `price`, `amount`, `discount`, `stripeCustomerId`.
Fix: pick fields explicitly (`data: { title: input.title, body: input.body, userId: user.id }`) or
use a schema with only the allowed keys and `.strict()`.

## 3. Rate limiting

Search: `@upstash/ratelimit`, `express-rate-limit`, `rate-limiter-flexible`, `hono-rate-limiter`,
`ratelimit(`, `limiter(`, `vercel.json` with firewall rules, `middleware.ts` counters.
Must-have on: `/login`, `/signin`, `/signup`, `/register`, `/forgot-password`, `/reset-password`,
`/verify`, `/otp`, `/magic-link`, `/contact`, `/invite`, `/send`, `/checkout`, anything calling an
LLM or SMS or email provider, search endpoints that hit the database with `ILIKE`.
Fix: one `rateLimit(key, limit, window)` helper keyed by user id when logged in, by IP otherwise,
returning 429 with `Retry-After`. On Vercel use Upstash or the platform firewall; on Express use
`express-rate-limit` with a store that survives restarts.

## 4. CORS

Search: `Access-Control-Allow-Origin`, `cors(`, `headers()` in `next.config`, `vercel.json` headers,
`OPTIONS` exports.
Finding: `*` with `Access-Control-Allow-Credentials: true` (browsers reject this combination, which
usually means the code reflects the origin instead); `origin: true` or `origin: req.headers.origin`
without an allowlist; `*` on an API that authenticates with cookies; allowlists that use `includes`
on a substring (`origin.includes('example.com')` matches `example.com.attacker.net`).
Fix: an explicit array of origins compared with `===`, credentials only for those, `Vary: Origin`.
Routes used only by same-origin code need no CORS headers at all.

## 5. Error leakage

Search: `catch (e)` followed by `json({ error: e.message })`, `e.stack`, `String(e)`, `json(e)`,
`throw e` without a boundary in server actions (Next.js returns a digest in production but the full
message in development, and many apps deploy with `NODE_ENV` unset), Prisma `code` and `meta`,
Postgres `detail`, Zod errors returned verbatim (fine), `console.log(req.headers)`.
Fix: log the full error server-side with a request id, return a generic message plus the id. Map
known errors (not found, conflict, validation) to 404, 409, 400 explicitly.

## 6. Uploads

Search: `formData.get(`, `multer`, `formidable`, `busboy`, `storage.from(...).upload`,
`PutObjectCommand`, `fs.writeFile` with a request value, `createPresignedPost`.
Checks: size limit (`limits.fileSize`, `maxSize`, body size config `export const maxDuration` and
`bodySizeLimit`); type check by reading the magic bytes or using a library, not `file.type` or the
extension; destination path from a random name or an id, never from `file.name` (traversal with
`../`); bucket not public unless meant to be; SVG, HTML and XML served with
`Content-Disposition: attachment` or from a separate origin; presigned uploads restricted by
content-type and size conditions; image processing (`sharp`) with pixel limits.

## 7. Webhooks

Search: paths with `webhook`, `hook`, `callback`; headers `stripe-signature`, `svix-signature`,
`x-hub-signature-256`, `x-twilio-signature`, `resend-signature`.
Finding when the body is parsed and acted upon before signature verification, when the raw body is
re-serialised (signatures fail silently and get removed), when the secret comes from a public env
var, when the handler does not check idempotency (`event.id` stored) for money-moving events.
Fix: raw body, provider SDK verification, 400 on failure, idempotency key, no business logic in the
handler beyond enqueueing.

## 8. Shorter checks

- SSRF: `fetch(body.url)`, `axios.get(req.query.url)`, image proxies, link previews, PDF renderers
  taking a URL. Fix: allowlist hosts, block private ranges, no redirects.
- Injection: `$queryRawUnsafe`, template strings in `$queryRaw` without the tag, `db.query(` with
  `+` concatenation, `exec(`, `spawn(` with `shell: true`, `eval`, `new Function`, `child_process`
  with request data. Also `ILIKE '%' || $1` style with user wildcards (DoS).
- Debug and leftovers: `/api/debug`, `/api/test`, `/api/seed`, `/api/reset`, `/api/admin/sql`,
  `console.log` of full request bodies, `dangerouslyAllowSVG`, `TODO remove before prod`.
- Method confusion: `GET` that mutates (cacheable, CSRF-able), handlers that ignore `req.method`,
  `OPTIONS` or `HEAD` served by an auth-free branch.
- Open redirect: `redirect(searchParams.get('next'))`, `res.redirect(req.query.returnTo)`. Fix:
  allow only relative paths starting with a single `/`.
- Body size: Next.js server actions default to 1 MB (`experimental.serverActions.bodySizeLimit`);
  Express `express.json({ limit })` defaults to 100 KB. Unlimited raw body readers are a finding.
- Headers: `helmet()` or the Next.js `headers()` config with `X-Content-Type-Options`,
  `Content-Security-Policy`, `Referrer-Policy`. Missing is low severity; note it once.

## Evidence line format

`<METHOD> <path> (<file>:<line>) reads <input> at line N, uses it in <sink> at line M without
<control>. Trigger: <one-line request>.`
