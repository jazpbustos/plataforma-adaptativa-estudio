"""Carga del banco de ejercicios en la tabla EJERCICIO (tarea del administrador, Tabla de niveles de acceso).

Uso (desde backend/, con el entorno activado):
    python -m app.ejercicios

Es idempotente: un ejercicio se identifica por su tema y su título (la primera línea del enunciado), así
que volver a correrlo actualiza los ejercicios existentes en lugar de duplicarlos. Las soluciones de
referencia no se cargan.
"""
import json

from sqlmodel import Session, select

from .banco import banco
from .db import engine, init_db
from .models import Ejercicio, Tema


def enunciado(titulo: str, texto: str) -> str:
    return f"# {titulo}\n\n{texto}"


def titulo(ej: Ejercicio) -> str:
    return ej.enunciado.split("\n", 1)[0].removeprefix("# ").strip()


def cargar(iniciar: bool = True) -> dict[str, int]:
    if iniciar:
        init_db()
    cargados = {}
    with Session(engine) as db:
        temas = {t.nombre: t.id_tema for t in db.exec(select(Tema)).all()}
        for nombre, ejercicios in banco().items():
            existentes = {titulo(e): e for e in db.exec(select(Ejercicio).where(Ejercicio.id_tema == temas[nombre])).all()}
            for e in ejercicios:
                fila = existentes.get(e.titulo) or Ejercicio(id_tema=temas[nombre], enunciado="", tiempo_esperado=1,
                                                              casos_prueba="{}")
                fila.enunciado = enunciado(e.titulo, e.enunciado)
                fila.dificultad, fila.tiempo_esperado = e.dificultad, e.tiempo_esperado
                fila.casos_prueba = json.dumps(e.especificacion(), ensure_ascii=False)
                db.add(fila)
            cargados[nombre] = len(ejercicios)
        db.commit()
    return cargados


if __name__ == "__main__":
    for tema, n in cargar().items():
        print(f"  {tema}: {n} ejercicios")
