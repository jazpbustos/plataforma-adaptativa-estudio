"""Servicio del modelo de lenguaje e intervenciones redactadas por Claude, con un modelo falso (sin gastar tokens)."""
import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from sqlmodel import Session, SQLModel, select

from app.banco import banco
from app.config import P, settings
from app.db import engine
from app.main import app
from app.models import DificultadDetectada, Intento, SesionEstudio
from app.services import llm, pistas, rag

L = P["llm"]
ESPEC = {"funcion": "factorial", "parametros": [{"nombre": "n", "tipo": "int"}], "retorno": "int",
         "casos": [{"entrada": [0], "salida": 1}, {"entrada": [5], "salida": 120}]}
CODIGO = "def factorial(n):\n    return n * factorial(n - 1)"


class Falso:
    """Registra cada pedido y devuelve la respuesta indicada (o lanza la excepción indicada)."""
    def __init__(self, respuesta="Revisá qué pasa cuando n llega a 0."):
        self.respuesta, self.pedidos = respuesta, []

    def __call__(self, modelo, max_tokens, espera=None):
        self.pedidos.append({"modelo": modelo, "max_tokens": max_tokens})
        return self

    def invoke(self, mensajes):
        self.pedidos[-1].update(sistema=mensajes[0].content, usuario=mensajes[1].content)
        if isinstance(self.respuesta, Exception):
            raise self.respuesta
        return AIMessage(self.respuesta)


@pytest.fixture()
def modelo(monkeypatch):
    falso = Falso()
    monkeypatch.setattr(settings, "anthropic_api_key", "clave-de-prueba")
    monkeypatch.setattr(llm, "crear", falso)
    return falso


