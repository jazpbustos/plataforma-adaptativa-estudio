"""Módulo Aprender (HU-003 y HU-004) con un modelo y un RAG falsos: sin gastar tokens ni cargar los modelos."""
import json

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

from app.config import settings
from app.db import engine
from app.main import app
from app.models import SesionEstudio
from app.services import aprender as gen
from app.services import llm, rag

ACADEMICO = {"fuente": "académica", "nombre_archivo": "Think Python", "pagina_o_seccion": "5.8 Recursividad",
             "contexto": "Una función recursiva necesita un caso base que no se llama a sí misma."}
PROPIO = {"fuente": "propia", "nombre_archivo": "apunte.pdf", "pagina_o_seccion": "pág. 4",
          "contexto": "El caso base es opcional si la función es corta."}
CONCEPTOS = ["caso base", "caso recursivo que se acerca al caso base", "pila de llamadas"]


def explicacion(contradiccion=None, citas=(1,)):
    return {"explicacion": "El caso base corta la recursión [1]. Sin él no termina [9].", "citas": list(citas) + [9],
            "pregunta": {"enunciado": "¿Qué detiene la recursión?", "opciones": ["El caso base", "El bucle", "Nada"],
                         "correcta": 0, "porque": "Es el caso que no se llama a sí mismo."},
            "contradiccion": contradiccion}


def evaluacion(n_preguntas=5):
    mc = [{"tipo": "opción múltiple", "enunciado": f"Pregunta {i}", "opciones": ["a", "b", "c", "d"], "correcta": 1,
           "porque": "Porque sí."} for i in range(4)]
    breve = {"tipo": "respuesta breve", "enunciado": "¿Para qué sirve el caso base?", "elementos": ["detiene la recursión"]}
    return {"preguntas": (mc + [breve])[:n_preguntas]}


class Modelo:
    """Responde según la tarea que aparece en el pedido y registra cada pedido."""
    def __init__(self):
        self.pedidos, self.respuestas = [], {}

    def __call__(self, modelo, max_tokens, espera=None):
        self.modelo = modelo
        return self

    def invoke(self, mensajes):
        from langchain_core.messages import AIMessage
        sistema, usuario = mensajes[0].content, mensajes[1].content
        self.pedidos.append({"modelo": self.modelo, "sistema": sistema, "usuario": usuario})
        for clave, r in self.respuestas.items():
            if clave in sistema:
                r = r.pop(0) if isinstance(r, list) else r
                return AIMessage(r if isinstance(r, str) else json.dumps(r, ensure_ascii=False))
        raise AssertionError(f"pedido inesperado: {sistema[:80]}")


@pytest.fixture()
def modelo(monkeypatch):
    m = Modelo()
    monkeypatch.setattr(settings, "anthropic_api_key", "clave-de-prueba")
    monkeypatch.setattr(llm, "crear", m)
    monkeypatch.setattr(rag, "precargar", lambda: None)
    return m


@pytest.fixture()
def material(monkeypatch):
    estado = {"fragmentos": [ACADEMICO, PROPIO], "suficiente": True, "consultas": []}
    monkeypatch.setattr(rag, "recuperar", lambda tema, consulta, propios: estado["consultas"].append(consulta) or
                        {"fragmentos": estado["fragmentos"], "suficiente": estado["suficiente"]})
    return estado


@pytest.fixture()
def client(modelo, material):
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:
        c.post("/api/auth/dev")
        c.plan = c.post("/api/plans", json=dict(topic="Recursividad", days=10, level="intermedio", target_grade=8,
                                                language="python")).json()["id"]
        yield c


# ---------------- Servicio: validación de lo que devuelve el modelo ----------------

def test_las_citas_inventadas_se_descartan(modelo):
    modelo.respuestas["Tarea: explicá"] = explicacion()
    r = gen.explicar_concepto("Recursividad", "caso base", "intermedio", "python", [ACADEMICO])
    assert [c["n"] for c in r["citas"]] == [1] and "[9]" not in r["explicacion"] and "[1]" in r["explicacion"]
    assert r["citas"][0]["etiqueta"] == "Think Python · 5.8 Recursividad"


