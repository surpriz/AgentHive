---
name: auth-flow-checklist
description: Checklist for reviewing sign-up, login, password reset, magic link, OAuth and session code from source: token verification, secrets and fallbacks, redirects, role assignment and brute-force protection.
---

# Auth flow checklist

Read in this order; most findings are in the first three sections.

## Secrets and fallbacks

- `process.env.X || 'literal'`, `process.env.X ?? 'literal'`, `os.getenv("X", "literal")`,
  `getenv("X") or "literal"`: a fallback secret ships in the repo. Critical if it reaches `sign`
  or `verify`.
- `os.getenv("X", "")`, `process.env.X!` with no startup check: an empty secret in production
  verifies tokens signed with an empty key. Check `.env.example` for an empty value that a deploy
  could copy as is.
- Secrets shorter than 32 characters, or named like a default (`secret`, `changeme`).

## Token verification

| Library | Dangerous pattern |
|---|---|
| jsonwebtoken | `jwt.decode()` used where `jwt.verify()` is meant; `algorithms` missing; `ignoreExpiration: true` |
| jose | `jwtVerify` with `algorithms` taken from the token; `decodeJwt` treated as verified |
| PyJWT | `algorithms=[header["alg"]]`; `options={"verify_signature": False}`; `jwt.decode(token, verify=False)` |
| python-jose | `jwt.get_unverified_claims` used for auth; `algorithms` omitted |
| hand-rolled HMAC | `==` instead of `timingSafeEqual` / `hmac.compare_digest`; payload parsed before signature check |
| Supabase | `supabase.auth.getSession()` on the server (reads the cookie, does not verify) where `getUser()` is needed |

A token whose `alg` is read from its own header lets the client pick `none`. A verifier that
accepts both HS256 and RS256 with the same key material is confusable.

## Sessions

- Session id from `Math.random`, `Date.now`, an incrementing id, or the user id itself.
- Cookie without `httpOnly`, without `secure` in production, `sameSite: 'none'` without reason.
- Expiry set on the cookie but not checked on the server row; logout that clears the cookie but
  keeps the row valid.
- Session not rotated after login or password change.

## Sign-up and roles

- `role`, `isAdmin`, `is_admin`, `plan`, `tier` present in a sign-up or profile schema that the
  request body fills; `...req.body` or `...parsed.data` spread into a create or update.
- Supabase `user_metadata` (user-writable) used for roles; only `app_metadata` is trustworthy.
- "First user becomes admin" without a check that the table is empty inside a transaction.
- Invite acceptance that checks the invite exists but not that the email matches.

## Password reset, magic links, OTP

- Token from `Math.random`, short numeric codes without attempt limits, token stored in plain
  text with no expiry, token reusable after success.
- Link origin from `req.headers.host` or `X-Forwarded-Host`: a poisoned link goes to the attacker.
- Response text differs between "no such account" and "email sent": enumeration.
- `password.length < 8` checks absent or the whole policy enforced only on the client.

## Redirects

Search `redirect(`, `res.redirect(`, `RedirectResponse(`, `Location`, `window.location =`,
`next=`, `returnTo`, `return=`, `callbackUrl`, `redirect_uri`. Safe: value must start with `/`
and not with `//` or `/\\`, no `:` before the first `/`, or an allowlist of absolute URLs. A
`safeNext` helper that exists but is not used on one route is the finding, on that route.

## Brute force

| Stack | Look for |
|---|---|
| Express | `express-rate-limit`, `rate-limiter-flexible`, `express-slow-down` on the auth router |
| Next.js | `@upstash/ratelimit`, `@vercel/firewall`, custom KV counters in the route |
| FastAPI | `slowapi`, `fastapi-limiter`, a dependency counting attempts |
| Supabase / Clerk / Auth0 | provider-side limits exist for their own endpoints only; custom password routes still need one |

Absent on login, sign-up, reset and OTP verification: one merged finding, routes listed.

## OAuth

- `state` not generated per request or not compared on callback.
- Account linking by email without the provider's `email_verified`.
- `redirect_uri` built from the request rather than configuration.
