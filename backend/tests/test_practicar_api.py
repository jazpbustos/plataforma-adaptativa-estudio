"""Módulo Practicar de punta a punta, con el ejecutor local (sin Judge0)."""
import json

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

from app.banco import banco
from app.config import settings
from app.db import engine
from app.main import app
from app.models import DificultadDetectada, Intento, ObjetivoEstudio, SesionEstudio

SOLUCIONES = {e.titulo: e for ejs in banco().values() for e in ejs}


@pytest.fixture()
def client(monkeypatch):
    from app.db import init_db
    monkeypatch.setattr(settings, "ejecucion_local", True)
    init_db()
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:
        c.post("/api/auth/dev")
        yield c


def crear_plan(c, nivel="intermedio", lenguaje="python"):
    return c.post("/api/plans", json=dict(topic="Recursividad", days=10, level=nivel, target_grade=8,
                                          language=lenguaje)).json()["id"]


def aprobar_aprender(plan, porcentaje=80.0):
    with Session(engine) as db:
        db.add(SesionEstudio(id_objetivo=plan, modulo="aprender", modo="evaluación", resultado_evaluacion=porcentaje))
        db.commit()


def enviar(c, plan, ej, codigo, lenguaje="python", tiempo=0):
    return c.post(f"/api/plans/{plan}/practicar/intentos",
                  json={"id_ejercicio": ej["id"], "lenguaje": lenguaje, "codigo": codigo, "tiempo_activo": tiempo})


def incorrecto(ej, valor):  # devuelve un valor fijo: falla el mismo caso cambiando una sola línea
    return ej["plantillas"]["python"].replace("    pass", f"    return {valor}")


def test_practicar_bloqueado_hasta_aprobar_aprender(client):
    plan = crear_plan(client)
    r = client.get(f"/api/plans/{plan}/practicar").json()
    assert r["ejercicio"] is None and r["modulo"]["estado"] == "bloqueado" and "60 %" in r["modulo"]["falta"]
    assert client.post(f"/api/plans/{plan}/practicar/intentos",
                       json={"id_ejercicio": 1, "lenguaje": "python", "codigo": "x"}).status_code == 403


def test_flujo_completo_de_un_ejercicio(client):
    plan = crear_plan(client, nivel="intermedio")
    aprobar_aprender(plan, 80)
    r = client.get(f"/api/plans/{plan}/practicar").json()
    ej = r["ejercicio"]
    assert r["modulo"]["estado"] == "habilitado" and ej["dificultad"] == "básico" and ej["posicion"] == 1
    assert ej["lenguaje_fijo"] is None and ej["puntos_posibles"] == 10 and ej["plantillas"]["python"].startswith("def ")
    assert client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]["id"] == ej["id"]  # recargar no lo cambia

    # Tres intentos con el mismo error lógico y una línea distinta: pista mínima en el tercero (HU-006, HU-007).
    for n, valor in enumerate([-999, -998]):
        r = enviar(client, plan, ej, incorrecto(ej, valor)).json()
        assert r["resultado"] == "error lógico" and r["tipo_error"] == "lógico: caso 1" and r["intervencion"] is None
    r = enviar(client, plan, ej, incorrecto(ej, -997)).json()
    assert r["intervencion"]["nivel"] == 1 and r["intervencion"]["etiqueta"] == "Posible bloqueo · intentos repetidos"
    assert r["intervencion"]["motivo"] == "Mismo error en los últimos 3 intentos, con 1 línea modificada entre ellos."
    assert client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]["puntos_posibles"] == 7

    # Persiste después de la pista: explicación elaborada.
    r = enviar(client, plan, ej, incorrecto(ej, -996)).json()
    assert r["intervencion"]["nivel"] == 2 and r["intervencion"]["etiqueta"].startswith("Bloqueo persistente")

    # Resuelve: 4 puntos (con explicación), dominio = 0,3 × 80 + 0,4 × (4 / 50 × 100).
    r = enviar(client, plan, ej, SOLUCIONES[ej["titulo"]].python).json()
    assert r["resultado"] == "correcto" and r["puntos_obtenidos"] == 4 and r["resueltos"] == 1
    assert r["dominio"] == round(0.3 * 80 + 0.4 * 8, 1)
    # Resolverlo de nuevo no suma (HU-011, CA1).
    assert enviar(client, plan, ej, SOLUCIONES[ej["titulo"]].python).json()["puntos_obtenidos"] is None

    with Session(engine) as db:
        difs = db.exec(select(DificultadDetectada)).all()
        assert [d.hubo_avance_posterior for d in difs] == [False, True]  # la explicación sí destrabó
        plan_json = json.loads(db.get(ObjetivoEstudio, plan).plan_estudio)
        hechas = [a for d in plan_json[-1]["dias"] for a in d["actividades"] if a["estado"] == "completada"]
        assert hechas == [{"modulo": "practicar", "tipo": "ejercicio", "estado": "completada"}]

    siguiente = client.get(f"/api/plans/{plan}/practicar").json()
    assert siguiente["ejercicio"]["id"] != ej["id"] and siguiente["ejercicio"]["posicion"] == 2
    assert siguiente["resueltos"] == 1 and siguiente["puntos"] == 4