def test_la_contradiccion_tiene_que_enfrentar_material_propio_con_una_fuente_academica(modelo):
    modelo.respuestas["Tarea: explicá"] = [explicacion({"propio": 2, "academico": 1, "detalle": "El apunte dice que es opcional."}),
                                         explicacion({"propio": 1, "academico": 1, "detalle": "inventada"})]
    r = gen.explicar_concepto("Recursividad", "caso base", "intermedio", "python", [ACADEMICO, PROPIO])
    assert r["contradiccion"]["propio"]["etiqueta"] == "apunte.pdf · pág. 4"
    assert r["contradiccion"]["academico"]["etiqueta"] == "Think Python · 5.8 Recursividad"
    r = gen.explicar_concepto("Recursividad", "caso base", "intermedio", "python", [ACADEMICO, PROPIO])
    assert r["contradiccion"] is None  # dos fragmentos académicos no son una contradicción con el material propio


def test_sin_material_la_explicacion_queda_marcada_como_no_respaldada(modelo):
    modelo.respuestas["Tarea: explicá"] = explicacion()
    r = gen.explicar_concepto("Recursividad", "caso base", "intermedio", "python", None)
    assert r["no_respaldada"] and r["citas"] == [] and "conocimiento general" in modelo.pedidos[0]["sistema"]


def test_una_pregunta_con_dos_respuestas_iguales_se_pide_de_nuevo(modelo):
    mala = explicacion()
    mala["pregunta"]["opciones"] = ["El caso base", "El caso base", "Nada"]
    modelo.respuestas["Tarea: explicá"] = [mala, explicacion()]
    gen.explicar_concepto("Recursividad", "caso base", "intermedio", "python", [ACADEMICO])
    assert len(modelo.pedidos) == 2


@pytest.mark.parametrize("nivel,esperado", [
    ("principiante", ["básica", "básica", "intermedia", "intermedia", "básica"]),
    ("intermedio", ["básica", "intermedia", "intermedia", "avanzada", "intermedia"]),
    ("avanzado", ["intermedia", "intermedia", "avanzada", "avanzada", "avanzada"]),
])
def test_composicion_de_la_evaluacion_segun_el_nivel(nivel, esperado):
    c = gen.composicion(nivel)
    assert [s["dificultad"] for s in c] == esperado  # CA6: 3+2, 1+3+1 y 2+3
    assert [s["tipo"] for s in c] == [gen.OPCION_MULTIPLE] * 4 + [gen.BREVE]  # CA5: cuatro y una breve


def test_la_evaluacion_con_otra_cantidad_de_preguntas_no_se_acepta(modelo):
    modelo.respuestas["Tarea: generá la evaluación"] = [evaluacion(4), evaluacion(4)]
    with pytest.raises(gen.ContenidoNoValido):
        gen.generar_evaluacion("Recursividad", CONCEPTOS, "intermedio", "python", {c: [ACADEMICO] for c in CONCEPTOS}, [])


def test_respuesta_breve_con_cita_que_no_esta_en_el_texto_se_considera_ausente(modelo):
    p = {"enunciado": "¿Para qué sirve el caso base?", "elementos": ["detiene la recursión", "no se llama a sí mismo"]}
    modelo.respuestas["Corregís una respuesta breve"] = [
        {"elementos": [{"elemento": "detiene la recursión", "presente": True, "cita": "sirve para frenar las llamadas"},
                       {"elemento": "no se llama a sí mismo", "presente": True, "cita": "no vuelve a llamar a la función"}]},
        {"elementos": [{"elemento": "detiene la recursión", "presente": True, "cita": "sirve para frenar las llamadas"},
                       {"elemento": "no se llama a sí mismo", "presente": False, "cita": None}]},
    ]
    respuesta = "Sirve para frenar las llamadas recursivas."
    r = gen.corregir_breve(p, respuesta, "Recursividad")
    assert r["puntos"] == 0.5 and [e["presente"] for e in r["elementos"]] == [True, False]  # la segunda cita es inventada
    assert gen.corregir_breve(p, respuesta, "Recursividad")["puntos"] == 0.5
    assert gen.corregir_breve(p, "   ", "Recursividad")["puntos"] == 0  # sin responder: cero, sin consultar al modelo


