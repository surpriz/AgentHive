from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.auth import hash_password, issue_token, verify_password
from app.db import User, get_db

router = APIRouter()


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


@router.post("/signup", status_code=201)
def signup(body: Credentials, db: Session = Depends(get_db)) -> dict:
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="email taken")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return {"token": issue_token(user)}


@router.post("/login")
def login(body: Credentials, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid email or password")
    return {"token": issue_token(user)}


@router.get("/login/continue")
def login_continue(next: str = "/") -> RedirectResponse:
    """After the web login form, send the browser back where it came from."""
    return RedirectResponse(url=next, status_code=302)
