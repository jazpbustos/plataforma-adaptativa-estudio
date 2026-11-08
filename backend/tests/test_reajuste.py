"""Reajuste del plan (HU-010, CA3 y CA4) y extensión cuando el plan terminó sin alcanzar el dominio."""
import json
from datetime import date, timedelta

from sqlmodel import Session

from app.db import engine
from app.models import ObjetivoEstudio
from app.services import planner
from tests.test_practicar_api import client  # noqa: F401


def crear_plan(c, dias: int) -> int:
    return c.post("/api/plans", json=dict(topic="Recursividad", days=dias, level="intermedio", target_grade=8,
                                          language="python")).json()["id"]

HOY = date(2026, 11, 10)


def _plan(desde: date, dias: list[list[tuple[str, str]]]) -> list[dict]:
    return [{"numero": 1, "fecha_generacion": desde.isoformat(), "motivo": "inicial",
             "dias": [{"fecha": (desde + timedelta(days=i)).isoformat(),
                       "actividades": [{"modulo": m, "tipo": t, "estado": "pendiente"} for m, t in acts]}
                      for i, acts in enumerate(dias)]}]


def test_dia_vencido_reprograma_lo_pendiente_y_suma_refuerzo():
    v = _plan(HOY - timedelta(days=1), [[("aprender", "contenido")], [("aprender", "contenido"), ("aprender", "evaluación")],
                                         [("practicar", "ejercicio")]])
    assert planner.dias_vencidos_con_pendientes(v[-1], HOY)
    assert planner.reajustar(v, HOY, HOY + timedelta(days=3), "reajuste: actividades pendientes", "aprender")
    nueva = v[-1]
    assert (nueva["numero"], nueva["motivo"], len(v)) == (2, "reajuste: actividades pendientes", 2)
    assert v[0]["dias"][0]["actividades"][0]["estado"] == "pendiente"  # la versión anterior no cambia
    ayer, *desde_hoy = nueva["dias"]
    assert ayer["actividades"][0]["estado"] == "reprogramada" and planner.estado_del_dia(ayer) == "no realizada"
    assert [[a["tipo"] for a in d["actividades"]] for d in desde_hoy] == [["contenido"], ["contenido", "evaluación"], ["ejercicio"], ["refuerzo"]]
    assert desde_hoy[0]["fecha"] == HOY.isoformat() and desde_hoy[-1]["actividades"][0]["modulo"] == "aprender"


def test_sin_dias_libres_el_refuerzo_va_al_primer_dia_y_sin_dias_no_hay_reajuste():
    v = _plan(HOY - timedelta(days=2), [[("aprender", "contenido")], [("practicar", "ejercicio")], [("consolidar", "evaluación")]])
    assert planner.reajustar(v, HOY, HOY, "reajuste: actividades pendientes", "practicar")
    [hoy] = [d for d in v[-1]["dias"] if d["fecha"] == HOY.isoformat()]
    assert [a["tipo"] for a in hoy["actividades"]] == ["contenido", "ejercicio", "evaluación", "refuerzo"]  # se juntan
    assert not planner.reajustar(v, HOY, HOY - timedelta(days=1), "reajuste: actividades pendientes", "practicar")


def test_adelantarse_corre_las_actividades_un_dia():
    v = _plan(HOY, [[("practicar", "ejercicio")], [("practicar", "ejercicio")], [("consolidar", "evaluación")]])
    v[0]["dias"][0]["actividades"][0]["estado"] = "completada"
    v[0]["dias"][1]["actividades"][0]["estado"] = "completada"
    assert planner.reajustar(v, HOY, HOY + timedelta(days=2), "reajuste: adelanto", adelantar=True)
    dias = v[-1]["dias"]
    assert [d["fecha"] for d in dias] == [HOY.isoformat(), (HOY + timedelta(days=1)).isoformat()]
    assert [a["tipo"] for a in dias[0]["actividades"]] == ["ejercicio", "ejercicio"] and dias[1]["actividades"][0]["modulo"] == "consolidar"


