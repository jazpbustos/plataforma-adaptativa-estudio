import json
from datetime import date, datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.config import settings
from app.db import TEMAS, engine
from app.main import app
from app.models import (DificultadDetectada, Ejercicio, Estudiante, Explicacion, FuenteAcademica, Intento,
                        NivelDominio, ObjetivoEstudio, Punto, SesionEstudio, Tema)
from app.services.planner import (DiasInsuficientes, construir_dias, dias_minimos, plan_inicial, required_mastery,
                                  split_counts, validar_dias)
from archivos import docx


@pytest.fixture()
def client():
    from sqlmodel import SQLModel
    from app.db import init_db
    init_db()
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:  # al arrancar, la app vuelve a crear las tablas y carga los temas
        yield c


def plan_body(**kw):
    body = dict(topic="Recursividad", days=10, level="intermedio", target_grade=8, language="java")
    body.update(kw)
    return body


# ---------------- Planificador (HU-002) ----------------

def test_split_counts_suma_total_y_minimo_uno():
    for total in range(3, 15):
        for w in [(0.5, 0.35, 0.15), (0.22, 0.5, 0.28)]:
            c = split_counts(total, w)
            assert sum(c) == total and min(c) >= 1


def test_plan_dia_por_dia_desde_hoy_y_en_orden_pedagogico():
    hoy = date(2026, 10, 23)
    dias = construir_dias(hoy, 10, "principiante", 8)
    assert [d["fecha"] for d in dias] == [(hoy + timedelta(days=i)).isoformat() for i in range(10)]
    orden = [d["actividades"][0]["modulo"] for d in dias]
    assert orden == sorted(orden, key=["aprender", "practicar", "consolidar"].index)
    assert all(a["estado"] == "pendiente" for d in dias for a in d["actividades"])


def test_actividades_de_cada_modulo():
    dias = construir_dias(date(2026, 10, 23), 7, "intermedio", 6)
    aprender = [d for d in dias if d["actividades"][0]["modulo"] == "aprender"]
    assert aprender[-1]["actividades"][-1]["tipo"] == "evaluación"  # la evaluación cierra Aprender
    ejercicios = [a for d in dias for a in d["actividades"] if a["tipo"] == "ejercicio"]
    assert len(ejercicios) == 5  # los cinco que aprueban Practicar (HU-011)
    assert {a["tipo"] for d in dias for a in d["actividades"]} <= {"contenido", "evaluación", "ejercicio", "refuerzo"}


def test_dominio_requerido_y_dias_minimos_segun_nota():
    # HU-002, CA2 y CA6.
    assert [required_mastery(n) for n in range(6, 11)] == [60, 60, 80, 80, 90]
    assert [dias_minimos(n) for n in range(6, 11)] == [3, 3, 4, 4, 5]


@pytest.mark.parametrize("dias", [0, 15])
def test_dias_fuera_de_rango(dias):
    with pytest.raises(DiasInsuficientes, match="de 1 a 14"):  # CA5
        validar_dias(dias, 6)


def test_pocos_dias_para_la_nota_ofrece_alternativas():
    with pytest.raises(DiasInsuficientes) as e:  # CA6
        validar_dias(4, 10)
    assert "al menos 5 días" in str(e.value) and "bajá la nota objetivo a 9" in str(e.value)
    with pytest.raises(DiasInsuficientes) as e:
        validar_dias(2, 6)
    assert "al menos 3 días" in str(e.value) and "bajá" not in str(e.value)  # no hay nota que entre en 2 días


def test_nota_mas_alta_suma_practica():
    practica = lambda nota: sum(1 for d in construir_dias(date(2026, 10, 23), 14, "intermedio", nota)
                                if d["actividades"][0]["modulo"] == "practicar")
    assert practica(10) >= practica(6)


def test_plan_guarda_versiones():
    versiones = plan_inicial(date(2026, 10, 23), 5, "avanzado", 10)
    assert [(v["numero"], v["motivo"]) for v in versiones] == [(1, "inicial")]
    assert len(versiones[0]["dias"]) == 5


# ---------------- API ----------------

