from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from ..config import settings
from ..db import get_session
from ..models import User, utcnow
from ..schemas import GoogleLoginIn, UserOut
from ..security import clear_session_cookie, current_user, set_session_cookie, verify_google_credential

router = APIRouter(prefix="/auth", tags=["auth"])


def upsert_user(db: Session, sub: str, email: str, name: str, picture: str | None) -> User:
    user = db.exec(select(User).where(User.google_sub == sub)).first()
    if user:
        user.email, user.name, user.picture, user.last_login = email, name, picture, utcnow()
    else:
        user = User(google_sub=sub, email=email, name=name, picture=picture)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/config")
def auth_config():
    """El front lee de acá el client ID: una sola fuente de configuración."""
    return {"google_client_id": settings.google_client_id or None, "dev_login": settings.dev_login}


@router.post("/google", response_model=UserOut)
def login_google(body: GoogleLoginIn, response: Response, db: Session = Depends(get_session)):
    info = verify_google_credential(body.credential)
    user = upsert_user(db, info["sub"], info["email"], info.get("name") or info["email"], info.get("picture"))
    set_session_cookie(response, user.id)
    return user


@router.post("/dev", response_model=UserOut)
def login_dev(response: Response, db: Session = Depends(get_session)):
    """Usuario de prueba para desarrollar sin Google. Deshabilitado si DEV_LOGIN=false."""
    if not settings.dev_login:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    user = upsert_user(db, "dev-user", "demo@plataforma.local", "Usuario Demo", None)
    set_session_cookie(response, user.id)
    return user


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/logout", status_code=204)
def logout(response: Response):
    clear_session_cookie(response)