def test_calificacion_y_conceptos_para_repasar(modelo):
    modelo.respuestas["Corregís una respuesta breve"] = {"elementos": [
        {"elemento": "detiene la recursión", "presente": True, "cita": "detiene la recursión"}]}
    preguntas = gen._validar_evaluacion(evaluacion(), [{**s, "concepto": CONCEPTOS[i % 3]} for i, s in enumerate(gen.composicion("intermedio"))])
    r = gen.calificar(preguntas, {"1": 1, "2": 1, "3": 0, "5": "Es lo que detiene la recursión."}, "Recursividad")
    assert r["puntaje"] == 3 and r["porcentaje"] == 60 and r["aprobado"]  # CA9: 3 de 5 aprueba
    assert r["repasar"] == [CONCEPTOS[2], CONCEPTOS[0]]  # preguntas 3 (mal) y 4 (sin responder)


# ---------------- API ----------------

def test_plan_del_tema_y_leccion_guiada(client, modelo, material):
    r = client.get(f"/api/plans/{client.plan}/aprender").json()
    assert [c["nombre"] for c in r["conceptos"]] == CONCEPTOS and not r["todos_recorridos"] and r["practicar"]["estado"] == "bloqueado"
    modelo.respuestas["Tarea: explicá"] = explicacion({"propio": 2, "academico": 1, "detalle": "El apunte dice que es opcional."})
    e = client.post(f"/api/plans/{client.plan}/aprender/leccion", json={"concepto": "caso base"}).json()
    assert e["citas"][0]["etiqueta"] == "Think Python · 5.8 Recursividad" and "correcta" in e["pregunta"]
    # recargar no vuelve a consumir el modelo
    client.post(f"/api/plans/{client.plan}/aprender/leccion", json={"concepto": "caso base"})
    assert len(modelo.pedidos) == 1
    c = client.post(f"/api/plans/{client.plan}/aprender/leccion/comprobacion", json={"concepto": "caso base", "respuesta": 2}).json()
    assert c["correcta"] is False and c["indice_correcto"] == 0  # respondida (bien o mal), la explicación queda completa
    r = client.get(f"/api/plans/{client.plan}/aprender").json()
    assert [c["recorrido"] for c in r["conceptos"]] == [True, False, False]
    assert r["contradicciones"][0]["concepto"] == "caso base"


def test_material_insuficiente_y_explicacion_no_respaldada(client, modelo, material):
    material["suficiente"] = False
    r = client.post(f"/api/plans/{client.plan}/aprender/leccion", json={"concepto": "pila de llamadas"}).json()
    assert r == {"concepto": "pila de llamadas", "insuficiente": True} and modelo.pedidos == []
    modelo.respuestas["Tarea: explicá"] = explicacion()
    r = client.post(f"/api/plans/{client.plan}/aprender/leccion", json={"concepto": "pila de llamadas", "general": True}).json()
    assert r["no_respaldada"] is True and r["citas"] == []


def test_consulta_libre(client, modelo, material):
    modelo.respuestas["Tarea: respondé la consulta"] = {"respuesta": "Porque la pila se llena [1].", "citas": [1]}
    r = client.post(f"/api/plans/{client.plan}/aprender/consulta", json={"consulta": "¿Por qué se desborda la pila?"}).json()
    assert r["respuesta"] == "Porque la pila se llena [1]." and r["citas"][0]["fuente"] == "académica"
    assert "<consulta>\n¿Por qué se desborda la pila?\n</consulta>" in modelo.pedidos[0]["usuario"]


