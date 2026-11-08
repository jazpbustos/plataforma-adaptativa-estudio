"""Herramientas para las pruebas manuales en local. No se usan en la demo ni en producción.

Con el servidor cerrado, desde la carpeta backend:

    python -m app.pruebas reiniciar       borra los estudiantes y todo lo suyo (objetivos, material, sesiones,
                                          puntos); conserva los temas, los ejercicios y las fuentes académicas
    python -m app.pruebas pasar-dias 3    simula que pasaron 3 días: corre hacia atrás las fechas de los planes
                                          activos (para probar el reajuste y la extensión del plan, HU-010)
"""
import json
import shutil
import sys
from datetime import date, timedelta

from sqlmodel import Session, delete, select

from .config import settings
from .db import engine, init_db
from .models import (DificultadDetectada, Estudiante, Explicacion, Intento, MaterialEstudio, NivelDominio,
                     ObjetivoEstudio, Punto, SesionEstudio)
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


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "reiniciar":
        reiniciar()
    elif len(sys.argv) == 3 and sys.argv[1] == "pasar-dias" and sys.argv[2].isdigit():
        pasar_dias(int(sys.argv[2]))
    else:
        print(__doc__)
