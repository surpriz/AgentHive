---
name: query-safety-patterns
description: Per-library list of database calls where request data can change query structure, the checks that look safe but are not, and the safe form to recommend for Prisma, Drizzle, Supabase, Mongo, SQLAlchemy and raw drivers.
---

# Query safety patterns

## Sinks by library

| Library | Risky | Safe form |
|---|---|---|
| Prisma | `$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.raw(input)`, `where: req.query` | `$queryRaw` tagged template, `Prisma.sql`, explicit `where` fields |
| Drizzle | `sql.raw(input)`, string concat inside `sql\`\``, `orderBy(sql.raw(col))` | `sql\`${value}\`` (binds), column objects from a map |
| Supabase | `.filter(col, op, v)` with op from input, `.order(col)` col from input, `.rpc(fn, body)` into dynamic SQL, `.or(string)` built from input | `.eq/.in/.gte` with values, column from an allowlist |
| Mongoose / mongodb | `find(req.body)`, `find({ name: req.query.name })` when name can be an object, `$where`, `$regex` from input, `$expr`, `findByIdAndUpdate(id, req.body)` | cast to primitive (`String(v)`), `$eq: v`, `mongo-sanitize`, explicit field list |
| SQLAlchemy | `text(f"...")`, `execute("..." % x)`, `.filter(text(...))`, `order_by(text(col))` | `text("... :x").bindparams`, `getattr(Model, col)` after an allowlist |
| pg / mysql2 / sqlite3 | string concat, template literals in `query()`, `format()` without `%I` for identifiers | `$1`/`?` placeholders, `pg-format` `%I` for identifiers |
| knex | `.raw(input)`, `.whereRaw(input)`, `.orderByRaw(input)` | bindings `??` for identifiers, `?` for values |

## Checks that look safe but are not

- `allowed.includes(input.split(' ')[0])`, `input.startsWith(allowed)`, `allowed.some(a => input.includes(a))`.
- `escape(input)` or a regex that strips quotes before an identifier position (quotes are not the
  only way out of an identifier; a backtick or `"` ending works per dialect).
- `z.string()`, `typeof x === 'string'`, `.trim()` before a raw query: type, not safety.
- `parseInt` on a value then interpolated as text: safe for that value only if the result is checked
  for `NaN`.
- Operator injection in Mongo: a body parser that accepts JSON lets `{ "password": { "$ne": "" } }`
  through unless the value is cast to a primitive. `express-mongo-sanitize` or a schema that
  requires `z.string()` on each field fixes it; a `$where` with a string from input is never fixable.
- `ObjectId.isValid(x)` protects the id, not the rest of the filter.

## Mass assignment

- `prisma.user.update({ where, data: req.body })`, `data: { ...parsed.data }` where the schema
  has `role`, `isAdmin`, `is_admin`, `ownerId`, `userId`, `tenantId`, `price`, `amount`, `paidAt`,
  `status`, `verified`, `email` (when email changes need verification).
- Pydantic models with `extra = "allow"` or `model_dump()` spread into an update; `setattr` loops over
  the body.
- Mongoose `strict: false`, `Model.create(req.body)` on a schema with privileged fields.
- Prisma `select` or `include` taken from the request (lets a client read relations).

## Writing the evidence

Quote the source line, every transformation, and the sink line. Name the dialect quirk that makes
the break-out work (double quotes end identifiers in Postgres, backticks in MySQL). State what the
attacker reads or changes, in terms of the app's data. One finding per sink; several sinks sharing
one unsafe helper merge into one finding on the helper, with the call sites listed.