def test_practica_repeticion_y_conceptos_recorridos(client, modelo, material):
    modelo.respuestas["preguntas de práctica"] = {"items": [
        {"concepto": c, "tipo": "verdadero o falso", "enunciado": f"¿{c}?", "correcta": True, "porque": "."} for c in CONCEPTOS]}
    items = client.post(f"/api/plans/{client.plan}/aprender/practica", json={"modo": "cuestionario"}).json()["items"]
    assert len(items) == 3 and items[0]["opciones"] == ["Verdadero", "Falso"] and items[0]["correcta"] == 0
    r = client.post(f"/api/plans/{client.plan}/aprender/practica/resultado", json={
        "modo": "cuestionario", "resultados": [{"item": it, "correcta": i > 0} for i, it in enumerate(items)]}).json()
    assert r["repeticion"] == 1 and r["recorridos"] == sorted(CONCEPTOS)
    pendientes = client.get(f"/api/plans/{client.plan}/aprender/repeticion").json()["items"]
    assert [p["id"] for p in pendientes] == [items[0]["id"]]
    r = client.post(f"/api/plans/{client.plan}/aprender/practica/resultado", json={
        "modo": "repeticion", "resultados": [{"item": pendientes[0], "correcta": True}]}).json()
    assert r["repeticion"] == 0
    # la práctica no aprueba el módulo (CA3)
    assert client.get(f"/api/plans/{client.plan}/aprender").json()["aprobado"] is False


def test_evaluacion_aprobada_habilita_practicar(client, modelo, material):
    modelo.respuestas["Tarea: generá la evaluación"] = evaluacion()
    modelo.respuestas["Corregís una respuesta breve"] = {"elementos": [
        {"elemento": "detiene la recursión", "presente": True, "cita": "detiene la recursión"}]}
    ev = client.post(f"/api/plans/{client.plan}/aprender/evaluacion").json()
    assert len(ev["preguntas"]) == 5 and all("correcta" not in p and "elementos" not in p for p in ev["preguntas"])
    assert [p["dificultad"] for p in ev["preguntas"]] == ["básica", "intermedia", "intermedia", "avanzada", "intermedia"]
    # recargar devuelve la misma evaluación pendiente
    assert client.post(f"/api/plans/{client.plan}/aprender/evaluacion").json()["id"] == ev["id"]
    r = client.post(f"/api/plans/{client.plan}/aprender/evaluacion/{ev['id']}",
                    json={"respuestas": {"1": 1, "2": 1, "3": 0, "4": 0, "5": "El caso base detiene la recursión."}}).json()
    assert r["puntaje"] == 3 and r["aprobado"] and r["practicar"]["estado"] == "habilitado"
    assert r["dominio"] == round(0.3 * 60, 1)
    assert client.post(f"/api/plans/{client.plan}/aprender/evaluacion/{ev['id']}", json={"respuestas": {}}).status_code == 409
    estado = client.get(f"/api/plans/{client.plan}/aprender").json()
    assert estado["aprobado"] and estado["ultima_evaluacion"]["composicion"] == "1 básica, 3 intermedias y 1 avanzada"
    assert client.get(f"/api/plans/{client.plan}/practicar").json()["ejercicio"] is not None


def test_evaluacion_desaprobada_y_nuevo_conjunto_de_preguntas(client, modelo, material):
    modelo.respuestas["Tarea: generá la evaluación"] = [evaluacion(), evaluacion()]
    ev = client.post(f"/api/plans/{client.plan}/aprender/evaluacion").json()
    r = client.post(f"/api/plans/{client.plan}/aprender/evaluacion/{ev['id']}", json={"respuestas": {"1": 1}}).json()
    assert r["puntaje"] == 1 and not r["aprobado"] and r["practicar"]["estado"] == "bloqueado" and len(r["repasar"]) == 3
    nueva = client.post(f"/api/plans/{client.plan}/aprender/evaluacion").json()
    assert nueva["id"] != ev["id"]
    assert "No repitas estas preguntas" in modelo.pedidos[-1]["sistema"]  # CA9 y CA10: un conjunto nuevo


