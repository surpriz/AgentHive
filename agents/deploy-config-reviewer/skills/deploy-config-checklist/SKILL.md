---
name: deploy-config-checklist
description: Where deployment configuration hides risk in Next.js, Vercel, Express, FastAPI, SvelteKit and containers: env files, client-visible variables, CORS, headers, debug routes, error handlers, TLS flags and logging.
---

# Deploy config checklist

## Files to read

| Stack | Files |
|---|---|
| Next.js / Vercel | `next.config.*`, `vercel.json`, `middleware.ts`, `app/error.tsx`, `instrumentation.ts`, `.env*` |
| SvelteKit | `svelte.config.*`, `src/hooks.server.ts` (`handle`, `handleError`), `vite.config.*`, `.env*` |
| Express / Fastify / Hono | the entry file, `cors(`, `helmet(`, `app.use(morgan`, error middleware `(err, req, res, next)` |
| FastAPI | `main.py` (`FastAPI(debug=`, `docs_url`, `CORSMiddleware`), exception handlers, `uvicorn` flags |
| Containers | `Dockerfile` (`ENV` with secrets, `--insecure`, root user), `docker-compose*` (ports, env) |

## Environment files

- `git ls-files | grep -i env`: any tracked `.env`, `.env.local`, `.env.production`, `.envrc`.
- A tracked `.env.example` is fine; the finding is when it carries a real-looking value (long
  random strings, `sk_live`, a postgres URL carrying a username and password).
- Variables read with an unsafe default: `?? 'dev'`, `|| ''`, `os.getenv("X", "")`.

## Client-visible variables

- Prefix rules: `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_` (SvelteKit `$env/static/public`), `EXPO_PUBLIC_`,
  `REACT_APP_`. Anything under them is in the bundle. Service keys, signing secrets and server API
  keys under these prefixes: critical.
- `'use client'` files importing a server env or a server-only module.
- SvelteKit: `$env/static/private` imported from a file that is not `+page.server`, `+server` or
  `hooks.server` fails the build, but a value copied into `load`'s return reaches the browser.

## CORS

| Pattern | Risk |
|---|---|
| `origin: '*'` with `credentials: true` | high (browsers block the combo, but a reflected origin does not) |
| `origin: (o, cb) => cb(null, true)` or `origin: req.headers.origin` | high: reflects any origin |
| `allow_origins=["*"]`, `allow_credentials=True` in FastAPI | high |
| regex origin without anchors (`/example\.com/`) | high: `evil-example.com.attacker.io` matches |
| `Access-Control-Allow-Origin: *` on routes that read cookies | high |
| `*` on a public read-only JSON API without credentials | fine, say so |

## Debug and admin routes

Search for `process.env` or `os.environ` in a response, `/debug`, `/__`, `/internal`, `/admin`,
`/metrics` without auth, `/docs` and `/redoc` in FastAPI with `docs_url` not disabled in production,
GraphQL `introspection: true` or playground, `app.get('/env'`, `phpinfo`-style dumps, `eval` of a
query parameter. A route is guarded only if the guard runs before the response and depends on a
production-time value, not on a comment.

## Error handlers

- Express `(err, req, res, next) => res.status(500).json({ error: err.message, stack: err.stack })`.
- SvelteKit `handleError` returning `stack`, `query` or the original message.
- Next.js Route Handlers returning `String(error)` or `error.message` from database errors.
- FastAPI `FastAPI(debug=True)`, custom handlers returning `repr(exc)` or `traceback.format_exc()`.
- Prisma or SQL errors with the query text passed through.

## Transport

`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` (code or Dockerfile `ENV`),
`verify=False` in requests or httpx, `ssl._create_unverified_context`, `curl -k`, `--insecure`,
`strict-ssl=false`, `http://` for anything carrying a credential. Also `secure: false` on cookies in
production and `trust proxy` set to `true` without a proxy.

## Headers

`helmet()` present or `headers()` in `next.config`; frame protection on authenticated pages;
`Strict-Transport-Security` on custom domains; `Permissions-Policy` optional. Report absence as low
or medium, never above.

## Logging

`morgan('combined')` with headers, `console.log(req.headers)`, `console.log(req.body)` on auth
routes, `logger.info(config)` or `console.log(process.env)` at startup, Sentry `sendDefaultPii`
without scrubbing.
