---
name: supabase-rls-checklist
description: Checklist for reviewing Supabase projects from source: Row Level Security state per table, policy quality, which client key each query uses, storage bucket rules and auth metadata traps.
---

# Supabase RLS checklist

Supabase exposes Postgres directly to the browser through PostgREST. The anon key is public. The only
thing standing between a visitor and every row is Row Level Security. Review it from the source tree;
you cannot query the live database.

## Where to look

- `supabase/migrations/*.sql`, `supabase/schema.sql`, `supabase/seed.sql`, `db/`, `prisma/migrations`
  if Prisma manages the schema on top of Supabase.
- `lib/supabase*.ts`, `utils/supabase/*.ts`, `app/**/supabase*.ts`: client factories.
- `supabase/functions/**` (Edge Functions): each is an HTTP endpoint with its own auth handling.
- `supabase/config.toml`: auth settings, `enable_signup`, email confirmations.

## Per table

For every `create table` found, answer:

1. Is there `alter table <t> enable row level security` in any migration after creation? No: RLS is
   off and every row is readable and writable with the anon key. Critical if the table holds user data,
   high otherwise. The Supabase dashboard shows this as "RLS disabled"; tell the user to look there too.
2. Is RLS enabled but there are no policies? Then nothing is accessible through the API at all, which
   usually means the app uses the service key everywhere. Follow that thread.
3. For each `create policy`, read the `for` clause (select, insert, update, delete, all), the `to`
   role (`anon`, `authenticated`, `public`), `using (...)` and `with check (...)`.
   - `using (true)` on select for a table with emails, names, addresses or payments: high.
   - `using (true)` on insert, update or delete: critical (anyone can write anything).
   - `with check` missing on insert or update: users can insert rows owned by someone else. High.
   - Ownership expressed as `auth.uid() = user_id` or via a membership subquery: good.
   - Ownership expressed by comparing to a column the user can set (`email = ...`,
     `auth.jwt() -> 'user_metadata'`): weak, high. `user_metadata` is writable by the user;
     only `app_metadata` is trusted.
   - Policies that call a function: read the function. `security definer` functions bypass RLS; check
     their `search_path` is set and their parameters are not user-controlled filters.
4. `grant` statements: `grant all on <t> to anon` without RLS is critical. Default Supabase grants give
   anon and authenticated full table access, which is why RLS is the only control.
5. Views: a view `with (security_invoker = false)` (the default before Postgres 15 settings) bypasses
   RLS of underlying tables. Any view over user data should set `security_invoker = true` or be
   restricted with grants.

## Per client

Find every `createClient(` and `createServerClient(` / `createBrowserClient(`:

- Which key? `NEXT_PUBLIC_SUPABASE_ANON_KEY` is fine anywhere. `SUPABASE_SERVICE_ROLE_KEY` (or any key
  whose JWT role is `service_role`) bypasses RLS entirely: it must exist only in server-only files
  (Route Handlers, server actions, `server-only` imports, Edge Functions) and never be returned,
  logged or passed to a component.
- A service client used inside a request handler is acceptable only when the handler itself verifies
  the session and scopes every query with the verified user id. Otherwise `service-key-misuse`, high.
- A service client used to run a filter from the request (`.eq('user_id', body.userId)`) is critical:
  the caller chooses whose data they get.
- `supabase.auth.getSession()` reads the cookie without verifying it on the server; prefer
  `supabase.auth.getUser()` for authorization decisions. Flag `getSession()` used as the only check
  in a server context as medium.

## Storage

- Buckets created `public = true` serve every object to anyone with the path. Fine for avatars; a
  finding for invoices, uploads, exports.
- Storage policies live on `storage.objects`. Check `insert` policies restrict the bucket and the path
  prefix to the user (`(storage.foldername(name))[1] = auth.uid()::text`), otherwise users can
  overwrite each other's files.

## Auth configuration traps

- `raw_user_meta_data` and `user_metadata` are user-editable via `updateUser`. Never a source of roles.
- Triggers that copy `email` into a profiles table: check the profile row is created with the right
  id and that the profiles update policy does not let a user change `role` or `plan` columns
  (use a column-level check or a trigger that resets them).
- RPC functions (`create function ... language sql/plpgsql`) exposed via `.rpc()`: `security definer`
  means they run as the owner. Audit each one like an API route.

## Evidence format

Quote the table name, the migration file and line, the policy text, and the file:line of the query
that reaches it with the anon or user client. The fix is always concrete SQL the user can paste into
a new migration.
