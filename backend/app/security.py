"""Sesión propia de la plataforma: JWT firmado guardado en una cookie httpOnly.

Flujo: el front abre el popup de Google y recibe un access token → el backend le pregunta
a Google si ese token es válido y fue emitido para nuestro client ID → crea/actualiza el
estudiante → emite su propio JWT.
Así el front nunca maneja tokens (httpOnly evita que JS los lea ante un XSS).
"""
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Depends, HTTPException, Response, status
import requests
from sqlmodel import Session

from .config import settings
from .db import get_session
from .models import ROL_ADMIN, ROL_ESTUDIANTE, Estudiante

COOKIE_NAME = "session"
ALGORITHM = "HS256"
TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def verify_google_access_token(access_token: str) -> dict:
    """Verifica el access token con Google y devuelve los datos de la cuenta (sub, email, name, picture).

    1. tokeninfo: el token es válido, no venció y su audiencia es NUESTRO client ID. Sin este control,
       un token emitido para otra app podría usarse para entrar a la plataforma.
    2. userinfo: nombre, correo verificado y foto de la cuenta, con el mismo "sub" que el token.
    """
    if not settings.google_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Falta GOOGLE_CLIENT_ID en el servidor")
    invalido = HTTPException(status.HTTP_401_UNAUTHORIZED, "Token de Google inválido")
    try:
        token = requests.get(TOKENINFO_URL, params={"access_token": access_token}, timeout=10)
        if token.status_code != 200:
            raise invalido
        token = token.json()
        if token.get("aud") != settings.google_client_id:
            raise invalido
        cuenta = requests.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
        if cuenta.status_code != 200:
            raise invalido
        cuenta = cuenta.json()
    except requests.RequestException:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No se pudo verificar la cuenta con Google. Probá de nuevo.")
    if cuenta.get("sub") != token.get("sub") or not cuenta.get("email_verified"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Cuenta de Google no verificada")
    return cuenta


def create_token(id_estudiante: int, rol: str = ROL_ESTUDIANTE, version: int = 0) -> str:
    """JWT propio con validez de ocho horas (Seguridad). Lleva la identidad, el rol y la versión de sesión."""
    now = datetime.now(timezone.utc)
    payload = {"sub": str(id_estudiante), "rol": rol, "ver": version, "iat": now,
               "exp": now + timedelta(minutes=settings.jwt_expire_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def set_session_cookie(response: Response, est: Estudiante) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_token(est.id_estudiante, est.rol, est.version_sesion or 0),
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
) -> Estudiante:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión no iniciada o vencida")
    if not session_token:
        raise unauthorized
    try:
        payload = jwt.decode(session_token, settings.jwt_secret, algorithms=[ALGORITHM])
        user = db.get(Estudiante, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    if not user:
        raise unauthorized
    # Revocación: un token emitido antes del último cierre de sesión (o de una revocación hecha por el
    # responsable técnico) lleva una versión vieja y se rechaza aunque no haya vencido.
    if payload.get("ver", 0) != (user.version_sesion or 0):
        raise unauthorized
    return user


def revocar_sesiones(db: Session, user: Estudiante) -> None:
    """Invalida todos los tokens del usuario emitidos hasta ahora, en cualquier dispositivo."""
    user.version_sesion = (user.version_sesion or 0) + 1
    db.add(user)
    db.commit()


def usuario_del_token(session_token: str | None, db: Session) -> Estudiante | None:
    """El usuario de una cookie de sesión, o None si no hay cookie o no es válida (sin lanzar error)."""
    try:
        return current_user(session_token, db)
    except HTTPException:
        return None


def solo_administrador(user: Estudiante = Depends(current_user)) -> Estudiante:
    """Opciones reservadas al administrador (Tabla de niveles de acceso): temas, fuentes, ejercicios y roles.

    El rol se toma de la base en cada solicitud, no del token ni de un parámetro del navegador: si se le
    quitó el rol a alguien, deja de valer en su siguiente solicitud, aunque su token todavía no haya vencido.
    """
    if user.rol != ROL_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esta opción es solo para administradores")
    return user