def test_sin_clave_no_hay_modelo_y_se_usa_el_respaldo(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    with pytest.raises(llm.ModeloNoDisponible):
        llm.generar(llm.PISTAS, "s", "u", 10)
    r = pistas.intervencion(1, ESPEC, "ejecución: RecursionError", titulo="Factorial", enunciado="...",
                            lenguaje="python", codigo=CODIGO)
    assert r.origen == pistas.RESPALDO and r.texto == pistas.PISTAS["recursion"]


def test_cada_tarea_usa_el_modelo_asignado(modelo):
    llm.generar(llm.PISTAS, "s", "u", 10)
    llm.generar(llm.CONTENIDO, "s", "u", 10)
    assert [p["modelo"] for p in modelo.pedidos] == [L["modelo_pistas"], L["modelo_contenido"]]


def test_si_el_modelo_falla_se_usa_el_respaldo(modelo):
    modelo.respuesta = TimeoutError("sin respuesta")
    r = pistas.intervencion(2, ESPEC, "ejecución: RecursionError", titulo="Factorial", enunciado="...",
                            lenguaje="python", codigo=CODIGO)
    assert r.origen == pistas.RESPALDO and r.texto == pistas.EXPLICACIONES["recursion"]


def test_pista_minima_con_haiku_y_el_codigo_como_dato(modelo):
    r = pistas.intervencion(1, ESPEC, "lógico: caso 1", titulo="Factorial", enunciado="Devolvé n!.",
                            lenguaje="python", codigo=CODIGO, mensaje="Caso 1: con 0 se esperaba 1 y se obtuvo 0.")
    assert r == pistas.Intervencion("Revisá qué pasa cuando n llega a 0.", pistas.MODELO)
    p = modelo.pedidos[0]
    assert p["modelo"] == L["modelo_pistas"] and p["max_tokens"] == L["max_tokens_pista"]
    assert "PISTA MÍNIMA" in p["sistema"] and "No escribas código" in p["sistema"]
    # El código va entre etiquetas y con número de línea; el caso que falla, con su entrada y su salida esperada.
    assert '<codigo lenguaje="python">\n  1 | def factorial(n):\n  2 |     return n * factorial(n - 1)\n</codigo>' in p["usuario"]
    assert "Caso que falla: con 0 se esperaba 1" in p["usuario"] and "<material>" not in p["usuario"]


def test_explicacion_elaborada_con_sonnet_y_el_material(modelo):
    frag = [{"contexto": "Toda función recursiva necesita un caso base."}] * 5
    pistas.intervencion(2, ESPEC, "ejecución: RecursionError", titulo="Factorial", enunciado="...",
                        lenguaje="python", codigo=CODIGO, fragmentos=frag)
    p = modelo.pedidos[0]
    assert p["modelo"] == L["modelo_contenido"] and "EXPLICACIÓN ELABORADA" in p["sistema"]
    assert p["usuario"].count("Toda función recursiva") == L["fragmentos_explicacion"]


@pytest.mark.parametrize("respuesta", [
    "Probá así:\n```python\ndef factorial(n):\n    if n == 0: return 1\n```",
    "Agregá esto al principio:\n    return 1",
    "Cambiá la línea por:\nif (n == 0) return 1;",
    "x" * (L["largo_maximo_pista"] + 1),
])
def test_una_respuesta_con_codigo_o_demasiado_larga_se_descarta(modelo, respuesta):
    modelo.respuesta = respuesta
    r = pistas.intervencion(1, ESPEC, "ejecución: RecursionError", titulo="Factorial", enunciado="...",
                            lenguaje="python", codigo=CODIGO)
    assert r.origen == pistas.RESPALDO


def test_mencionar_la_funcion_en_el_texto_esta_permitido():
    assert pistas.aceptable("Fijate qué devuelve factorial(0): ¿llega a cortar la recursión?", 1)


def test_consulta_al_material_segun_el_error():
    assert pistas.consulta_material(ESPEC, "ejecución: RecursionError", "Factorial", "...") == \
        f"Factorial: {pistas.CONCEPTOS['recursion']}"
    assert pistas.consulta_material(ESPEC, "lógico: caso 2", "Factorial", "Devolvé n!.") == "Factorial. Devolvé n!."


def test_flujo_de_practicar_con_el_modelo(modelo, monkeypatch):
    monkeypatch.setattr(settings, "ejecucion_local", True)
    consultas = []
    monkeypatch.setattr(rag, "precargar", lambda: None)  # sin cargar los modelos reales al arrancar
    monkeypatch.setattr(rag, "listo", lambda: True)
    monkeypatch.setattr(rag, "recuperar", lambda tema, consulta, propios: consultas.append(consulta) or
                        {"fragmentos": [{"contexto": "El caso base corta la recursión."}], "suficiente": True})
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:
        c.post("/api/auth/dev")
        plan = c.post("/api/plans", json=dict(topic="Recursividad", days=10, level="intermedio", target_grade=8,
                                              language="python")).json()["id"]
        with Session(engine) as db:
            db.add(SesionEstudio(id_objetivo=plan, modulo="aprender", modo="evaluación", resultado_evaluacion=80))
            db.commit()
        ej = c.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]
        enviar = lambda v: c.post(f"/api/plans/{plan}/practicar/intentos", json={
            "id_ejercicio": ej["id"], "lenguaje": "python", "codigo": ej["plantillas"]["python"].replace("    pass", f"    return {v}"),
            "tiempo_activo": 0}).json()
        enviar(-1), enviar(-2)
        assert modelo.pedidos == []  # sin señal de bloqueo no se llama al modelo
        r = enviar(-3)
        assert r["intervencion"] == {"nivel": 1, "texto": "Revisá qué pasa cuando n llega a 0.",
                                     "motivo": "Mismo error en los últimos 3 intentos, con 1 línea modificada entre ellos.",
                                     "etiqueta": "Posible bloqueo · intentos repetidos"}
        assert modelo.pedidos[0]["modelo"] == L["modelo_pistas"] and "return -3" in modelo.pedidos[0]["usuario"]
        modelo.respuesta = "La recursión necesita un caso base que devuelva un valor sin volver a llamarse."
        r = enviar(-4)
        assert r["intervencion"]["nivel"] == 2 and r["intervencion"]["texto"].startswith("La recursión necesita")
        assert modelo.pedidos[1]["modelo"] == L["modelo_contenido"]
        assert "El caso base corta la recursión." in modelo.pedidos[1]["usuario"]
        assert len(consultas) == 1 and consultas[0].startswith(ej["titulo"])  # solo la explicación consulta el material
        with Session(engine) as db:
            assert len(db.exec(select(Intento)).all()) == 4
            assert [d.intervencion_generada[:12] for d in db.exec(select(DificultadDetectada)).all()] == \
                ["Revisá qué p", "La recursión"]


def test_si_los_modelos_del_rag_no_estan_cargados_la_explicacion_no_espera(monkeypatch):
    from app.routers.practicar import _fragmentos
    monkeypatch.setattr(rag, "listo", lambda: False)
    monkeypatch.setattr(rag, "recuperar", lambda *a: pytest.fail("no debería consultar el material"))
    assert _fragmentos(None, None, "consulta") == []
