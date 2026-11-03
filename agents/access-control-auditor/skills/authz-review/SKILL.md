---
name: authz-review
description: Method and checklist for finding missing authentication, broken authorization, IDOR and client-trusted roles in Next.js, Express and Prisma code.
---

# Authorization review

Three questions for every entry point: is the caller known (authentication), is the caller allowed
to perform this action (authorization), and is the query limited to the caller's objects (scoping).
A miss on any of them is a finding. Most AI-generated apps pass the first and fail the other two.

## Finding the entry points

- Next.js App Router: `app/**/route.ts|js` exports `GET`, `POST`, ...; server actions are functions
  in files with `"use server"` at the top, or inline with the directive inside the function; server
  components fetch data in `page.tsx` / `layout.tsx`. `middleware.ts` at the root runs before routes
  matched by `config.matcher`.
- Next.js Pages Router: `pages/api/**` default-exports a handler; `getServerSideProps` runs on the
  server and often loads data by id.
- Express, Fastify, Hono, Koa: `app.<verb>(path, ...handlers)`, `router.<verb>`, `app.use(prefix,
  router)`. Middleware order matters: a `requireAuth` registered after the route does nothing.
- tRPC: `publicProcedure` vs `protectedProcedure`; a `publicProcedure` that writes data is a finding.
- Prisma: every `prisma.<model>.<op>(` call; check `where` for a caller-derived filter.

## Authentication checks that count

A check counts when it runs before any data access, on the server, and the code stops when it fails.
Recognise: `await auth()` (NextAuth v5), `getServerSession(authOptions)`, `supabase.auth.getUser()`,
`currentUser()` / `auth().protect()` (Clerk), `lucia.validateSession`, `jwt.verify(token, secret)`
with the secret from the server env, `passport.authenticate`, a custom `requireUser()` that throws.

Does not count: `getSession()` from the client SDK, a cookie read without verification,
`jwt.decode` (no signature check), `if (!user) console.log('no user')` without return, a check in
`middleware.ts` whose `matcher` does not include the route, `useUser()` in a component (client-side
only), a comment saying auth is handled elsewhere.

## Authorization and roles

- Where does the role come from? Trusted: a database column read with the verified user id, a JWT
  claim in a token the server verified, `app_metadata` in Supabase. Untrusted: `req.body.role`,
  `searchParams.get('admin')`, an unsigned cookie, a header the client sets, `localStorage`,
  Supabase `user_metadata`, a hidden form field.
- Search terms: `isAdmin`, `role ===`, `role:`, `admin`, `superuser`, `plan`, `tier`, `isPro`,
  `organizationId`, `tenantId`. Trace each to its source.
- Admin pages hidden by the UI only (`if (!isAdmin) return null` in a component) while the API that
  backs them has no check: the API is the finding, the UI is irrelevant.
- Membership checks for teams and organisations: the handler must verify the user belongs to the org
  in the request, not only that the user is logged in.

## Object scoping (IDOR)

The pattern: an id from `params`, `searchParams`, `req.params`, `req.query` or the body goes into a
query that filters only by that id. Examples that are findings:

- `prisma.invoice.findUnique({ where: { id: params.id } })` in a handler that then returns the row.
- `supabase.from('orders').select().eq('id', id)` with the service client.
- `UPDATE users SET ... WHERE id = $1` with `$1` from the request and no `AND id = session.user.id`.
- Delete and update routes are worse than reads: check them first.
- Bulk endpoints: `findMany({ where: { id: { in: ids } } })` without a caller filter.

Not a finding: the filter includes the caller (`where: { id, userId: user.id }`), or RLS enforces it
and the query uses the user's client, or the object is public by design.

Unguessable ids (UUID, cuid) reduce likelihood, not severity: ids leak in URLs, logs and referers.
Report at medium instead of high when ids are unguessable and the data is not sensitive.

## Next.js middleware specifics

- `config.matcher` decides everything. `['/dashboard/:path*']` protects pages, not `/api/*`. Server
  actions are POSTs to the page URL, so a matcher on the page covers them only if the page is matched.
- Middleware that redirects unauthenticated users is a UX feature. Route Handlers must check again.
- Middleware runs on the edge; a `fetch` to your own API inside it is not an auth check.
- A header set by middleware (`x-user-id`) and read by handlers is trustworthy only if middleware
  strips the incoming header first; otherwise the client can set it.

## Severity

- critical: unauthenticated read or write of other users' data; client-supplied role gates admin.
- high: authenticated IDOR; RLS off on user data; service key used with request-controlled filters.
- medium: inconsistent checks across similar routes; obscurity-only protection; `getSession` only.
- low: defence-in-depth (missing double check behind a correct middleware), stale TODOs.

## Fix patterns to recommend

- A single `requireUser()` helper that returns the verified user or throws, used at the top of every
  handler and action.
- Ownership in the query, not after: `where: { id, userId }`; return 404 on no match (not 403).
- A `requireRole('admin')` helper backed by a database column.
- For Supabase: RLS on, policies with `auth.uid()`, service key only in server-only modules.
