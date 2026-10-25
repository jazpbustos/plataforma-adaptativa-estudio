"""Medición de la recuperación (HU-003) con el conjunto de prueba de evaluacion/consultas.json.

Comprueba que el conjunto esté bien armado (temas existentes y secciones esperadas que aparecen en los
textos de las fuentes) y que las métricas se calculen bien. Usa el modelo de embeddings falso de conftest.py.
"""
import json
from pathlib import Path

import pytest

from app import evaluar
from app.db import TEMAS
from app.services import rag

CONJUNTO = json.loads((Path(__file__).parent.parent / "evaluacion" / "consultas.json").read_text(encoding="utf-8"))


def fragmento(seccion, fuente="Think Python", similitud=0.8):
    return {"texto_original": "x", "nombre_archivo": fuente, "pagina_o_seccion": seccion, "similitud": similitud}


# ---------------- Conjunto de prueba ----------------

def test_conjunto_de_prueba_bien_armado():
    consultas = CONJUNTO["consultas"]
    assert len({c["id"] for c in consultas}) == len(consultas) >= 25
    assert sum(c["tema"] == "Recursividad" and bool(c["secciones"]) for c in consultas) >= 15
    for tema in TEMAS:
        if tema != "Recursividad":
            assert sum(c["tema"] == tema and bool(c["secciones"]) for c in consultas) >= 2, tema
    assert sum(not c["secciones"] for c in consultas) >= 5  # negativas: deben dar material insuficiente


def test_las_secciones_esperadas_existen_en_las_fuentes():
    if evaluar.secciones_reales("Recursividad") is None:
        pytest.skip("faltan los textos de las fuentes (python -m app.fuentes)")
    assert evaluar.verificar(CONJUNTO) == []


def test_verificar_detecta_secciones_inventadas(monkeypatch):
    monkeypatch.setattr(evaluar, "secciones_reales", lambda tema: ["Cap. 5 · 5.10. Infinite recursion"])
    conjunto = {"consultas": [{"id": "X1", "tema": "Recursividad", "secciones": ["5.10. Infinite recursion", "9.9 Inventada"]},
                              {"id": "X2", "tema": "Tema que no existe", "secciones": []}]}
    assert evaluar.verificar(conjunto) == ["X1: la sección '9.9 Inventada' no está en las fuentes de Recursividad",
                                           "X2: el tema 'Tema que no existe' no existe"]


def test_coincidencia_de_secciones():
    assert evaluar.coincide("Infinite recursion", "Cap. 5 (5.8 a 5.10) · 5.10. Infinite recursion")
    assert evaluar.coincide("infinite RECURSION", "5.10. Infinite recursion")  # sin distinguir mayúsculas
    assert evaluar.coincide("Cap. 1: Recursion · pág. 3", "Cap. 1: Recursion · pág. 3")
    assert not evaluar.coincide("Cap. 1: Recursion · pág. 3", "Cap. 1: Recursion · pág. 30")
    assert not evaluar.coincide("5.1", "5.10. Infinite recursion")


# ---------------- Métricas ----------------

def test_metricas_por_consulta_y_resumen():
    pos = {"id": "R1", "secciones": ["Caso base"]}
    neg = {"id": "N1", "secciones": []}
    devueltos = [fragmento("Pila", "A", 0.9), fragmento("4.4 · Caso base", "A", 0.7), fragmento("Caso base", "B", 0.6)]
    m1 = evaluar.medir(pos, devueltos, devueltos)
    assert (m1["posicion"], m1["suficiente"], round(m1["concentracion"], 3), m1["similitud_maxima"]) == (2, True, 0.667, 0.9)
    m2 = evaluar.medir(pos, devueltos[1:2], devueltos)  # un solo fragmento: insuficiente, aunque acierta
    assert (m2["posicion"], m2["suficiente"]) == (1, False)
    m3 = evaluar.medir(neg, devueltos[:2], devueltos)
    assert m3["posicion"] is None and m3["suficiente"]
    r = evaluar.resumir([m1, m2, m3])
    assert (r["acierto@1"], r["acierto@6"], r["mrr"]) == (0.5, 1, 0.75)
    assert (r["positivas suficientes"], r["rechazo de negativas"]) == (0.5, 0)
    assert evaluar.distribucion([0.4, None, 0.8]) == {"n": 2, "mínimo": 0.4, "máximo": 0.8, "promedio": 0.6}


def test_evaluar_corre_la_busqueda_real_del_rag_para_cada_umbral(tmp_path):
    tema = 1
    for i, (texto, seccion) in enumerate([("El caso base detiene la recursión y evita llamadas infinitas.", "4.4 Caso base"),
                                          ("La pila de llamadas guarda cada invocación pendiente.", "4.6 Pila")]):
        rag.indexar([rag.Seccion(texto, seccion)], id_origen=i, id_tema=tema, fuente=rag.ACADEMICA,
                    nombre_archivo="Think Python", prefijo=f"f{i}")
    conjunto = {"consultas": [
        {"id": "R1", "tema": "Recursividad", "consulta": "qué es el caso base de la recursión", "secciones": ["4.4 Caso base"]},
        {"id": "N1", "tema": "Recursividad", "consulta": "tablas hash y colisiones", "secciones": []}]}
    r = evaluar.evaluar(conjunto, {"Recursividad": tema}, [-1.0, 0.99])
    assert r["umbrales"][-1.0]["acierto@1"] == 1 and r["umbrales"][-1.0]["rechazo de negativas"] == 0
    assert r["umbrales"][0.99]["acierto@1"] == 0 and r["umbrales"][0.99]["rechazo de negativas"] == 1
    assert r["detalle"][0]["posicion_sin_umbral"] == 1 and r["distribucion"]["negativas"]["n"] == 1
    # El informe se crea con su título la primera vez y después se le agregan secciones.
    informe = tmp_path / "informe.md"
    evaluar.agregar_al_informe("inicial", evaluar.tablas(r, 0.99), informe)
    evaluar.agregar_al_informe("limpieza", evaluar.tablas(r, 0.99), informe)
    texto = informe.read_text(encoding="utf-8")
    assert texto.count("# Evaluación de la recuperación") == 1 and "## inicial ·" in texto and "## limpieza ·" in texto
    assert "**0.99** (actual)" in texto and "| R1 |" in texto