def _correr_plan(plan_id: int, dias_atras: int, dias_disponibles: int | None = None):
    """Simula que el plan empezó hace `dias_atras` días."""
    with Session(engine) as db:
        obj = db.get(ObjetivoEstudio, plan_id)
        versiones = json.loads(obj.plan_estudio)
        for v in versiones:
            for d in v["dias"]:
                d["fecha"] = (date.fromisoformat(d["fecha"]) - timedelta(days=dias_atras)).isoformat()
        obj.plan_estudio = json.dumps(versiones)
        if dias_disponibles:
            obj.dias_disponibles = dias_disponibles
        db.add(obj); db.commit()


def test_el_panel_reajusta_un_plan_con_dias_vencidos(client):
    plan = crear_plan(client, 7)
    _correr_plan(plan, 2)  # pasaron dos días sin hacer nada
    p = next(x for x in client.get("/api/dashboard").json()["plans"] if x["id"] == plan)
    assert p["plan_version"] == 2 and p["plan_readjusted"] is True and p["plan_reason"] == "reajuste: actividades pendientes"
    assert p["today_session"]["module"] == "aprender"  # lo de ayer y anteayer arranca hoy
    semana = client.get("/api/dashboard").json()
    assert next(x for x in semana["plans"] if x["id"] == plan)["plan_version"] == 2  # no se reajusta dos veces el mismo día
    r = client.get(f"/api/plans/{plan}/progreso").json()
    assert r["plan"]["version"] == 2 and not r["plan"]["terminado"]


def test_plan_terminado_sin_dominio_se_puede_extender(client):
    plan = crear_plan(client, 4)
    _correr_plan(plan, 6)
    r = client.get(f"/api/plans/{plan}/progreso").json()
    assert r["plan"]["terminado"] and r["plan"]["extensible"] and r["plan"]["version"] == 1  # sin días, no se reajusta
    assert client.post(f"/api/plans/{plan}/plan/extender", json={"dias": 9}).status_code == 422
    e = client.post(f"/api/plans/{plan}/plan/extender", json={"dias": 3}).json()
    assert e["version"] == 2 and e["fin"] == (date.today() + timedelta(days=2)).isoformat()
    p = next(x for x in client.get("/api/dashboard").json()["plans"] if x["id"] == plan)
    assert p["plan_reason"] == "extensión" and p["days_left"] == 2 and p["today_session"] is not None
    assert client.post(f"/api/plans/{plan}/plan/extender", json={"dias": 3}).status_code == 409  # ya no terminó


def test_completar_una_actividad_del_dia_siguiente_adelanta_el_plan():
    from app.routers.practicar import _completar_actividad
    hoy = date.today()
    v = _plan(hoy, [[("aprender", "contenido")], [("aprender", "contenido"), ("aprender", "evaluación")], [("practicar", "ejercicio")]])
    v[0]["dias"][0]["actividades"][0]["estado"] = "completada"  # hoy ya está completo
    obj = ObjetivoEstudio(id_estudiante=1, id_tema=1, dias_disponibles=3, nivel_inicial="intermedio", nota_objetivo=8,
                          lenguaje="python", plan_estudio=json.dumps(v))
    _completar_actividad(obj, "aprender", "contenido")  # es la del día siguiente: se adelantó
    versiones = json.loads(obj.plan_estudio)
    assert versiones[-1]["motivo"] == "reajuste: adelanto" and len(versiones) == 2
    dias = versiones[-1]["dias"]
    assert [a["tipo"] for a in dias[0]["actividades"]] == ["contenido", "contenido", "evaluación"]
    assert dias[1]["fecha"] == (hoy + timedelta(days=1)).isoformat() and dias[1]["actividades"][0]["modulo"] == "practicar"
    # Si hoy no estaba completo, no hay adelanto.
    v2 = _plan(hoy, [[("aprender", "contenido"), ("aprender", "contenido")]])
    obj.plan_estudio = json.dumps(v2)
    _completar_actividad(obj, "aprender", "contenido")
    assert len(json.loads(obj.plan_estudio)) == 1
