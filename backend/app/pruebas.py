"""Herramientas para las pruebas manuales en local. No se usan en la demo ni en producción.

Con el servidor cerrado, desde la carpeta backend:

    python -m app.pruebas reiniciar       borra los estudiantes y todo lo suyo (objetivos, material, sesiones,
                                          puntos); conserva los temas, los ejercicios y las fuentes académicas
    python -m app.pruebas pasar-dias 3    simula que pasaron 3 días: corre hacia atrás las fechas de los planes
                                          activos (para probar el reajuste y la extensión del plan, HU-010)
    python -m app.pruebas preparar practicar    deja aprobado Aprender en el objetivo más reciente, para grabar o
                                                probar Practicar sin hacer antes la evaluación
    python -m app.pruebas preparar consolidar   además deja resueltos los ejercicios que falten de Practicar
    (al final se puede agregar el correo del estudiante; si no, se usa el objetivo creado más recientemente)
"""
import json
import shutil
import sys
from datetime import date, timedelta

from sqlmodel import Session, delete, select

from .config import settings
from .db import engine, init_db
from .models import (DificultadDetectada, Ejercicio, Estudiante, Explicacion, Intento, MaterialEstudio,
                     NivelDominio, ObjetivoEstudio, Punto, SesionEstudio)
from .services import rag


def reiniciar() -> None:
    init_db()
    with Session(engine) as db:
        materiales = db.exec(select(MaterialEstudio.id_material)).all()
        # Primero los fragmentos del material propio: si no, un material nuevo con el mismo id los heredaría.
        for id_material in materiales:
            rag.borrar_origen(rag.PROPIA, id_material)
        for tabla in (Punto, Explicacion, DificultadDetectada, Intento, SesionEstudio, NivelDominio,
                      MaterialEstudio, ObjetivoEstudio, Estudiante):
            db.exec(delete(tabla))
        db.commit()
    shutil.rmtree(settings.upload_dir, ignore_errors=True)
    print(f"Listo: se borraron los estudiantes y {len(materiales)} archivos de material propio. "
          "Temas, ejercicios y fuentes académicas quedan como estaban.")


def pasar_dias(dias: int) -> None:
    init_db()
    with Session(engine) as db:
        objetivos = db.exec(select(ObjetivoEstudio)).all()
        for obj in objetivos:
            versiones = json.loads(obj.plan_estudio)
            for version in versiones:
                for dia in version["dias"]:
                    dia["fecha"] = (date.fromisoformat(dia["fecha"]) - timedelta(days=dias)).isoformat()
            obj.plan_estudio = json.dumps(versiones, ensure_ascii=False)
            db.add(obj)
        db.commit()
    print(f"Listo: {len(objetivos)} planes corridos {dias} días. Al volver a entrar, el plan se revisa como si "
          "hubieran pasado esos días.")


def preparar(modulo: str, correo: str | None = None) -> None:
    """Deja hechos los pasos que habilitan un módulo, para grabarlo o probarlo sin recorrer los anteriores.

    No genera contenido: agrega la evaluación de Aprender aprobada (80 %) y, para Consolidar, los ejercicios de
    Practicar que falten hasta llegar a cinco, como resueltos sin ayuda. Todo lo demás se usa como siempre."""
    from .routers.practicar import _estado, _puntos_por_ejercicio, _registrar_dominio  # usan la base ya iniciada
    from .services.progreso import APROBADO, EJERCICIOS
    init_db()
    with Session(engine) as db:
        consulta = select(ObjetivoEstudio).order_by(ObjetivoEstudio.id_objetivo.desc())
        if correo:
            consulta = consulta.join(Estudiante).where(Estudiante.correo_electronico == correo.lower())
        obj = db.exec(consulta).first()
        if not obj:
            print("No hay ningún objetivo de estudio" + (f" para {correo}." if correo else ".") +
                  " Entrá a la plataforma y creá uno primero.")
            return
        hechos = []
        if _estado(db, obj)["aprender"]["estado"] != APROBADO:
            db.add(SesionEstudio(id_objetivo=obj.id_objetivo, modulo="aprender", modo="evaluación",
                                 resultado_evaluacion=80))
            hechos.append("Aprender aprobado (evaluación 80 %)")
        if modulo == "consolidar":
            resueltos = set(_puntos_por_ejercicio(db, obj))
            faltan = EJERCICIOS - len(resueltos)
            if faltan > 0:
                pendientes = db.exec(select(Ejercicio).where(Ejercicio.id_tema == obj.id_tema,
                                                             Ejercicio.id_ejercicio.not_in(resueltos))
                                     .order_by(Ejercicio.id_ejercicio)).all()[:faltan]
                sesion = SesionEstudio(id_objetivo=obj.id_objetivo, modulo="practicar")
                db.add(sesion)
                db.flush()
                for ej in pendientes:
                    db.add(Punto(id_sesion=sesion.id_sesion, id_ejercicio=ej.id_ejercicio, cantidad=10,
                                 motivo="resuelto sin ayuda"))
                hechos.append(f"{len(pendientes)} ejercicios de Practicar resueltos")
        db.flush()
        _registrar_dominio(db, obj)
        db.commit()
        estudiante = db.get(Estudiante, obj.id_estudiante)
        print(f"Objetivo de {estudiante.correo_electronico}: " +
              ("; ".join(hechos) if hechos else "no hacía falta nada") + f". Ya podés entrar a {modulo.capitalize()}.")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "reiniciar":
        reiniciar()
    elif len(sys.argv) == 3 and sys.argv[1] == "pasar-dias" and sys.argv[2].isdigit():
        pasar_dias(int(sys.argv[2]))
    elif len(sys.argv) in (3, 4) and sys.argv[1] == "preparar" and sys.argv[2] in ("practicar", "consolidar"):
        preparar(sys.argv[2], sys.argv[3] if len(sys.argv) == 4 else None)
    else:
        print(__doc__)
