import json
import os
from datetime import date, timedelta

os.environ.update(DATABASE_URL="sqlite:///./test.db", DEV_LOGIN="true", UPLOAD_DIR="./test_uploads")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.db import TEMAS, engine
from app.main import app
from app.models import (DificultadDetectada, Ejercicio, Estudiante, Explicacion, Intento, NivelDominio,
                        ObjetivoEstudio, Punto, SesionEstudio, Tema)
from app.services.planner import NotEnoughSessions, build_plan, required_mastery, split_counts


@pytest.fixture()
def client():
    from sqlmodel import SQLModel
    from app.db import init_db
    init_db()
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:  # al arrancar, la app vuelve a crear las tablas y carga los temas
        yield c


def plan_body(**kw):
    start = date(2026, 9, 21)  # lunes
    body = dict(topic="Recursividad", start_date=str(start), end_date=str(start + timedelta(days=27)), weekdays=[0, 2, 4],
                level="intermedio", target_grade=8, language="java")
    body.update(kw)
    return body


# ---------------- Planificador ----------------

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
    # Examen mañana: el plan sigue cubriendo los tres módulos, todos el mismo día.
    s = build_plan(date(2026, 9, 21), date(2026, 9, 21), list(range(7)), 45, "principiante")
    assert [x.module for x in s] == ["aprender", "practicar", "consolidar"]
    assert all(x.day == date(2026, 9, 21) for x in s)


def test_pocas_sesiones_falla():
    with pytest.raises(NotEnoughSessions):
        build_plan(date(2026, 9, 21), date(2026, 9, 23), [4], 45, "principiante")


def test_dominio_requerido_segun_nota():
    # HU-002, CA2: 60 % para 6 o 7, 80 % para 8 o 9 y 90 % para 10.
    assert [required_mastery(n) for n in range(6, 11)] == [60, 60, 80, 80, 90]


def test_nota_mas_alta_suma_practica():
    args = (date(2026, 9, 21), date(2026, 10, 18), [0, 2, 4], 45, "intermedio")
    practica = lambda m: sum(1 for x in build_plan(*args, m) if x.module == "practicar")
    assert practica(90) >= practica(60)


# ---------------- API ----------------

