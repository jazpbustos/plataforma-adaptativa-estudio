"""Medición de la recuperación (HU-003) con el conjunto de prueba de evaluacion/consultas.json.

Comprueba que el conjunto esté bien armado (temas, fuentes y expresiones válidas) y que las métricas
se calculen bien. Usa el modelo de embeddings falso de conftest.py.
"""
import json
import re
from pathlib import Path

from app import evaluar
from app.db import TEMAS
from app.services import rag

BACKEND = Path(__file__).parent.parent
TITULOS = {"F2": "Think Python", "F5": "Problem Solving"}


def fragmento(texto, fuente="Think Python", seccion="", similitud=0.8):
    return {"texto_original": texto, "nombre_archivo": fuente, "pagina_o_seccion": seccion, "similitud": similitud}


# ---------------- Conjunto de prueba ----------------

def test_conjunto_de_prueba_bien_armado():
    conjunto = json.loads((BACKEND / "evaluacion" / "consultas.json").read_text(encoding="utf-8"))
    catalogo = json.loads((BACKEND / "fuentes" / "catalogo.json").read_text(encoding="utf-8"))
    consultas = conjunto["consultas"]
    assert len({c["id"] for c in consultas}) == len(consultas) >= 25
    assert sum(c["tema"] == "Recursividad" and bool(c["relevantes"]) for c in consultas) >= 15
    assert sum(not c["relevantes"] for c in consultas) >= 5  # sin respuesta: deben dar material insuficiente
    for c in consultas:
        assert c["tema"] in TEMAS, c["id"]
        for criterio in c["relevantes"]:
            assert criterio and set(criterio) <= {"fuente", "seccion", "texto"}, c["id"]
            if "fuente" in criterio:  # la fuente tiene que estar asignada a ese tema en el catálogo
                assert criterio["fuente"] in catalogo["temas"][c["tema"]], c["id"]
            if "texto" in criterio:
                re.compile(criterio["texto"])
    for patron in conjunto["ruido"]:
        re.compile(patron)


# ---------------- Relevancia y métricas ----------------

def test_relevante_si_cumple_algun_criterio_completo():
    criterios = [{"fuente": "F2", "seccion": "Infinite recursion"}, {"texto": "RecursionError"}]
    assert evaluar.es_relevante(fragmento("sin caso base", seccion="Cap. 5 · 5.10. Infinite recursion"), criterios, TITULOS)
    assert evaluar.es_relevante(fragmento("RecursionError: maximum", fuente="Problem Solving"), criterios, TITULOS)
    # La sección coincide, pero es de otra fuente: no cumple el primer criterio.
    assert not evaluar.es_relevante(fragmento("x", fuente="Problem Solving", seccion="Infinite recursion"), criterios, TITULOS)
    assert not evaluar.es_relevante(fragmento("leap of faith", seccion="6.7. Leap of faith"), criterios, TITULOS)
    assert evaluar.es_relevante(fragmento("a RECURSIONERROR"), criterios, TITULOS)  # sin distinguir mayúsculas


def test_metricas_de_una_consulta_y_del_resumen():
    con = {"id": "R1", "tema": "Recursividad", "consulta": "?", "relevantes": [{"texto": "caso base"}]}
    sin = {"id": "N1", "tema": "Recursividad", "consulta": "?", "relevantes": []}
    devueltos = [fragmento("la pila", fuente="A", similitud=0.9), fragmento("el caso base", fuente="A", similitud=0.7),
                 fragmento("otro caso base ﬁn", fuente="B", similitud=0.6)]
    ruido = re.compile("ﬁ")
    m1 = evaluar.medir(con, devueltos, True, devueltos, TITULOS, ruido)
    assert (m1["posicion"], m1["relevantes_devueltos"], m1["concentracion"], m1["con_ruido"]) == (2, 2, 0.667, 1)
    assert m1["similitud_primer_relevante"] == 0.7 and m1["suficiencia_correcta"]
    # Con el umbral no se devolvió nada, pero sin umbral el relevante aparece tercero.
    m2 = evaluar.medir(con, [], False, devueltos[:1] * 2 + devueltos[1:2], TITULOS, ruido)
    assert (m2["posicion"], m2["posicion_sin_umbral"], m2["suficiencia_correcta"]) == (None, 3, False)
    m3 = evaluar.medir(sin, devueltos[:2], True, devueltos, TITULOS, ruido)
    assert not m3["suficiencia_correcta"] and m3["similitud_maxima"] == 0.9
    r = evaluar.resumir([m1, m2, m3], aciertos_en=[1, 3])
    assert (r["con_respuesta"], r["sin_respuesta"]) == (2, 1)
    assert (r["acierto@1"], r["acierto@3"], r["mrr"]) == (0, 0.5, 0.25)
    assert r["precision"] == 0.667  # m2 no devolvió nada: no entra en el promedio
    assert (r["suficiente_con_respuesta"], r["insuficiente_sin_respuesta"]) == (0.5, 0)
    assert r["posicion_sin_umbral_mediana"] == 2.5 and r["fragmentos_con_ruido"] == 1


def test_evaluar_corre_la_busqueda_real_del_rag():
    tema = 1
    for i, texto in enumerate(["El caso base detiene la recursión y evita llamadas infinitas.",
                               "La pila de llamadas guarda cada invocación pendiente."]):
        rag.indexar([rag.Seccion(texto, f"sec {i}")], id_origen=i, id_tema=tema, fuente=rag.ACADEMICA,
                    nombre_archivo="Think Python", prefijo=f"f{i}")
    conjunto = {"ruido": [], "consultas": [
        {"id": "R1", "tema": "Recursividad", "consulta": "qué es el caso base de la recursión",
         "relevantes": [{"fuente": "F2", "seccion": "sec 0"}]},
        {"id": "N1", "tema": "Recursividad", "consulta": "tablas hash y colisiones", "relevantes": []}]}
    medidas, resumen = evaluar.evaluar(conjunto, {"Recursividad": tema}, TITULOS)
    assert medidas[0]["posicion"] == 1 and medidas[0]["posicion_sin_umbral"] == 1
    assert medidas[1]["devueltos"] == 0 and medidas[1]["similitud_maxima"] is not None  # sin umbral sí hay candidatos
    assert resumen["acierto@1"] == 1 and resumen["insuficiente_sin_respuesta"] == 1
