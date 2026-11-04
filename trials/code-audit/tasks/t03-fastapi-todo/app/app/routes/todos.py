from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import Todo, User, get_db

router = APIRouter()


class TodoIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class TodoOut(BaseModel):
    id: int
    title: str
    done: bool


def _own(db: Session, user: User, todo_id: int) -> Todo:
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.owner_id == user.id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="not found")
    return todo


@router.get("", response_model=list[TodoOut])
def list_todos(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.query(Todo).filter(Todo.owner_id == user.id).order_by(Todo.created_at.desc()).all()


@router.post("", response_model=TodoOut, status_code=201)
def create_todo(body: TodoIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    todo = Todo(owner_id=user.id, title=body.title)
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


@router.post("/{todo_id}/toggle", response_model=TodoOut)
def toggle_todo(todo_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    todo = _own(db, user, todo_id)
    todo.done = not todo.done
    db.commit()
    return todo


@router.delete("/{todo_id}", status_code=204)
def delete_todo(todo_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, user, todo_id))
    db.commit()
