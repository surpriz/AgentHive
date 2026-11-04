---
name: fastapi-security-checklist
description: Where FastAPI and Flask apps written with AI help go wrong: unapplied dependencies, PyJWT and python-jose options, SQLAlchemy text and f-strings, Pydantic extra fields, subprocess and path sinks, debug and docs settings, CORS and rate limits.
---

# FastAPI security checklist

## Access

- Route without `Depends(current_user)` (or the project's equivalent) that reads or writes user
  data. Check `APIRouter(dependencies=[...])` and `include_router(..., dependencies=[...])` too.
- `admin_user` or `require_role` defined in `auth.py` and never referenced by a privileged route.
- Query filtered by id only: `db.get(Model, id)`, `.filter(Model.id == id).first()` with no owner
  clause, on routes that take an id from the path.
- Role from the request: `User(**body.model_dump())` with `is_admin` in the model; `PATCH /users/me`
  with a model that includes `is_admin` or `role`; `setattr(user, k, v)` loops.
- Flask: `@login_required` missing; `current_user.is_admin` checked in templates only.

## Tokens

- `jwt.decode(token, SECRET, algorithms=[header["alg"]])`, `options={"verify_signature": False}`,
  `verify=False`, `jwt.get_unverified_claims` used for auth.
- `SECRET = os.getenv("JWT_SECRET", "")` or a literal default; no startup check on length.
- `exp` not set on issue; `leeway` huge; refresh tokens that never expire.
- `itsdangerous` serializers with a default `SECRET_KEY`.

## Queries

- `text(f"...")`, `execute("..." % x)`, `execute("..." + x)`, `cursor.execute(f"...")`.
- `order_by(text(col))`, `getattr(Model, col)` without an allowlist.
- `$where`, `$regex`, dict bodies passed to `find()` in pymongo/motor.
- Safe: bound parameters (`:name`, `%s` with a tuple), ORM filters with values.

## Input and output

- Pydantic `model_config = ConfigDict(extra="allow")`, `class Config: extra = "allow"`; models that
  mirror the table including privileged columns.
- `FileResponse(os.path.join(UPLOAD_DIR, name))` without `resolve()` and `is_relative_to`;
  `StaticFiles(directory=".")`; `open(request_path)`.
- `subprocess.run(cmd, shell=True)`, `os.system`, `eval`, `exec` with request values.
- `httpx.get(url)` / `requests.get(url)` with a request URL, `follow_redirects=True`, host checked
  with `startswith("https://")` only.
- `return {"env": os.environ}`, `settings.dict()`, `traceback.format_exc()` in responses;
  custom exception handlers returning `repr(exc)` or `str(exc)` from database errors.
- `Jinja2Templates` with `autoescape` off, `Markup()`, `|safe` with user content.

## Rate limits and CORS

- Login, sign-up, reset, OTP without `slowapi`, `fastapi-limiter` or a counter: medium, high when
  live and password-based.
- `CORSMiddleware(allow_origins=["*"], allow_credentials=True)`; regex origins unanchored.

## Configuration

- `FastAPI(debug=True)`, `docs_url` enabled by an env var nobody sets in production, `/redoc`.
- `uvicorn ... --reload` or `debug=True` in the Dockerfile `CMD`; `USER` root; secrets in `ENV`.
- `verify=False`, `ssl._create_unverified_context`, `PYTHONHTTPSVERIFY=0`.
- `.env` tracked in git; `.env.example` with real-looking values.

## Dependencies

- No pins (`fastapi` without `==`), no lockfile or hashes.
- Known-risky or abandoned: `python-jose` (unmaintained periods), `pyjwt<2.4`, `flask-security`
  (old fork), `pycrypto`.
- `pip install` from git URLs or `--index-url` overrides in requirements.
