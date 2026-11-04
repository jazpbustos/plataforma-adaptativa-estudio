from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from ..config import settings
from ..db import get_session
from ..models import Estudiante, ObjetivoEstudio
from ..schemas import GoogleLoginIn, PreferenciasIn, UserOut
from ..security import (COOKIE_NAME, clear_session_cookie, current_user, revocar_sesiones, set_session_cookie,
                        usuario_del_token, verify_google_access_token)

router = APIRouter(prefix="/auth", tags=["auth"])


def upsert_estudiante(db: Session, id_google: str, correo: str, nombre: str, foto: str | None) -> Estudiante:
    """Primer ingreso: crea el perfil con el rol de estudiante (HU-001, CA1). Ingresos siguientes: actualiza
    nombre, correo y foto, sin tocar el rol."""
    est = db.exec(select(Estudiante).where(Estudiante.id_google == id_google)).first()
    if est:
        est.correo_electronico, est.nombre, est.foto_url = correo, nombre, foto
    else:
        est = Estudiante(id_google=id_google, correo_electronico=correo, nombre=nombre, foto_url=foto)
    db.add(est)
    db.commit()
    db.refresh(est)
    return est


def user_out(db: Session, est: Estudiante) -> UserOut:
    tiene_objetivo = db.exec(select(ObjetivoEstudio.id_objetivo).where(ObjetivoEstudio.id_estudiante == est.id_estudiante)).first() is not None
    lenguaje = est.lenguaje_preferido if est.lenguaje_preferido in ("java", "python") else None
    return UserOut(id=est.id_estudiante, email=est.correo_electronico, name=est.nombre, picture=est.foto_url,
                   role=est.rol, has_plan=tiene_objetivo, preferred_language=lenguaje)


@router.get("/config")
def auth_config():
    """El front lee de acá el client ID: una sola fuente de configuración."""
    return {"google_client_id": settings.google_client_id or None, "dev_login": settings.dev_login}


@router.post("/google", response_model=UserOut)
def login_google(body: GoogleLoginIn, response: Response, db: Session = Depends(get_session)):
    info = verify_google_access_token(body.access_token)
    user = upsert_estudiante(db, info["sub"], info["email"], info.get("name") or info["email"], info.get("picture"))
    set_session_cookie(response, user)
    return user_out(db, user)


@router.post("/dev", response_model=UserOut)
def login_dev(response: Response, db: Session = Depends(get_session)):
    """Usuario de prueba para desarrollar sin Google. Deshabilitado si DEV_LOGIN=false."""
    if not settings.dev_login:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    user = upsert_estudiante(db, "dev-user", "demo@plataforma.local", "Usuario Demo", None)
    set_session_cookie(response, user)
    return user_out(db, user)


@router.get("/me", response_model=UserOut)
def me(user: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    return user_out(db, user)


@router.patch("/me", response_model=UserOut)
def actualizar_preferencias(body: PreferenciasIn, user: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Preferencias de cuenta (no forman parte del DER): hoy, solo el lenguaje por defecto."""
    user.lenguaje_preferido = body.preferred_language
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_out(db, user)


@router.post("/logout", status_code=204)
def logout(response: Response, session_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
           db: Session = Depends(get_session)):
    """Cierra la sesión en todos los dispositivos: además de borrar la cookie, revoca los tokens emitidos hasta
    ahora, de modo que una copia robada del token deja de valer aunque no haya vencido (Seguridad)."""
    if user := usuario_del_token(session_token, db):
        revocar_sesiones(db, user)
    clear_session_cookie(response)
