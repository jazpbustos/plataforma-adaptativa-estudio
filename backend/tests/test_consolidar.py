"""Módulo Consolidar (HU-008) con un modelo falso: sin gastar tokens."""
import json

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

from app.config import settings
from app.db import engine
from app.main import app
from app.models import DificultadDetectada, Ejercicio, Explicacion, Punto, SesionEstudio
from app.services import consolidar as gen
from app.services import llm, rag

CONCEPTOS = ["caso base", "caso recursivo que se acerca al caso base", "pila de llamadas"]
TEXTO = ("Una función recursiva se llama a sí misma. Necesita un caso base que corta las llamadas, y en cada "
         "llamada el problema se achica hasta llegar a ese caso. Cada llamada queda guardada en la pila.")
EVALUAR, PREGUNTAR = "Evaluás la explicación", "Formulá una sola"


def evaluacion(*estados, citas=None):
    citas = citas or ["Necesita un caso base que corta las llamadas", "el problema se achica hasta llegar a ese caso",
                      "Cada llamada queda guardada en la pila"]
    return {"conceptos": [{"concepto": c, "estado": e, "cita": None if e == "ausente" else citas[i], "motivo": "."}
                          for i, (c, e) in enumerate(zip(CONCEPTOS, estados))]}


class Modelo:
    """Responde según la tarea que aparece en el pedido y registra cada pedido."""
    def __init__(self):
        self.pedidos, self.usuarios, self.respuestas = [], [], {}

    def __call__(self, modelo, max_tokens, espera=None):
        return self

    def invoke(self, mensajes):
        from langchain_core.messages import AIMessage
        sistema = mensajes[0].content
        self.pedidos.append(sistema)
        self.usuarios.append(mensajes[-1].content)
        for clave, r in self.respuestas.items():
            if clave in sistema:
                r = r.pop(0) if isinstance(r, list) else r
                return AIMessage(json.dumps(r, ensure_ascii=False))
        raise AssertionError(f"pedido inesperado: {sistema[:80]}")


@pytest.fixture()
def modelo(monkeypatch):
    m = Modelo()
    monkeypatch.setattr(settings, "anthropic_api_key", "clave-de-prueba")
    monkeypatch.setattr(llm, "crear", m)
    monkeypatch.setattr(rag, "precargar", lambda: None)
    return m


# ---------------- Evaluación (servicio) ----------------

def test_cita_que_no_esta_en_el_texto_cuenta_como_ausente(modelo):
    """CA4: un error del modelo no da por correcta una explicación."""
    modelo.respuestas[EVALUAR] = evaluacion("presente", "presente", "presente",
                                            citas=["Necesita un caso base que corta las llamadas",
                                                   "el problema se achica hasta llegar a ese caso",
                                                   "la pila de llamadas guarda el estado de cada llamada"])  # inventada
    d = gen.evaluar_una("Recursividad", CONCEPTOS, TEXTO)
    assert [x["estado"] for x in d] == ["presente", "presente", "ausente"] and d[2]["cita"] is None
    assert gen.clasificar(d) == gen.INCOMPLETA


def test_clasificacion_segun_el_ejemplo_de_la_historia():
    """CA3 y CA8: los tres conceptos, correcta; falta uno, incompleta; uno erróneo, incorrecta."""
    d = lambda *e: [{"estado": x} for x in e]  # noqa: E731
    assert gen.clasificar(d("presente", "presente", "presente")) == gen.CORRECTA
    assert gen.clasificar(d("ausente", "presente", "presente")) == gen.INCOMPLETA
    assert gen.clasificar(d("erróneo", "presente", "ausente")) == gen.INCORRECTA


def test_dos_evaluaciones_distintas_dan_no_concluyente(modelo):
    """CA5: se informa el concepto en discrepancia."""
    modelo.respuestas[EVALUAR] = [evaluacion("presente", "presente", "presente"),
                                  evaluacion("presente", "presente", "ausente")]
    r = gen.evaluar("Recursividad", CONCEPTOS, TEXTO)
    assert r["resultado"] == gen.NO_CONCLUYENTE and r["discrepancia"] == "pila de llamadas"
    assert sum(EVALUAR in p for p in modelo.pedidos) == 2  # dos evaluaciones independientes


def test_la_pregunta_de_seguimiento_no_nombra_el_concepto(modelo):
    """CA6: si el modelo nombra el concepto que falta, se pide otra; si insiste, se usa una de respaldo."""
    objetivo = {"concepto": "pila de llamadas", "estado": "ausente"}
    modelo.respuestas[PREGUNTAR] = [{"pregunta": "¿Qué pasa con la pila de llamadas?"},
                                    {"pregunta": "¿Dónde queda cada llamada mientras espera el resultado de la siguiente?"}]
    p = gen.pregunta_seguimiento("Recursividad", objetivo, gen.INCOMPLETA, TEXTO, 1)
    assert p == "¿Dónde queda cada llamada mientras espera el resultado de la siguiente?"
    modelo.respuestas[PREGUNTAR] = [{"pregunta": "Revisá la pila de llamadas."}, {"pregunta": "Contame de las llamadas y la pila."}]
    assert gen.pregunta_seguimiento("Recursividad", objetivo, gen.INCOMPLETA, TEXTO, 2) == gen._RESPALDO[2]
    assert "Nivel 2" in modelo.pedidos[-1]


