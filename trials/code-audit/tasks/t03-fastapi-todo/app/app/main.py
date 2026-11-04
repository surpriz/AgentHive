import os

from dotenv import load_dotenv
from fastapi import FastAPI

from app.db import init_db
from app.routes import admin, auth, todos

load_dotenv()

app = FastAPI(title="todo-api", version="1.4.0", docs_url="/docs" if os.getenv("APP_ENV") == "development" else None)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"ok": True}


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(todos.router, prefix="/todos", tags=["todos"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
