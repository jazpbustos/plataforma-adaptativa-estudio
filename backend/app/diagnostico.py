"""Diagnóstico de una consulta de Aprender: qué material propio usa el plan y qué fragmentos recupera el RAG.

Uso (desde backend/, con el entorno virtual activo):
    python -m app.diagnostico 1 "q es sintaxis?"

El primer número es el id del plan (el de la URL: /api/plans/1/...). Hace la misma búsqueda que la consulta
libre de Aprender, con las fuentes académicas del tema y el material propio procesado de ese plan.
"""
import sys

from sqlmodel import Session, select

from .config import P
from .db import engine
from .models import MaterialEstudio, ObjetivoEstudio, Tema
from .services import rag


def main(plan_id: int, consulta: str) -> None:
    with Session(engine) as db:
        obj = db.get(ObjetivoEstudio, plan_id)
        if not obj:
            sys.exit(f"No existe el plan {plan_id}.")
        tema = db.get(Tema, obj.id_tema)
        materiales = db.exec(select(MaterialEstudio).where(MaterialEstudio.id_objetivo == plan_id)).all()
    print(f"Plan {plan_id} · tema: {tema.nombre}")
    print("Material propio del plan:" if materiales else "Material propio del plan: ninguno")
    for m in materiales:
        print(f"   id {m.id_material} · {m.nombre_archivo} · estado: {m.estado}")
    propios = [m.id_material for m in materiales if m.estado == "procesado"]

    print(f"\nFragmentos propios indexados en ChromaDB: "
          f"{len(rag.almacen().get(where={'$and': [{'fuente': rag.PROPIA}, {'id_origen': {'$in': propios}}]})['ids']) if propios else 0}")

    R = P["rag"]
    print(f"\nConsulta: {consulta!r} · similitud mínima {R['similitud_minima']} · mínimo {R['fragmentos_minimos']} fragmentos")
    print("\nSin umbral (los 6 mejores de cada fuente, para ver cuánto les falta):")
    for f in rag.buscar(obj.id_tema, consulta, propios, minima=0.0, lenguaje=obj.lenguaje):
        print(f"   [{f['similitud']:.2f}] {f['fuente']:9} · {f['nombre_archivo'][:45]:45} · {f['texto_original'][:70]!r}")

    r = rag.recuperar(obj.id_tema, consulta, propios, obj.lenguaje)
    print(f"\nCon el umbral: {sum(len(f['recuperados']) for f in r['fragmentos'])} fragmentos · "
          f"{'SUFICIENTE' if r['suficiente'] else 'INSUFICIENTE'}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(int(sys.argv[1]), sys.argv[2])
