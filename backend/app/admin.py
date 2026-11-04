"""Tareas del responsable técnico sobre las cuentas, ejecutadas en el servidor (Seguridad).

    python -m app.admin habilitar correo@dominio    asigna el rol de administrador (por ejemplo, al primero)
    python -m app.admin quitar correo@dominio       quita el rol de administrador
    python -m app.admin revocar correo@dominio      cierra todas las sesiones de la cuenta (sesión comprometida)

La cuenta tiene que haber ingresado antes con Google, para existir en la base. El rol se lee de la base en
cada solicitud, así que habilitarlo o quitarlo vale desde la siguiente solicitud del usuario.
"""
import sys

from sqlmodel import Session, select

from .db import engine, init_db
from .models import ROL_ADMIN, ROL_ESTUDIANTE, Estudiante
from .security import revocar_sesiones


def main(argv: list[str]) -> str:
    if len(argv) != 2 or argv[0] not in ("habilitar", "quitar", "revocar"):
        return __doc__
    accion, correo = argv
    init_db()
    with Session(engine) as db:
        est = db.exec(select(Estudiante).where(Estudiante.correo_electronico == correo)).first()
        if not est:
            return f"No hay ninguna cuenta con el correo {correo}: tiene que ingresar primero con Google."
        if accion == "revocar":
            revocar_sesiones(db, est)
            return f"Se cerraron todas las sesiones de {correo}."
        est.rol = ROL_ADMIN if accion == "habilitar" else ROL_ESTUDIANTE
        db.add(est)
        db.commit()
        return f"{correo} ahora tiene el rol de {est.rol}."


if __name__ == "__main__":
    print(main(sys.argv[1:]))
