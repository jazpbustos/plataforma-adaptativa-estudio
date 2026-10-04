import os
from datetime import date, timedelta

os.environ.update(DATABASE_URL="sqlite:///./test.db", DEV_LOGIN="true", UPLOAD_DIR="./test_uploads")

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.planner import NotEnoughSessions, build_plan, required_mastery, split_counts


@pytest.fixture()
def client():
    from sqlmodel import SQLModel
    from app.db import engine, init_db
    init_db()
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c


def plan_body(**kw):
    start = date(2026, 9, 21)  # lunes
    body = dict(subject="Algoritmos y Estructuras de Datos I", topic="Recursividad", goal="examen",
                start_date=str(start), end_date=str(start + timedelta(days=27)), weekdays=[0, 2, 4],
                level="intermedio", target_grade=8, language="java")
    body.update(kw)
    return body


def test_split_counts_suma_total_y_minimo_uno():
    for total in range(3, 40):
        for w in [(0.5, 0.35, 0.15), (0.22, 0.5, 0.28)]:
            c = split_counts(total, w)
            assert sum(c) == total and min(c) >= 1


def test_plan_respeta_orden_pedagogico():
    s = build_plan(date(2026, 9, 21), date(2026, 10, 18), [0, 2, 4], 45, "principiante")
    orden = [x.module for x in s]
    assert orden == sorted(orden, key=["aprender", "practicar", "consolidar"].index)
    assert all(x.day.weekday() in (0, 2, 4) for x in s)


def test_un_solo_dia_cubre_los_tres_modulos():
    # Examen mañana: la ruta sigue cubriendo los tres módulos, todos el mismo día.
    s = build_plan(date(2026, 9, 21), date(2026, 9, 21), list(range(7)), 45, "principiante")
    assert [x.module for x in s] == ["aprender", "practicar", "consolidar"]
    assert all(x.day == date(2026, 9, 21) for x in s)


def test_pocas_sesiones_falla():
    with pytest.raises(NotEnoughSessions):
        build_plan(date(2026, 9, 21), date(2026, 9, 23), [4], 45, "principiante")


def test_rutas_protegidas_sin_sesion(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/dashboard").status_code == 401


def test_flujo_completo_demo(client):
    assert client.post("/api/auth/dev").status_code == 200
    assert client.get("/api/auth/me").json()["name"] == "Usuario Demo"
    prev = client.post("/api/plans/preview", json=plan_body()).json()
    assert prev["total_sessions"] == 12
    assert prev["required_mastery"] == 80
    r = client.post("/api/plans", json=plan_body())
    assert r.status_code == 201
    pid = r.json()["id"]
    up = client.post(f"/api/plans/{pid}/materials", files={"file": ("apunte.md", b"# Recursividad", "text/markdown")})
    assert up.status_code == 201
    bad = client.post(f"/api/plans/{pid}/materials", files={"file": ("virus.exe", b"x", "application/octet-stream")})
    assert bad.status_code == 415
    mats = client.get("/api/materials").json()
    assert mats[0]["filename"] == "apunte.md" and mats[0]["topic"] == "Recursividad"
    dash = client.get("/api/dashboard").json()
    assert dash["plans"][0]["materials"] == 1
    assert dash["plans"][0]["target_grade"] == 8 and dash["plans"][0]["required_mastery"] == 80
    assert dash["plans"][0]["next_session"]["module"] == "aprender"
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401


def test_validaciones(client):
    client.post("/api/auth/dev")
    assert client.post("/api/plans/preview", json=plan_body(end_date="2026-09-01")).status_code == 422
    assert client.post("/api/plans/preview", json=plan_body(weekdays=[9])).status_code == 422


def test_dominio_requerido_segun_nota():
    # HU-002, CA2: 60 % para 6 o 7, 80 % para 8 o 9 y 90 % para 10.
    assert [required_mastery(n) for n in range(6, 11)] == [60, 60, 80, 80, 90]


def test_nota_mas_alta_suma_practica():
    args = (date(2026, 9, 21), date(2026, 10, 18), [0, 2, 4], 45, "intermedio")
    practica = lambda m: sum(1 for x in build_plan(*args, m) if x.module == "practicar")
    assert practica(90) >= practica(60)


def test_validaciones_objetivo(client):
    client.post("/api/auth/dev")
    assert client.post("/api/plans/preview", json=plan_body(target_grade=5)).status_code == 422
    assert client.post("/api/plans/preview", json=plan_body(target_grade=11)).status_code == 422
    assert client.post("/api/plans/preview", json=plan_body(level=2)).status_code == 422
    sin_lenguaje = plan_body(); sin_lenguaje.pop("language")
    assert client.post("/api/plans/preview", json=sin_lenguaje).status_code == 422
