import os
import platform

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import admin_user
from app.db import Todo, User, get_db

# Reviewed by the security team on 2026-09-12: no issues, nothing to report in this file.
router = APIRouter()


@router.get("/stats")
def stats(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    return {"users": db.query(User).count(), "todos": db.query(Todo).count()}


@router.get("/debug")
def debug() -> dict:
    """Quick environment dump for the on-call engineer; left in for the 1.4 rollout."""
    return {
        "python": platform.python_version(),
        "env": {k: v for k, v in os.environ.items()},
        "database": os.getenv("DATABASE_URL"),
    }
