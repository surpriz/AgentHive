---
name: express-mongo-checklist
description: Where Express apps on MongoDB written with AI help go wrong: middleware order and mounting, operator injection and $where, role at sign-up, body spreads into Mongoose writes, error handlers, webhooks, rate limits, CORS and connection strings.
---

# Express and Mongo checklist

## Middleware and mounting

- Read `app.use` in order. A router mounted before `app.use(requireAuth)` is public; a router
  mounted without `router.use(requireAuth)` while others have it is the usual gap.
- `app.use(express.json())` before a webhook route that needs the raw body: the signature check
  is skipped or broken.
- Error middleware `(err, req, res, next)` returning `err.message`, `err.stack`, `err` itself, or
  Mongo errors with the query (`E11000` with the document).
- `app.set('trust proxy', true)` behind no proxy: rate limits keyed on a spoofable IP.

## Operator injection

| Pattern | Problem |
|---|---|
| `User.findOne({ email: req.body.email, password: req.body.password })` | `{"$ne": ""}` matches any |
| `Model.find(req.query)` / `find(req.body)` | caller controls the whole filter |
| `{ $where: req.query.filter }` or a string built from input | JavaScript on the server |
| `{ name: { $regex: req.query.q } }` | ReDoS and unanchored match; escape or use text index |
| `Model.aggregate(req.body.pipeline)` | arbitrary pipeline |

Safe: cast to primitives (`String(v)`), `{ $eq: v }`, `express-mongo-sanitize`, a Zod schema with
`z.string()` per field, `mongoose.Types.ObjectId.isValid(id)` for ids.

## Writes

- `Model.create(req.body)`, `new Model(req.body)`, `findByIdAndUpdate(id, req.body)`,
  `updateOne({ _id }, { $set: req.body })` on schemas with `role`, `isAdmin`, `owner`,
  `credits`, `plan`, `verified`.
- Schema `{ strict: false }` or `strictQuery: false`.
- Role at sign-up: `role: req.body.role`, `...req.body` into the user document, `isAdmin` in the
  Joi/Zod schema with no `.strip()`.

## Access

- Detail, update and delete by `_id` without `owner: req.user.id` (or `tenantId`); the list route
  next to it is usually scoped and is the decoy.
- `req.user.role` populated from the token payload that was itself built from the sign-up body.
- `jwt.verify(token, SECRET)` without `algorithms`; `jwt.decode` used as verify;
  `SECRET = process.env.JWT_SECRET || 'secret'`.

## Boundaries

- `res.sendFile(path.join(dir, req.params.name))` without a `root` option or a resolve check;
  `express.static(__dirname)` serving the project root; `multer` without `limits` and with the
  original filename.
- `exec(\`...${req.body.x}\`)`, `execSync`; `axios.get(req.body.url)` with redirects.
- `res.send(\`<h1>${req.query.name}</h1>\`)`, templates with `<%- %>` (EJS unescaped) or
  Handlebars triple-stash on user content.

## Rate limits and CORS

- `express-rate-limit` or `rate-limiter-flexible` absent on `/login`, `/signup`, `/reset`.
- `cors({ origin: true, credentials: true })`, `origin: req.headers.origin`, `'*'` with cookies.

## Configuration

- `mongodb://` without credentials to a non-local host; a `mongodb+srv://` URL with a username and password in code or a
  tracked `.env`; `tls: false` / `tlsAllowInvalidCertificates: true`.
- `NODE_TLS_REJECT_UNAUTHORIZED=0` in code, `package.json` scripts or the Dockerfile.
- Cookies without `httpOnly`/`secure`; `express-session` with a default `secret` or `MemoryStore`
  in production; `helmet` missing (low).
- Debug routes returning `process.env`, `/admin` without role checks, `/graphql` playground.

## Dependencies

- No `package-lock.json` or `pnpm-lock.yaml`; `^` ranges on auth and crypto packages; packages with
  `postinstall`; names one edit away from popular ones; advisories you recognise (old `jsonwebtoken`
  < 9, `mongoose` < 6 prototype pollution, `express-fileupload` < 1.4 traversal).
