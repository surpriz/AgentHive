---
name: sveltekit-security-checklist
description: Where SvelteKit apps written with AI help go wrong: hooks guards with gaps, load and action scoping, form actions and CSRF settings, {@html}, handleError, public env, redirects, +server.ts endpoints, webhooks and adapter configuration.
---

# SvelteKit security checklist

## Guards and scoping

- `hooks.server.ts` `handle`: which `event.url.pathname` prefixes redirect when `locals.user` is
  null. Everything else is public, including `+server.ts` under `/api` and any sibling prefix.
- `+page.server.ts` `load({ params, locals })`: `db.select().from(t).where(eq(t.id, params.id))`
  with no `eq(t.ownerId, locals.user.id)` is IDOR; the actions in the same file are often scoped
  (decoy).
- `+server.ts` `GET({ params })` without `locals` at all: nobody checked the caller.
- `+layout.server.ts` returning the whole user row (hash, tokens) to the client.
- Roles: `locals.user.role` from the database row is fine; from a cookie, a form field, OAuth
  `profile` or `user_metadata` is not.

## Sessions

- Cookie set without `httpOnly`, `secure`, `sameSite`; `maxAge` on the cookie but no expiry check
  on the session row; logout that clears the cookie only.
- Session token from `Math.random` or the user id; no rotation on login.
- Lucia / Auth.js / better-auth: configured secret defaulted or short; `trustHost: true` with no
  reason.

## Actions and endpoints

- `Object.fromEntries(formData)` spread into an insert or update on a table with `role`, `ownerId`,
  `paidAt`, `price`.
- `redirect(303, url.searchParams.get('next') ?? '/')`, `return`, `returnTo`, `callbackUrl` without
  `startsWith('/')` and `!startsWith('//')`; a `safeNext` helper used on one action and not another.
- `csrf: { checkOrigin: false }` in `svelte.config.js`: form actions accept cross-site POSTs.
- Raw SQL: `sql.raw(x)`, string templates inside `sql\`\`` interpolation, `$queryRawUnsafe`.
- `fetch(url)` in `load` with a user URL; `follow` redirects; host checked by `startsWith`.
- File responses from `path.join(base, params.name)` without a resolve check.
- Webhooks: `await request.json()` before `constructEvent`; `STRIPE_WEBHOOK_SECRET` unused.
- Login, sign-up, invite, reset actions without rate limiting.

## Output

- `{@html data.body}` with Markdown from users: `marked` and `markdown-it` do not sanitise;
  `DOMPurify` or `sanitize-html` after rendering, server-side with `isomorphic-dompurify`.
- `href={data.url}` accepting `javascript:`.
- Error pages (`+error.svelte`) showing `error.message` from the server for 500s is fine only if
  `handleError` returns a safe message.

## handleError and logging

- `handleError` returning `message: err.message`, `stack`, `query`, or the request body.
- `console.error(event.request.headers)` with cookies; logging form data on auth actions.

## Environment

- `$env/static/public` / `PUBLIC_*` with `SERVICE_ROLE`, `SECRET`, `PRIVATE`, `API_KEY` in the name.
- `$env/dynamic/private` read in a `+page.svelte` (build fails) versus a value passed through
  `load` (silently public).
- `.env` tracked; `.env.example` with real-looking values; secrets defaulted with `??`.

## Adapter and deployment

- `adapter-node` with `ORIGIN` unset behind a proxy: CSRF origin check fails open or closed
  depending on version; `PROTOCOL_HEADER`/`HOST_HEADER` trust without a proxy.
- `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Debug endpoints under `src/routes/api/debug` or `/__`, returning env or config.

## Dependencies

- No lockfile; `^` on `stripe`, `lucia`, `@auth/core`, `jsonwebtoken`; `marked` or `dompurify`
  pinned to versions with known advisories; `lodash` < 4.17.21.