def test_sin_clave_del_modelo_la_generacion_informa_que_no_esta_disponible(client, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    r = client.post(f"/api/plans/{client.plan}/aprender/evaluacion")
    assert r.status_code == 503 and "no está disponible" in r.json()["detail"]
    with Session(engine) as db:
        assert db.exec(select(SesionEstudio).where(SesionEstudio.modo == "evaluación")).all() == []


def test_explicacion_como_texto_con_codigo_y_datos_al_final(modelo):
    texto = ('### La idea\nUna **variable** guarda un valor [1].\n\n### Ejemplo\n```python\nnombre = "Ana"\nprint("hola\\n", nombre)\n```\n'
             f"{gen.SEPARADOR}\n" + json.dumps({"citas": [1], "pregunta": explicacion()["pregunta"], "contradiccion": None}))
    modelo.respuestas["Tarea: explicá"] = texto
    r = gen.explicar_concepto("Sintaxis", "variables y tipos de datos", "principiante", "python", [ACADEMICO])
    assert r["explicacion"].startswith("### La idea") and 'nombre = "Ana"' in r["explicacion"] and r["citas"][0]["n"] == 1


def test_explicacion_cortada_sin_datos_se_pide_de_nuevo(modelo):
    completa = "### La idea\nTexto [1].\n" + gen.SEPARADOR + "\n" + json.dumps({"citas": [1], "pregunta": explicacion()["pregunta"]})
    modelo.respuestas["Tarea: explicá"] = ["### La idea\nTexto que se cortó a la mit", completa]
    r = gen.explicar_concepto("Sintaxis", "variables", "principiante", "python", [ACADEMICO])
    assert len(modelo.pedidos) == 2 and r["explicacion"] == "### La idea\nTexto [1]."


def test_si_repite_la_pregunta_dentro_del_texto_se_recorta(modelo):
    texto = ("### Definiciones\n- **dato**: un valor [1].\nPregunta de comprobación ¿Qué muestra?\n"
             f"{gen.SEPARADOR}\n" + json.dumps({"citas": [1], "pregunta": explicacion()["pregunta"]}))
    modelo.respuestas["Tarea: explicá"] = texto
    r = gen.explicar_concepto("Sintaxis", "variables", "principiante", "python", [ACADEMICO])
    assert r["explicacion"] == "### Definiciones\n- **dato**: un valor [1]."


def test_practica_de_un_solo_concepto_sin_citas(client, modelo, material):
    modelo.respuestas["tarjetas de memoria"] = {"items": [
        {"concepto": "caso base", "frente": f"¿Pregunta {i}? [1]", "dorso": "Respuesta [1][2]."} for i in range(4)]}
    r = client.post(f"/api/plans/{client.plan}/aprender/practica", json={"modo": "tarjetas", "conceptos": ["caso base"]}).json()
    assert len(r["items"]) == 4 and {i["concepto"] for i in r["items"]} == {"caso base"}
    assert r["items"][0]["frente"] == "¿Pregunta 0?" and r["items"][0]["dorso"] == "Respuesta."
    assert "exactamente 4 por concepto" in modelo.pedidos[0]["sistema"] and "pila de llamadas" not in modelo.pedidos[0]["sistema"]
    assert client.post(f"/api/plans/{client.plan}/aprender/practica",
                       json={"modo": "tarjetas", "conceptos": ["otro tema"]}).status_code == 422


def test_citas_con_el_fragmento_y_pasos_de_la_secuencia(client, modelo, material):
    modelo.respuestas["Tarea: explicá"] = explicacion()
    e = client.post(f"/api/plans/{client.plan}/aprender/leccion", json={"concepto": "caso base"}).json()
    assert e["citas"][0]["texto"].startswith("Una función recursiva necesita un caso base")
    client.post(f"/api/plans/{client.plan}/aprender/leccion/comprobacion", json={"concepto": "caso base", "respuesta": 0})
    modelo.respuestas["tarjetas de memoria"] = {"items": [{"concepto": "caso base", "frente": f"¿{i}?", "dorso": "Sí."} for i in range(4)]}
    items = client.post(f"/api/plans/{client.plan}/aprender/practica", json={"modo": "tarjetas", "conceptos": ["caso base"]}).json()["items"]
    client.post(f"/api/plans/{client.plan}/aprender/practica/resultado",
                json={"modo": "tarjetas", "resultados": [{"item": it, "correcta": i > 0} for i, it in enumerate(items)]})
    c = client.get(f"/api/plans/{client.plan}/aprender").json()["conceptos"][0]
    assert c["pasos"] == {"leccion": True, "tarjetas": True, "cuestionario": False} and c["repeticion"] == 1
    assert len(client.get(f"/api/plans/{client.plan}/aprender/repeticion?concepto=caso base").json()["items"]) == 1
    assert client.get(f"/api/plans/{client.plan}/aprender/repeticion?concepto=pila de llamadas").json()["items"] == []
