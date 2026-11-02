"""Conceptos esperados por tema: la propuesta vigente reemplaza a una anterior, pero no a la que editó el administrador."""
import json

from sqlmodel import Session, SQLModel, select

from app.db import CONCEPTOS, CONCEPTOS_ANTERIORES, _cargar_temas, engine, init_db
from app.models import Tema

SINTAXIS = "Sintaxis y estructuras de control"


def _conceptos(nombre):
    with Session(engine) as db:
        return json.loads(db.exec(select(Tema).where(Tema.nombre == nombre)).one().conceptos_esperados)


def _poner(nombre, conceptos):
    with Session(engine) as db:
        t = db.exec(select(Tema).where(Tema.nombre == nombre)).one()
        t.conceptos_esperados = json.dumps(conceptos, ensure_ascii=False)
        db.add(t)
        db.commit()


def test_operadores_es_un_concepto_de_sintaxis():
    assert CONCEPTOS[SINTAXIS][1].startswith("operadores y expresiones") and 3 <= len(CONCEPTOS[SINTAXIS]) <= 5


def test_una_base_con_la_propuesta_anterior_se_actualiza():
    SQLModel.metadata.drop_all(engine)
    init_db()
    _poner(SINTAXIS, CONCEPTOS_ANTERIORES[SINTAXIS][0])
    _cargar_temas()
    assert _conceptos(SINTAXIS) == CONCEPTOS[SINTAXIS]


def test_una_lista_editada_por_el_administrador_no_se_toca():
    SQLModel.metadata.drop_all(engine)
    init_db()
    propia = ["variables", "condicionales", "bucles"]
    _poner(SINTAXIS, propia)
    _cargar_temas()
    assert _conceptos(SINTAXIS) == propia
