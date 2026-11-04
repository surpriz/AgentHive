---
name: nextjs-supabase-checklist
description: Where Next.js App Router apps on Supabase written with AI help go wrong: client choice per query, getUser versus getSession, server actions and route handlers without checks, middleware matchers, NEXT_PUBLIC leaks, auth callback redirects, storage, webhooks and next.config.
---

# Next.js and Supabase checklist

## Which client runs the query

| Client | Where it is safe |
|---|---|
| browser client (`createBrowserClient`, anon key) | only with RLS on every table it touches |
| server client with cookies (`createServerClient`, anon key + user session) | same; RLS still applies |
| service-role client (`SUPABASE_SERVICE_ROLE_KEY`) | server-only code that does its own authorization and never takes filters from the request |

A service-role client created in `lib/` and imported by a route handler that passes `params.id`
straight to `.eq('id', id)` bypasses RLS: high. The key under `NEXT_PUBLIC_` or in a `'use
client'` file: critical.

## Checks in server code

- `const { data: { user } } = await supabase.auth.getUser()` before any data access in server
  actions and route handlers. `getSession()` reads the cookie without verifying; on the server
  it is not an auth check.
- `if (!user) throw` or `return` immediately; code that continues with `user?.id` and an
  undefined filter matches nothing or everything depending on the client.
- Server actions take ids from `FormData`: the update must be scoped (`.eq('owner_id', user.id)`)
  or run through the user client with an RLS policy that scopes it. A `using (true)` update
  policy makes the user client as dangerous as service role.
- `revalidatePath` after a write is not a check.

## Middleware

- `middleware.ts` `matcher` lists the protected prefixes. `/api/*` and server actions outside it
  are unprotected unless they check themselves. A redirect in middleware is not authorization for
  a route handler called directly.
- `updateSession` from the Supabase SSR template refreshes tokens; it does not deny access unless
  the project added the redirect.

## Roles

- `user.user_metadata.role` is user-writable: never a role source. `app_metadata` (set by a
  service call) or a `profiles.role` column with an RLS policy that forbids self-update.
- Admin checks done only in a layout (`app/admin/layout.tsx`) do not protect the route handlers
  under `app/admin/api`.

## Auth callback and redirects

- `app/auth/callback/route.ts`: `next` from the query must be a same-site path; `new URL(next,
  origin)` accepts absolute URLs and is the usual open redirect. `redirect(next)` in server
  actions with `next` from a hidden form field: same.
- Password reset and OTP: rely on Supabase for throttling of its own endpoints; custom routes
  that call `signInWithPassword` in a loop-able way need their own limit.

## Public environment

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are fine. Anything else under
  `NEXT_PUBLIC_` that names a secret, service role, signing key or server API key: critical.
- `'use client'` components importing from `lib/supabase-admin` or `process.env.X` without the
  prefix (undefined at runtime, but the intent shows a mistake elsewhere).

## Storage

- Buckets created `public` holding user uploads; storage policies absent while the app uploads
  with the anon client; signed URLs with long expiry listed in client code.

## Webhooks and payments

- Stripe handler using `await request.json()` before `constructEvent`; `STRIPE_WEBHOOK_SECRET`
  unused; Supabase database webhooks called without the shared secret header check.

## Output and boundaries

- `dangerouslySetInnerHTML` with Markdown from users and no sanitiser; `href` from user input.
- Route handlers that `fetch(body.url)` and return the body; `fs` reads from `params`.

## next.config and Vercel

- `headers()` with `Access-Control-Allow-Origin: *` on `/api/:path*` while routes read cookies.
- `images.remotePatterns` with `hostname: '**'` (SSRF-adjacent through the image optimizer).
- `vercel.json` rewrites that expose `/api/internal`; cron routes without `CRON_SECRET` checks.
- `experimental` flags that disable origin checks for server actions (`serverActions.allowedOrigins`
  with wildcards).

## Dependencies

- No lockfile; `next` pinned to a version with a known middleware authorization bypass; `^` on
  `@supabase/ssr` and payment SDKs; advisories you recognise.
