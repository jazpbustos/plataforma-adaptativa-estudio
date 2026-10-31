"""Tareas del despliegue (Dockerfile y start.sh). No se usan en desarrollo.

    python -m app.produccion modelos    descarga los modelos de embeddings y re-ranking (al construir la imagen)
    python -m app.produccion fuentes    carga las fuentes académicas si la base todavía no las tiene (al arrancar)
"""
import json
import sys

from sqlmodel import Session, select

from .db import engine, init_db
from .models import FuenteAcademica
from .services import rag


def modelos() -> None:
    # Quedan dentro de la imagen (FASTEMBED_CACHE_PATH): el servidor no los descarga en cada arranque.
    rag._FastEmbed()
    rag._CrossEncoder()
    print("Modelos descargados.")


def fuentes() -> None:
    # Solo mientras falte alguna (la primera vez, o si una descarga falló en el arranque anterior).
    # Para actualizarlas después: python -m app.fuentes.
    from . import fuentes as carga
    init_db()
    catalogo = json.loads(carga.CATALOGO.read_text(encoding="utf-8"))
    esperadas = sum(len(por_fuente) for por_fuente in catalogo["temas"].values())
    with Session(engine) as db:
        cargadas = len(db.exec(select(FuenteAcademica.id_fuente)).all())
    if cargadas >= esperadas:
        print(f"Las {esperadas} fuentes académicas ya están cargadas.")
        return
    carga.main()


if __name__ == "__main__":
    {"modelos": modelos, "fuentes": fuentes}[sys.argv[1]]()