def test_rutas_protegidas_sin_sesion(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/dashboard").status_code == 401


def test_flujo_completo_demo(client):
    assert client.post("/api/auth/dev").status_code == 200
    me = client.get("/api/auth/me").json()
    assert me["name"] == "Usuario Demo" and me["has_plan"] is False and me["role"] == "estudiante"  # HU-001 CA1
    prev = client.post("/api/plans/preview", json=plan_body()).json()
    assert (prev["total_sessions"], prev["required_mastery"], prev["min_days"]) == (10, 80, 4)
    assert prev["sessions"][0]["day"] == date.today().isoformat()
    r = client.post("/api/plans", json=plan_body())
    assert r.status_code == 201
    pid = r.json()["id"]
    assert client.get("/api/auth/me").json()["has_plan"] is True  # HU-001 CA2: va al panel
    up = client.post(f"/api/plans/{pid}/materials",
                     files={"file": ("apunte.docx", docx("Toda función recursiva necesita un caso base."))})
    assert up.status_code == 201
    bad = client.post(f"/api/plans/{pid}/materials", files={"file": ("virus.exe", b"x", "application/octet-stream")})
    assert bad.status_code == 415
    mats = client.get("/api/materials").json()
    assert mats[0]["filename"] == "apunte.docx" and mats[0]["topic"] == "Recursividad"
    plan = client.get("/api/dashboard").json()["plans"][0]
    assert plan["materials"] == 1
    assert plan["next_session"]["module"] == "aprender"
    assert plan["target_grade"] == 8 and plan["required_mastery"] == 80
    assert plan["mastery"] == 0 and plan["points"] == 0
    assert plan["plan_version"] == 1 and plan["plan_readjusted"] is False
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401


def test_validaciones(client):
    client.post("/api/auth/dev")
    prev = lambda **kw: client.post("/api/plans/preview", json=plan_body(**kw))
    assert "de 1 a 14" in prev(days=0).json()["detail"]  # HU-002 CA5
    assert "de 1 a 14" in prev(days=15).json()["detail"]
    r = prev(days=3, target_grade=10)  # CA6
    assert r.status_code == 422 and "al menos 5 días" in r.json()["detail"]
    assert prev(target_grade=5).status_code == 422
    assert prev(target_grade=11).status_code == 422
    assert prev(level=2).status_code == 422
    assert prev(topic="Árboles binarios").status_code == 422  # fuera del alcance
    assert prev(language="c").status_code == 422  # solo Java y Python
    sin_lenguaje = plan_body(); sin_lenguaje.pop("language")
    assert client.post("/api/plans/preview", json=sin_lenguaje).status_code == 422  # CA4


def test_varios_temas_sin_repetir(client):
    client.post("/api/auth/dev")
    assert client.post("/api/plans", json=plan_body()).status_code == 201
    assert client.post("/api/plans", json=plan_body(topic="Estructuras de datos lineales")).status_code == 201
    assert client.post("/api/plans", json=plan_body()).status_code == 409  # mismo tema
    temas = {p["topic"] for p in client.get("/api/dashboard").json()["plans"]}
    assert temas == {"Recursividad", "Estructuras de datos lineales"}


# ---------------- Modelo de datos (DER) ----------------

def test_temas_cargados_con_sus_conceptos(client):
    with Session(engine) as db:
        temas = db.exec(select(Tema)).all()
    assert sorted(t.nombre for t in temas) == sorted(TEMAS)
    for t in temas:
        assert 3 <= len(json.loads(t.conceptos_esperados)) <= 5  # HU-008 CA2
    rec = next(t for t in temas if t.nombre == "Recursividad")
    assert json.loads(rec.conceptos_esperados) == ["caso base", "caso recursivo que se acerca al caso base", "pila de llamadas"]


def test_tema_con_nombre_anterior_se_renombra():
    from sqlmodel import SQLModel
    from app.db import init_db
    init_db()
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Tema(nombre="Arreglos, pilas y colas", area="x"))
        db.commit()
    init_db()
    with Session(engine) as db:
        nombres = set(db.exec(select(Tema.nombre)).all())
    assert "Arreglos, pilas y colas" not in nombres and "Estructuras de datos lineales" in nombres


def test_base_anterior_a_la_entrega_3_se_reinicia(client):
    client.post("/api/auth/dev")
    client.post("/api/plans", json=plan_body())
    from sqlalchemy import text
    from app.db import init_db
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE fuente_academica"))  # como una base local de antes de la Entrega 3
    init_db()
    with Session(engine) as db:
        assert db.exec(select(ObjetivoEstudio)).all() == [] and db.exec(select(FuenteAcademica)).all() == []


def test_objetivo_guarda_lo_del_diccionario(client):
    client.post("/api/auth/dev")
    client.post("/api/plans", json=plan_body())
    with Session(engine) as db:
        obj = db.exec(select(ObjetivoEstudio)).one()
        assert (obj.nivel_inicial, obj.nota_objetivo, obj.lenguaje, obj.dias_disponibles) == ("intermedio", 8, "java", 10)
        versiones = json.loads(obj.plan_estudio)  # arreglo de versiones; la vigente es la última
        v = versiones[-1]
        assert v["numero"] == 1 and v["motivo"] == "inicial" and len(v["dias"]) == 10
        assert v["dias"][0]["actividades"][0] == {"modulo": "aprender", "tipo": "contenido", "estado": "pendiente"}
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


def _ejercicio(db, tema):
    ej = Ejercicio(id_tema=tema.id_tema, enunciado="Factorial recursivo", dificultad="básico", tiempo_esperado=10,
                   casos_prueba='[{"entrada": 5, "salida": 120}, {"entrada": 0, "salida": 1}, {"entrada": 1, "salida": 1}]')
    db.add(ej); db.flush()
    return ej