# ---------------- API ----------------

@pytest.fixture()
def client(modelo):
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:
        c.post("/api/auth/dev")
        c.plan = c.post("/api/plans", json=dict(topic="Recursividad", days=10, level="intermedio", target_grade=8,
                                                language="python")).json()["id"]
        yield c


def aprobar_aprender_y_practicar(plan_id):
    """Evaluación de Aprender aprobada y cinco ejercicios resueltos sin ayuda (HU-011, CA2)."""
    with Session(engine) as db:
        db.add(SesionEstudio(id_objetivo=plan_id, modulo="aprender", modo="evaluación", resultado_evaluacion=80))
        s = SesionEstudio(id_objetivo=plan_id, modulo="practicar")
        db.add(s); db.flush()
        for ej in db.exec(select(Ejercicio)).all()[:5]:
            db.add(Punto(id_sesion=s.id_sesion, id_ejercicio=ej.id_ejercicio, cantidad=10, motivo="resuelto sin ayuda"))
        db.commit()


DISPARAR, CHARLAR = "pregunta disparadora", "Estás charlando"


def disparadores(*preguntas):
    return {"preguntas": [{"concepto": c, "pregunta": p} for c, p in zip(CONCEPTOS, preguntas)]}


def charla(estado, cita=None, devolucion="¡Bien!"):
    return {"estado": estado, "cita": cita, "devolucion": devolucion}


def test_disparador_que_nombra_el_concepto_se_reemplaza(modelo):
    """CA1: la pregunta disparadora plantea una situación sin nombrar el concepto."""
    modelo.respuestas[DISPARAR] = disparadores("¿Qué hace que una función que se llama a sí misma deje de hacerlo?",
                                               "¿Qué es el caso recursivo?",  # lo nombra
                                               "Sin signo de pregunta.")
    p = gen.disparadores("Recursividad", CONCEPTOS, "python", "intermedio")
    assert p[0].startswith("¿Qué hace que") and p[1] == gen.disparador_respaldo(CONCEPTOS[1])
    assert p[2] == gen.disparador_respaldo(CONCEPTOS[2])


def test_seguimiento_de_la_charla_no_nombra_el_concepto(modelo):
    """CA6 en la charla: si la devolución nombra el concepto, se usa una pregunta de respaldo."""
    modelo.respuestas[CHARLAR] = [charla("ausente", devolucion="¿Y el caso base?"),
                                  charla("ausente", devolucion="¿Qué hace que deje de llamarse?")]
    r = gen.responder_charla("Recursividad", "caso base", "¿Cuándo para?", ["No sé"], 2, "python")
    assert r["devolucion"] == "¿Qué hace que deje de llamarse?"  # se pidió otra
    modelo.respuestas[CHARLAR] = [charla("ausente", devolucion="¿Y el caso base?")] * 2
    r = gen.responder_charla("Recursividad", "caso base", "¿Cuándo para?", ["No sé"], 2, "python")
    assert r["estado"] == "ausente" and r["devolucion"] == gen._RESPALDO_CHARLA[2]
    # si el estudiante ya usó la palabra, la repregunta también puede usarla
    modelo.respuestas[CHARLAR] = charla("ausente", devolucion="Además de los aritméticos, ¿qué otros operadores usarías?")
    r = gen.responder_charla("Sintaxis", "operadores y expresiones (aritméticos, de comparación y lógicos)", "¿?",
                             ["con operadores aritmeticos"], 1, "python")
    assert r["devolucion"].startswith("Además de los aritméticos")


def test_consolidar_bloqueado_informa_que_falta(client):
    r = client.get(f"/api/plans/{client.plan}/consolidar").json()
    assert r["modulo"]["estado"] == "bloqueado" and "Aprender" in r["modulo"]["falta"]
    e = client.post(f"/api/plans/{client.plan}/consolidar/charla")
    assert e.status_code == 403 and "Aprender" in e.json()["detail"]


