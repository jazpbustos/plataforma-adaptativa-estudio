"""Sesión propia de la plataforma: JWT firmado guardado en una cookie httpOnly.

Flujo: el front obtiene un ID token de Google → el backend lo verifica con las
claves públicas de Google → crea/actualiza el usuario → emite su propio JWT.
Así el front nunca maneja tokens (httpOnly evita que JS los lea ante un XSS).
"""
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Depends, HTTPException, Response, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlmodel import Session

from .config import settings
from .db import get_session
from .models import User

COOKIE_NAME = "session"
ALGORITHM = "HS256"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def verify_google_credential(credential: str) -> dict:
    """Valida firma, expiración, audiencia (nuestro client ID) y emisor."""
    if not settings.google_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Falta GOOGLE_CLIENT_ID en el servidor")
    try:
        info = id_token.verify_oauth2_token(credential, google_requests.Request(), settings.google_client_id)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token de Google inválido")
    if info.get("iss") not in GOOGLE_ISSUERS or not info.get("email_verified"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Cuenta de Google no verificada")
    return info


def create_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=settings.jwt_expire_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_token(user_id),
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def current_user(
    session_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_session),
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión no iniciada o vencida")
    if not session_token:
        raise unauthorized
    try:
        payload = jwt.decode(session_token, settings.jwt_secret, algorithms=[ALGORITHM])
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    if not user:
        raise unauthorized
    return user