def test_intento_dificultad_y_puntos_en_practicar(client):
    with Session(engine) as db:
        tema, obj, ses = _sesion(db, "practicar")
        ej = _ejercicio(db, tema)
        intento = Intento(id_sesion=ses.id_sesion, id_ejercicio=ej.id_ejercicio, lenguaje="python", codigo="def f(n): ...",
                          resultado="error lógico", tipo_error="lógico: caso 2")
        db.add(intento); db.flush()
        # La dificultad queda ligada al intento que la originó (y por él, al ejercicio).
        db.add(DificultadDetectada(id_sesion=ses.id_sesion, id_intento=intento.id_intento, tipo_patron="intentos fallidos repetidos",
                                   nivel_intervencion=1, intervencion_generada="Revisá el caso base."))
        db.add(Punto(id_sesion=ses.id_sesion, id_ejercicio=ej.id_ejercicio, cantidad=7, motivo="resuelto con pista mínima"))
        db.commit()
        dif = db.exec(select(DificultadDetectada)).one()
        assert db.get(Intento, dif.id_intento).id_ejercicio == ej.id_ejercicio
        assert dif.hubo_avance_posterior is None  # nulo hasta el intento siguiente
        assert db.exec(select(Punto)).one().id_ejercicio == ej.id_ejercicio


def test_sesion_de_aprender_guarda_modo_y_evaluacion(client):
    with Session(engine) as db:
        _, _, ses = _sesion(db, "aprender")
        ses.modo, ses.resultado_evaluacion = "evaluación", 80.0
        ses.detalle_aprender = json.dumps({"conceptos_recorridos": ["caso base"], "falladas": []})
        db.add(ses); db.commit()
        assert db.get(SesionEstudio, ses.id_sesion).resultado_evaluacion == 80.0


def test_dificultad_de_consolidar_sin_intento(client):
    with Session(engine) as db:
        _, _, ses = _sesion(db, "consolidar")
        db.add(Explicacion(id_sesion=ses.id_sesion, texto="La recursión es...", resultado="no concluyente"))
        db.add(DificultadDetectada(id_sesion=ses.id_sesion, tipo_patron="explicación incompleta",
                                   intervencion_generada="¿Qué pasa si nunca se llega al caso base?"))
        db.commit()
        dif = db.exec(select(DificultadDetectada)).one()
        assert dif.id_intento is None and dif.nivel_intervencion is None  # diccionario: nulos si surge en Consolidar


def test_puntos_suman_en_el_panel(client):
    client.post("/api/auth/dev")
    pid = client.post("/api/plans", json=plan_body()).json()["id"]
    with Session(engine) as db:
        tema = db.exec(select(Tema).where(Tema.nombre == "Recursividad")).one()
        e1, e2 = _ejercicio(db, tema), _ejercicio(db, tema)
        ses = SesionEstudio(id_objetivo=pid, modulo="practicar")
        db.add(ses); db.flush()
        db.add_all([Punto(id_sesion=ses.id_sesion, id_ejercicio=e1.id_ejercicio, cantidad=10, motivo="sin ayuda"),
                    Punto(id_sesion=ses.id_sesion, id_ejercicio=e2.id_ejercicio, cantidad=4, motivo="con explicación")])
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
                               nivel_inicial="avanzado", nota_objetivo=6, lenguaje="java", plan_estudio="[]"))
        with pytest.raises(IntegrityError):
            db.commit()


# ---------------- Sesión y perfiles (Seguridad) ----------------

def test_token_dura_ocho_horas_y_lleva_el_rol(client):
    client.post("/api/auth/dev")
    datos = jwt.decode(client.cookies.get("session"), settings.jwt_secret, algorithms=["HS256"])
    duracion = datetime.fromtimestamp(datos["exp"], timezone.utc) - datetime.fromtimestamp(datos["iat"], timezone.utc)
    assert duracion == timedelta(hours=8) and datos["rol"] == "estudiante"


def test_solo_administrador(client):
    from app.security import solo_administrador
    with Session(engine) as db:
        est = Estudiante(id_google="g2", nombre="Ana", correo_electronico="a@x.com")
        db.add(est); db.commit(); db.refresh(est)
        with pytest.raises(HTTPException) as e:
            solo_administrador(est)
        assert e.value.status_code == 403
        est.rol = "administrador"
        assert solo_administrador(est) is est


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
        est = db.exec(select(Estudiante)).one()
        assert est.id_google == "1234567890" and est.rol == "estudiante"  # se identifica por sub, no por el correo


def test_login_google_rechaza_token_de_otra_app(client, monkeypatch):
    _google(monkeypatch, aud="otra-app.apps.googleusercontent.com")
    assert client.post("/api/auth/google", json={"access_token": "x" * 40}).status_code == 401


def test_login_google_rechaza_correo_no_verificado(client, monkeypatch):
    _google(monkeypatch, aud="mi-cliente.apps.googleusercontent.com", verificado=False)
    assert client.post("/api/auth/google", json={"access_token": "x" * 40}).status_code == 401
