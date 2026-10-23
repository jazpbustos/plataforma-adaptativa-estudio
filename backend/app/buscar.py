"""Prueba manual de recuperación (tarea 07): muestra qué fragmentos encuentra el RAG para una pregunta.

Uso (desde backend/):
    python -m app.buscar "Recursividad" "¿qué pasa si una función recursiva no tiene caso base?"

Busca solo en las fuentes académicas del tema (no en material de estudiantes).
"""
import sys

from sqlmodel import Session, select

from .db import TEMAS, engine
from .models import Tema
from .services import rag


def main(tema: str, pregunta: str, k: int = 4) -> None:
    with Session(engine) as db:
        t = db.exec(select(Tema).where(Tema.nombre == tema)).first()
    if not t:
        sys.exit(f"Tema desconocido. Opciones: {', '.join(TEMAS)}")
    for i, f in enumerate(rag.buscar(t.id_tema, pregunta, materiales_propios=[], k=k), 1):
        lugar = f" · {f['pagina_o_seccion']}" if f["pagina_o_seccion"] else ""
        print(f"\n{i}. [{f['similitud']:.2f}] {f['nombre_archivo']}{lugar}\n   {f['texto_original'][:300]}…")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
