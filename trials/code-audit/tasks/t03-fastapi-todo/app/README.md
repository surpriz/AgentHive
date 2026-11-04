# todo-api

FastAPI backend for the Tickoff mobile app. SQLite in development, Postgres in
production through `DATABASE_URL`. JWT auth, todos per user, a small admin surface.

```
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Routes live in `app/routes`. Auth helpers in `app/auth.py`.