def test_rutas_protegidas_sin_sesion(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/dashboard").status_code == 401


def test_flujo_completo_demo(client):
    assert client.post("/api/auth/dev").status_code == 200
    me = client.get("/api/auth/me").json()
    assert me["name"] == "Usuario Demo" and me["has_plan"] is False  # HU-001 CA1: va a la configuración
    prev = client.post("/api/plans/preview", json=plan_body()).json()
    assert prev["total_sessions"] == 12
    assert prev["required_mastery"] == 80
    r = client.post("/api/plans", json=plan_body())
    assert r.status_code == 201
    pid = r.json()["id"]
    assert client.get("/api/auth/me").json()["has_plan"] is True  # HU-001 CA2: va al panel
    up = client.post(f"/api/plans/{pid}/materials", files={"file": ("apunte.md", b"# Recursividad", "text/markdown")})
    assert up.status_code == 201
    bad = client.post(f"/api/plans/{pid}/materials", files={"file": ("virus.exe", b"x", "application/octet-stream")})
    assert bad.status_code == 415
    mats = client.get("/api/materials").json()
    assert mats[0]["filename"] == "apunte.md" and mats[0]["topic"] == "Recursividad"
    plan = client.get("/api/dashboard").json()["plans"][0]
    assert plan["materials"] == 1
    assert plan["next_session"]["module"] == "aprender"
    assert plan["target_grade"] == 8 and plan["required_mastery"] == 80
    assert plan["mastery"] == 0 and plan["points"] == 0
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401


def test_validaciones(client):
    client.post("/api/auth/dev")
    assert client.post("/api/plans/preview", json=plan_body(end_date="2026-09-01")).status_code == 422
    assert client.post("/api/plans/preview", json=plan_body(weekdays=[9])).status_code == 422
    assert client.post("/api/plans/preview", json=plan_body(target_grade=5)).status_code == 422
    assert client.post("/api/plans/preview", json=plan_body(target_grade=11)).status_code == 422
    assert client.post("/api/plans/preview", json=plan_body(level=2)).status_code == 422
    assert client.post("/api/plans/preview", json=plan_body(topic="Árboles binarios")).status_code == 422  # fuera del alcance
    sin_lenguaje = plan_body(); sin_lenguaje.pop("language")
    assert client.post("/api/plans/preview", json=sin_lenguaje).status_code == 422


def test_varios_temas_sin_repetir(client):
    client.post("/api/auth/dev")
    assert client.post("/api/plans", json=plan_body()).status_code == 201
    assert client.post("/api/plans", json=plan_body(topic="Arreglos, pilas y colas")).status_code == 201
    assert client.post("/api/plans", json=plan_body()).status_code == 409  # mismo tema
    temas = {p["topic"] for p in client.get("/api/dashboard").json()["plans"]}
    assert temas == {"Recursividad", "Arreglos, pilas y colas"}


# ---------------- Modelo de datos (DER) ----------------

def test_temas_cargados(client):
    with Session(engine) as db:
        assert sorted(t.nombre for t in db.exec(select(Tema)).all()) == sorted(TEMAS)


def test_objetivo_guarda_lo_del_diccionario(client):
    client.post("/api/auth/dev")
    client.post("/api/plans", json=plan_body())
    with Session(engine) as db:
        obj = db.exec(select(ObjetivoEstudio)).one()
        assert (obj.nivel_inicial, obj.nota_objetivo, obj.lenguaje, obj.dias_disponibles) == ("intermedio", 8, "java", 28)
        plan = json.loads(obj.plan_estudio)  # plan_estudio: JSON día por día
        assert len(plan) == 12 and plan[0]["modulo"] == "aprender" and plan[0]["estado"] == "pendiente"
        assert db.exec(select(NivelDominio).where(NivelDominio.id_objetivo == obj.id_objetivo)).one().porcentaje == 0


def _sesion(db, modulo):
    est = Estudiante(id_google="g1", nombre="Ana", correo_electronico="ana@x.com")
    db.add(est); db.flush()
    tema = db.exec(select(Tema).where(Tema.nombre == "Recursividad")).one()
    obj = ObjetivoEstudio(id_estudiante=est.id_estudiante, id_tema=tema.id_tema, dias_disponibles=7,
                          nivel_inicial="principiante", nota_objetivo=8, lenguaje="python", plan_estudio="[]")
    db.add(obj); db.flush()
    ses = SesionEstudio(id_objetivo=obj.id_objetivo, modulo=modulo)
    db.add(ses); db.flush()
    return tema, obj, ses


def test_intento_dificultad_y_puntos_en_practicar(client):
    with Session(engine) as db:
        tema, obj, ses = _sesion(db, "practicar")
        ej = Ejercicio(id_tema=tema.id_tema, enunciado="Factorial recursivo", tiempo_esperado=10, casos_prueba='[{"in": 5, "out": 120}]')
        db.add(ej); db.flush()
        intento = Intento(id_sesion=ses.id_sesion, id_ejercicio=ej.id_ejercicio, codigo="def f(n): ...", resultado="error lógico", tipo_error="caso base")
        db.add(intento); db.flush()
        # La dificultad queda ligada al intento que la originó (y por él, al ejercicio).
        db.add(DificultadDetectada(id_sesion=ses.id_sesion, id_intento=intento.id_intento, tipo_patron="intentos fallidos repetidos",
                                   nivel_intervencion=1, intervencion_generada="Revisá el caso base."))
        db.add(Punto(id_sesion=ses.id_sesion, cantidad=7, motivo="resuelto con pista mínima"))
        db.commit()
        dif = db.exec(select(DificultadDetectada)).one()
        assert db.get(Intento, dif.id_intento).id_ejercicio == ej.id_ejercicio


def test_dificultad_de_consolidar_sin_intento(client):
    with Session(engine) as db:
        _, _, ses = _sesion(db, "consolidar")
        db.add(Explicacion(id_sesion=ses.id_sesion, texto="La recursión es...", resultado="incompleta"))
        db.add(DificultadDetectada(id_sesion=ses.id_sesion, tipo_patron="explicación incompleta",
                                   nivel_intervencion=1, intervencion_generada="¿Qué pasa si nunca se llega al caso base?"))
        db.commit()
        assert db.exec(select(DificultadDetectada)).one().id_intento is None  # diccionario: vacío si surge en Consolidar


def test_puntos_suman_en_el_panel(client):
    client.post("/api/auth/dev")
    pid = client.post("/api/plans", json=plan_body()).json()["id"]
    with Session(engine) as db:
        ses = SesionEstudio(id_objetivo=pid, modulo="practicar")
        db.add(ses); db.flush()
        db.add_all([Punto(id_sesion=ses.id_sesion, cantidad=10, motivo="sin ayuda"), Punto(id_sesion=ses.id_sesion, cantidad=4, motivo="con explicación")])
        db.add(NivelDominio(id_objetivo=pid, porcentaje=35.5))
        db.commit()
    plan = client.get("/api/dashboard").json()["plans"][0]
    assert plan["points"] == 14 and plan["mastery"] == 35.5  # toma el último nivel de dominio


def test_claves_foraneas_activas(client):
    with Session(engine) as db:
        db.add(SesionEstudio(id_objetivo=999, modulo="aprender"))  # objetivo inexistente
        with pytest.raises(IntegrityError):
            db.commit()


def test_un_objetivo_por_tema_en_la_base(client):
    with Session(engine) as db:
        tema, obj, _ = _sesion(db, "aprender")
        db.add(ObjetivoEstudio(id_estudiante=obj.id_estudiante, id_tema=tema.id_tema, dias_disponibles=3,
                               nivel_inicial="avanzado", nota_objetivo=6, lenguaje="c", plan_estudio="[]"))
        with pytest.raises(IntegrityError):
            db.commit()


# ---------------- Login con Google (HU-001), con Google simulado ----------------

class _Resp:
    def __init__(self, data, status=200): self._data, self.status_code = data, status
    def json(self): return self._data


def _google(monkeypatch, aud, verificado=True):
    from app import security
    monkeypatch.setattr(security.settings, "google_client_id", "mi-cliente.apps.googleusercontent.com")
    def get(url, **kw):
        if url == security.TOKENINFO_URL:
            return _Resp({"aud": aud, "sub": "1234567890", "email": "jaz@gmail.com"})
        return _Resp({"sub": "1234567890", "email": "jaz@gmail.com", "email_verified": verificado,
                      "name": "Jazmín Bustos", "picture": "https://foto"})
    monkeypatch.setattr(security.requests, "get", get)


def test_login_google_crea_el_estudiante(client, monkeypatch):
    _google(monkeypatch, aud="mi-cliente.apps.googleusercontent.com")
    r = client.post("/api/auth/google", json={"access_token": "x" * 40})
    assert r.status_code == 200 and r.json()["name"] == "Jazmín Bustos" and r.json()["has_plan"] is False
    assert client.get("/api/auth/me").json()["picture"] == "https://foto"
    with Session(engine) as db:
        assert db.exec(select(Estudiante)).one().id_google == "1234567890"  # se identifica por sub, no por el correo


def test_login_google_rechaza_token_de_otra_app(client, monkeypatch):
    _google(monkeypatch, aud="otra-app.apps.googleusercontent.com")
    assert client.post("/api/auth/google", json={"access_token": "x" * 40}).status_code == 401


def test_login_google_rechaza_correo_no_verificado(client, monkeypatch):
    _google(monkeypatch, aud="mi-cliente.apps.googleusercontent.com", verificado=False)
    assert client.post("/api/auth/google", json={"access_token": "x" * 40}).status_code == 401