def test_charla_guiada_y_explicacion_final(client, modelo):
    aprobar_aprender_y_practicar(client.plan)
    base = f"/api/plans/{client.plan}/consolidar"
    assert client.get(base).json()["charla"] is None
    assert client.post(f"{base}/respuesta", json={"texto": "hola"}).status_code == 409  # sin charla

    modelo.respuestas[DISPARAR] = disparadores("¿Qué hace que deje de llamarse?", "¿Cómo se achica el problema?",
                                               "¿Dónde espera cada llamada?")
    c = client.post(f"{base}/charla").json()
    assert c["fase"] == "charla" and c["mensajes"][-1]["texto"] == "¿Qué hace que deje de llamarse?"
    assert "conceptos" not in c  # no se muestran los conceptos esperados

    # 1.er concepto: respuesta sin el concepto → pregunta de seguimiento, que queda como dificultad (HU-009, CA2)
    modelo.respuestas[CHARLAR] = [charla("ausente", devolucion="Vas bien. ¿Y si la función nunca dejara de llamarse?"),
                                  charla("presente", "cuando n llega a 0 corta")]
    r = client.post(f"{base}/respuesta", json={"texto": "no sé"}).json()
    assert r["estado"] == "ausente" and r["charla"]["mensajes"][-1]["tipo"] == "seguimiento"
    r = client.post(f"{base}/respuesta", json={"texto": "cuando n llega a 0 corta"}).json()
    assert r["charla"]["mensajes"][-2]["tipo"] == "bien" and r["charla"]["mensajes"][-1]["texto"] == "¿Cómo se achica el problema?"
    assert r["charla"]["actual"] == 1
    assert "no sé\ncuando n llega a 0 corta" in modelo.usuarios[-1]  # las respuestas de un concepto van juntas

    # 2.º concepto: tras el máximo de seguimientos, pasa al siguiente igual
    modelo.respuestas[CHARLAR] = [charla("ausente", devolucion="¿Qué pasaría con un número más grande?")] * 4
    for _ in range(3):
        assert client.post(f"{base}/respuesta", json={"texto": "no sé"}).json()["charla"]["mensajes"][-1]["tipo"] == "seguimiento"
    r = client.post(f"{base}/respuesta", json={"texto": "no sé"}).json()
    assert r["charla"]["mensajes"][-2]["tipo"] == "pasar" and r["charla"]["actual"] == 2

    # 3.er concepto, y la consigna del párrafo final
    modelo.respuestas[CHARLAR] = charla("presente", "en la pila")
    r = client.post(f"{base}/respuesta", json={"texto": "en la pila"}).json()
    assert r["charla"]["fase"] == "párrafo" and r["charla"]["mensajes"][-1]["tipo"] == "consigna"
    with Session(engine) as db:
        assert len(db.exec(select(DificultadDetectada)).all()) == 4
        assert db.exec(select(Explicacion)).all() == []  # la charla no se califica

    # Explicación final: muy corta, incompleta con seguimiento, y correcta al completarla
    assert client.post(f"{base}/respuesta", json={"texto": "Se llama a sí misma."}).status_code == 422
    modelo.respuestas[EVALUAR] = [evaluacion("presente", "presente", "ausente")] * 2
    modelo.respuestas[PREGUNTAR] = {"pregunta": "¿Dónde queda cada llamada mientras espera la siguiente?"}
    r = client.post(f"{base}/respuesta", json={"texto": TEXTO}).json()
    # Pantalla 4: incompleta con dos de los tres conceptos, sin decir cuál falta, y una pregunta de seguimiento.
    assert r["resultado"] == "incompleta" and (r["presentes"], r["total"]) == (2, 3) and "pila" not in r["pregunta"]
    assert r["aprobado"] is False and r["charla"]["mensajes"][-1]["texto"] == r["pregunta"]

    modelo.respuestas[EVALUAR] = [evaluacion("presente", "presente", "presente")] * 2
    r = client.post(f"{base}/respuesta", json={"texto": "Cada llamada queda guardada en la pila hasta que termina."}).json()
    assert r["resultado"] == "correcta" and r["presentes"] == 3 and r["aprobado"] is True
    assert r["charla"]["fase"] == "terminada"
    with Session(engine) as db:
        ultima = db.exec(select(Explicacion).order_by(Explicacion.id_explicacion.desc())).first()
        assert ultima.texto.startswith(TEXTO) and ultima.texto.endswith("termina.")  # se completa la anterior
    assert r["dominio"] == 94  # 0,3 × 80 + 0,4 × 100 + 0,3 × 100
    assert client.post(f"{base}/respuesta", json={"texto": "algo"}).status_code == 409  # terminada
    assert client.get(base).json()["charla"]["fase"] == "terminada"


def test_no_concluyente_no_se_computa_y_pide_ampliar(client, modelo):
    aprobar_aprender_y_practicar(client.plan)
    base = f"/api/plans/{client.plan}/consolidar"
    modelo.respuestas[DISPARAR] = disparadores("¿A?", "¿B?", "¿C?")
    client.post(f"{base}/charla")
    modelo.respuestas[CHARLAR] = charla("presente", "sí")
    for _ in range(3):
        client.post(f"{base}/respuesta", json={"texto": "sí"})
    modelo.respuestas[EVALUAR] = [evaluacion("presente", "presente", "presente"),
                                  evaluacion("presente", "ausente", "presente")]
    r = client.post(f"{base}/respuesta", json={"texto": TEXTO}).json()
    assert r["resultado"] == "no concluyente" and r["presentes"] is None
    assert "caso recursivo que se acerca al caso base" in r["charla"]["mensajes"][-1]["texto"]
    assert r["dominio"] == 64  # 0,3 × 80 + 0,4 × 100: la explicación no concluyente no suma
