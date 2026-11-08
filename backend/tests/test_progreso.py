"""Progreso de un tema (Pantalla 5): dominio frente al requerido, resultado de cada módulo, estados, puntos e
historial con las dificultades detectadas."""
from datetime import date

from tests.test_practicar_api import SOLUCIONES, aprobar_aprender, client, crear_plan, enviar, incorrecto  # noqa: F401


def test_progreso_reconstruye_el_dominio_y_lista_las_dificultades(client):
    plan = crear_plan(client, nivel="intermedio")
    vacio = client.get(f"/api/plans/{plan}/progreso").json()
    assert vacio["dominio"] == 0 and vacio["requerido"] == 80 and vacio["diferencia"] == -80
    assert vacio["modulos"]["practicar"]["estado"] == "bloqueado" and "60 %" in vacio["modulos"]["practicar"]["falta"]
    assert vacio["historial"] == [] and vacio["puntos"]["total"] == 0

    aprobar_aprender(plan, 80)
    ej = client.get(f"/api/plans/{plan}/practicar").json()["ejercicio"]
    for valor in (-999, -998, -997):  # tres iguales: pista mínima
        enviar(client, plan, ej, incorrecto(ej, valor))
    enviar(client, plan, ej, SOLUCIONES[ej["titulo"]].python)  # resuelve con pista: 7 puntos

    r = client.get(f"/api/plans/{plan}/progreso").json()
    comp = r["componentes"]
    assert comp["aprender"]["valor"] == 80 and comp["practicar"]["valor"] == 14 and comp["consolidar"]["valor"] == 0
    assert round(sum(c["aporte"] for c in comp.values()), 1) == r["dominio"] == round(0.3 * 80 + 0.4 * 14, 1)
    assert r["diferencia"] == round(r["dominio"] - 80, 1)
    assert r["modulos"]["aprender"]["estado"] == "aprobado" and r["modulos"]["practicar"]["estado"] == "habilitado"
    assert "Resolvé 5 ejercicios" in r["modulos"]["consolidar"]["falta"]
    assert r["puntos"] == {"total": 7, "ejercicios": [{**r["puntos"]["ejercicios"][0], "ejercicio": ej["titulo"],
                                                      "puntos": 7, "ayuda": "con pista mínima"}]}

    practicar = next(s for s in r["historial"] if s["modulo"] == "practicar")
    assert practicar["resumen"].startswith("4 intentos en 1 ejercicio (1 resuelto)")
    [dif] = practicar["dificultades"]
    assert dif["tipo"] == "intentos fallidos repetidos" and dif["nivel"] == 1 and dif["ejercicio"] == ej["titulo"]
    assert dif["hubo_avance"] is True
    assert any(s["modulo"] == "aprender" and "Evaluación de comprensión · 80 %" in s["resumen"] for s in r["historial"])


def test_el_panel_trae_el_plan_de_hoy(client):
    plan = crear_plan(client)
    p = next(x for x in client.get("/api/dashboard").json()["plans"] if x["id"] == plan)
    assert p["today_session"]["position"] == 1 and p["today_session"]["module"] == "aprender"
    assert p["plan_version"] == 1 and p["plan_readjusted"] is False and p["plan_generated"] == date.today().isoformat()


def test_el_progreso_es_solo_del_dueno(client):
    from sqlmodel import Session

    from app.db import engine
    from app.models import Estudiante
    from app.security import create_token
    plan = crear_plan(client)
    with Session(engine) as db:
        ana = Estudiante(id_google="otra-persona-progreso", nombre="Ana", correo_electronico="ana-progreso@example.com")
        db.add(ana); db.commit(); db.refresh(ana)
    client.cookies.clear()
    client.cookies.set("session", create_token(ana.id_estudiante))
    assert client.get(f"/api/plans/{plan}/progreso").status_code == 404


def test_con_el_dominio_alcanzado_se_sigue_con_el_nivel_siguiente(client, monkeypatch):
    import json

    from sqlmodel import Session

    from app.db import engine
    from app.models import ObjetivoEstudio
    from app.routers import progreso
    plan = crear_plan(client, nivel="principiante")
    assert client.get(f"/api/plans/{plan}/progreso").json()["plan"]["nivel_siguiente"] is None  # sin el dominio
    assert client.post(f"/api/plans/{plan}/plan/avanzar", json={"dias": 3}).status_code == 409

    monkeypatch.setattr(progreso, "nivel_dominio", lambda *a: 95)
    assert client.get(f"/api/plans/{plan}/progreso").json()["plan"]["nivel_siguiente"] == "intermedio"
    assert client.post(f"/api/plans/{plan}/plan/avanzar", json={"dias": 9}).status_code == 422
    r = client.post(f"/api/plans/{plan}/plan/avanzar", json={"dias": 3}).json()
    assert r["nivel"] == "intermedio" and r["version"] == 2
    with Session(engine) as db:
        obj = db.get(ObjetivoEstudio, plan)
        v = json.loads(obj.plan_estudio)[-1]
    assert obj.nivel_inicial == "intermedio" and v["motivo"] == "avance de nivel" and len(v["dias"]) == 3
    actividades = [(a["modulo"], a["tipo"]) for d in v["dias"] for a in d["actividades"]]
    assert actividades[0] == ("aprender", "evaluación") and actividades[-1] == ("consolidar", "evaluación")
    assert actividades.count(("practicar", "ejercicio")) == 3 and v["dias"][0]["fecha"] == date.today().isoformat()
    p = client.get(f"/api/plans/{plan}/progreso").json()
    assert p["nivel"] == "intermedio" and p["plan"]["nivel_siguiente"] == "avanzado"