def test_cinco_resueltos_aprueban_y_habilitan_consolidar(client):
    plan = crear_plan(client, nivel="principiante")
    aprobar_aprender(plan)
    dificultades = []
    for _ in range(5):
        ej = client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]
        dificultades.append(ej["dificultad"])
        r = enviar(client, plan, ej, SOLUCIONES[ej["titulo"]].python).json()
        assert r["puntos_obtenidos"] == 10
    assert dificultades == ["básico", "básico", "intermedio", "intermedio", "avanzado"]
    assert r["aprobado"] is True and r["consolidar"]["estado"] == "habilitado"
    extra = client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]
    assert extra["posicion"] is None and not extra["es_repaso"]  # práctica adicional con ejercicios nuevos


def test_el_lenguaje_no_cambia_durante_un_ejercicio(client):
    plan = crear_plan(client)
    aprobar_aprender(plan)
    ej = client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]
    enviar(client, plan, ej, incorrecto(ej, -1))
    assert client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]["lenguaje_fijo"] == "python"
    r = enviar(client, plan, ej, ej["plantillas"]["java"], lenguaje="java")
    assert r.status_code == 409 and "próximo ejercicio" in r.json()["detail"]


def test_aviso_de_tiempo_detecta_sin_nuevo_intento(client):
    plan = crear_plan(client)
    aprobar_aprender(plan)
    ej = client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]
    tiempo = lambda s: client.post(f"/api/plans/{plan}/practicar/tiempo",
                                   json={"id_ejercicio": ej["id"], "tiempo_activo": s}).json()["intervencion"]
    limite = 2.5 * ej["tiempo_esperado"] * 60
    assert tiempo(limite + 60) is None  # sin intentos fallidos, una pausa no es bloqueo (CA4)
    enviar(client, plan, ej, incorrecto(ej, -1))
    assert tiempo(limite - 1) is None
    i = tiempo(limite + 1)
    assert i["nivel"] == 1 and "tiempo" in i["motivo"] and i["etiqueta"] == "Posible bloqueo · tiempo excedido"
    assert tiempo(limite + 30) is None  # no se repite


def test_si_judge0_no_responde_no_se_registra_el_intento(client, monkeypatch):
    from app.routers import practicar
    from app.services.ejecucion import EjecucionNoDisponible

    class Caido:
        def ejecutar(self, *a):
            raise EjecucionNoDisponible("sin respuesta")
    monkeypatch.setattr(practicar, "ejecutor", lambda: Caido())
    plan = crear_plan(client)
    aprobar_aprender(plan)
    ej = client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]
    assert enviar(client, plan, ej, "def x(): pass").status_code == 503
    with Session(engine) as db:
        assert db.exec(select(Intento)).all() == []


def test_un_ejercicio_de_otro_tema_no_se_acepta(client):
    plan = crear_plan(client)
    aprobar_aprender(plan)
    from app.models import Ejercicio, Tema
    with Session(engine) as db:
        otro = db.exec(select(Ejercicio).join(Tema).where(Tema.nombre == "Búsqueda y ordenamiento")).first()
    assert enviar(client, plan, {"id": otro.id_ejercicio}, "x").status_code == 404


def test_reiniciar_un_ejercicio_solo_en_modo_prueba(client, monkeypatch):
    plan = crear_plan(client)
    aprobar_aprender(plan)
    ej = client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]
    for v in (-1, -2, -3):
        enviar(client, plan, ej, incorrecto(ej, v))
    enviar(client, plan, ej, SOLUCIONES[ej["titulo"]].python)
    monkeypatch.setattr(settings, "dev_login", False)
    assert client.delete(f"/api/plans/{plan}/practicar/ejercicios/{ej['id']}").status_code == 404
    monkeypatch.setattr(settings, "dev_login", True)
    assert client.delete(f"/api/plans/{plan}/practicar/ejercicios/{ej['id']}").status_code == 204
    with Session(engine) as db:
        assert db.exec(select(Intento)).all() == [] and db.exec(select(DificultadDetectada)).all() == []
    r = client.get(f"/api/plans/{plan}/practicar").json()
    assert r["resueltos"] == 0 and r["puntos"] == 0
