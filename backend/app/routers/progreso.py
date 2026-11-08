"""Progreso de un tema (Pantalla 5; HU-009, HU-010 CA2, HU-011 y HU-012).

Reúne en una sola respuesta lo que muestra el dashboard de cada tema:
- el nivel de dominio frente al requerido por la nota objetivo y la diferencia (HU-012, CA2);
- el resultado de cada módulo que interviene en la fórmula de HU-010, con su peso y su aporte, para que el
  porcentaje mostrado se pueda reconstruir;
- el estado de cada módulo (aprobado, habilitado o bloqueado) y, si está bloqueado, qué falta (HU-011, CA3);
- los puntos por ejercicio y el total (HU-011, CA1);
- el historial de sesiones con las dificultades detectadas en cada una (HU-009, HU-012 CA1).
- el estado del plan: versión, motivo del último reajuste y, si terminó sin alcanzar el dominio requerido, la
  posibilidad de extenderlo (POST /plans/{id}/plan/extender); si alcanzó el dominio requerido, la de seguir con el
  nivel siguiente (POST /plans/{id}/plan/avanzar, HU-010 CA6).
El plan de hoy de todos los temas sale del panel (/dashboard), que ya reúne los objetivos activos.
"""
import json

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..config import P
from ..db import get_session
from ..models import DificultadDetectada, Ejercicio, Estudiante, Explicacion, Intento, Punto, SesionEstudio, Tema
from ..security import current_user
from ..services.planner import (DIAS_EXTENSION, avanzar_nivel, nivel_siguiente, plan_a_json, plan_desde_json, reajustar,
                                required_mastery, vigente)
from ..services.progreso import nivel_dominio
from .practicar import _estado, _fin, _modulo_de_refuerzo, _objetivo, _resultados, _titulo_y_texto, revisar_plan

router = APIRouter(tags=["progreso"])
DOM = P["dominio"]
PR = P["practicar"]
PUNTOS = PR["puntos"]
AYUDA = {PUNTOS["sin_ayuda"]: "sin ayuda", PUNTOS["pista_minima"]: "con pista mínima",
         PUNTOS["explicacion_elaborada"]: "con explicación elaborada"}
MODOS = {"lección guiada": "Lección guiada", "tarjetas de memoria": "Tarjetas de memoria",
         "cuestionario de práctica": "Cuestionario de práctica", "repetición": "Repetición de lo fallado",
         "evaluación": "Evaluación de comprensión"}


def _componentes(mejor: float | None, puntos: dict[int, int], explicacion: str | None) -> dict:
    """A, P y C con su peso y su aporte: la suma de los aportes es el dominio (HU-010)."""
    n, maximo = PR["ejercicios_para_aprobar"], PUNTOS["sin_ayuda"]
    mejores = sorted(puntos.values(), reverse=True)[:n]
    a = mejor or 0
    p = sum(mejores) / (n * maximo) * 100
    c = DOM["consolidar"].get(explicacion or "", 0)
    filas = {
        "aprender": {"valor": round(a, 1), "peso": DOM["peso_aprender"],
                     "detalle": f"mejor evaluación: {a:g} %" if mejor is not None else "todavía sin evaluación"},
        "practicar": {"valor": round(p, 1), "peso": DOM["peso_practicar"],
                      "detalle": f"{sum(mejores)} de {n * maximo} puntos en los {n} mejores ejercicios"},
        "consolidar": {"valor": c, "peso": DOM["peso_consolidar"],
                       "detalle": f"última explicación: {explicacion}" if explicacion else "todavía sin explicación"},
    }
    for f in filas.values():
        f["aporte"] = round(f["peso"] * f["valor"], 1)
    return filas


def _dificultades_por_sesion(db: Session, ids: list[int]) -> dict[int, list[dict]]:
    filas = db.exec(select(DificultadDetectada, Intento, Ejercicio)
                    .join(Intento, DificultadDetectada.id_intento == Intento.id_intento, isouter=True)
                    .join(Ejercicio, Intento.id_ejercicio == Ejercicio.id_ejercicio, isouter=True)
                    .where(DificultadDetectada.id_sesion.in_(ids))
                    .order_by(DificultadDetectada.fecha_hora)).all() if ids else []
    por_sesion: dict[int, list[dict]] = {}
    for d, _, ej in filas:
        por_sesion.setdefault(d.id_sesion, []).append({
            "tipo": d.tipo_patron, "nivel": d.nivel_intervencion, "fecha_hora": d.fecha_hora,
            "ejercicio": _titulo_y_texto(ej)[0] if ej else None,
            "intervencion": d.intervencion_generada, "hubo_avance": d.hubo_avance_posterior,
        })
    return por_sesion


def _resumen_sesion(db: Session, s: SesionEstudio, titulos: dict[int, str]) -> str:
    """Una línea con lo que se hizo en la sesión, según el módulo."""
    if s.modulo == "aprender":
        d = json.loads(s.detalle_aprender or "{}")
        partes = [MODOS.get(s.modo or "", s.modo or "Aprender")]
        if s.resultado_evaluacion is not None:
            partes.append(f"{s.resultado_evaluacion:g} %")
        if d.get("recorridos"):
            partes.append(f"conceptos: {', '.join(d['recorridos'])}")
        if d.get("falladas"):
            partes.append(f"{len(d['falladas'])} para repasar")
        return " · ".join(partes)
    if s.modulo == "practicar":
        intentos = db.exec(select(Intento).where(Intento.id_sesion == s.id_sesion)).all()
        ejercicios = {i.id_ejercicio for i in intentos}
        resueltos = {i.id_ejercicio for i in intentos if i.resultado == "correcto"}
        nombres = ", ".join(titulos.get(e, "ejercicio") for e in sorted(ejercicios))
        plural = lambda n, uno, varios: f"{n} {uno if n == 1 else varios}"  # noqa: E731
        return (f"{plural(len(intentos), 'intento', 'intentos')} en {plural(len(ejercicios), 'ejercicio', 'ejercicios')} "
                f"({plural(len(resueltos), 'resuelto', 'resueltos')})" + (f": {nombres}" if nombres else ""))
    explicaciones = db.exec(select(Explicacion).where(Explicacion.id_sesion == s.id_sesion)
                            .order_by(Explicacion.fecha_hora)).all()
    n = len(explicaciones)
    return f"{n} {'explicación' if n == 1 else 'explicaciones'}" + (f" · última: {explicaciones[-1].resultado}" if explicaciones else "")


@router.get("/plans/{plan_id}/progreso")
def progreso(plan_id: int, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    obj = _objetivo(db, plan_id, est)
    if revisar_plan(db, obj):
        db.commit()
    tema = db.get(Tema, obj.id_tema)
    mejor, puntos, explicacion = _resultados(db, obj)
    dominio = nivel_dominio(mejor, list(puntos.values()), explicacion)
    requerido = required_mastery(obj.nota_objetivo)

    ejercicios = {e.id_ejercicio: e for e in db.exec(select(Ejercicio).where(Ejercicio.id_tema == obj.id_tema)).all()}
    titulos = {i: _titulo_y_texto(e)[0] for i, e in ejercicios.items()}
    filas_puntos = db.exec(select(Punto).join(SesionEstudio, Punto.id_sesion == SesionEstudio.id_sesion)
                           .where(SesionEstudio.id_objetivo == obj.id_objetivo).order_by(Punto.fecha_hora)).all()

    sesiones = db.exec(select(SesionEstudio).where(SesionEstudio.id_objetivo == obj.id_objetivo)
                       .order_by(SesionEstudio.fecha_hora_inicio.desc(), SesionEstudio.id_sesion.desc())).all()
    dificultades = _dificultades_por_sesion(db, [s.id_sesion for s in sesiones])

    return {
        "tema": tema.nombre, "nota_objetivo": obj.nota_objetivo,
        "dominio": dominio, "requerido": requerido, "diferencia": round(dominio - requerido, 1),
        "componentes": _componentes(mejor, puntos, explicacion),
        "plan": _estado_plan(obj, dominio < requerido),
        "nivel": obj.nivel_inicial,
        "modulos": _estado(db, obj),
        "puntos": {
            "total": sum(p.cantidad for p in filas_puntos),
            "ejercicios": [{"ejercicio": titulos.get(p.id_ejercicio, "ejercicio"), "puntos": p.cantidad,
                            "ayuda": AYUDA.get(p.cantidad, ""), "fecha_hora": p.fecha_hora} for p in filas_puntos],
        },
        "historial": [{"id": s.id_sesion, "fecha_hora": s.fecha_hora_inicio, "modulo": s.modulo, "modo": s.modo,
                       "duracion_minutos": s.duracion_minutos, "resumen": _resumen_sesion(db, s, titulos),
                       "dificultades": dificultades.get(s.id_sesion, [])} for s in sesiones],
    }


def _estado_plan(obj, falta_dominio: bool) -> dict:
    versiones = plan_desde_json(obj.plan_estudio)
    v, fin = vigente(versiones), _fin(obj, versiones)
    terminado = fin < date.today()
    siguiente = None if falta_dominio else nivel_siguiente(obj.nivel_inicial)
    return {"version": v["numero"], "motivo": v["motivo"], "fin": fin, "terminado": terminado,
            "extensible": terminado and falta_dominio, "dias_extension": list(DIAS_EXTENSION),
            "nivel_siguiente": siguiente}


class DiasIn(BaseModel):
    dias: int


def _preparar(db: Session, plan_id: int, est: Estudiante, dias: int) -> tuple:
    """Lo común a extender el plan y a seguir con otro nivel: el objetivo, su estado (con el dominio actual), las
    versiones del plan y la fecha de hoy. Valida que los días estén entre 1 y 7."""
    if not DIAS_EXTENSION[0] <= dias <= DIAS_EXTENSION[1]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Se puede elegir de {DIAS_EXTENSION[0]} a {DIAS_EXTENSION[1]} días.")
    obj = _objetivo(db, plan_id, est)
    mejor, puntos, explicacion = _resultados(db, obj)
    estado = _estado_plan(obj, nivel_dominio(mejor, list(puntos.values()), explicacion) < required_mastery(obj.nota_objetivo))
    return obj, estado, plan_desde_json(obj.plan_estudio), date.today()


def _guardar(db: Session, obj, versiones: list[dict], hoy: date, dias: int) -> None:
    """El plan termina `dias` días después de hoy (contados desde su primer día) y se guarda la versión nueva."""
    inicio = date.fromisoformat(versiones[0]["dias"][0]["fecha"])
    obj.dias_disponibles = (hoy + timedelta(days=dias - 1) - inicio).days + 1
    obj.plan_estudio = plan_a_json(versiones)
    db.add(obj)
    db.commit()


@router.post("/plans/{plan_id}/plan/extender")
def extender(plan_id: int, body: DiasIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """El plan terminó sin alcanzar el dominio requerido: se extiende de 1 a 7 días desde hoy y se agrega una versión
    nueva con lo pendiente y actividades de refuerzo (HU-010, CA5)."""
    obj, estado, versiones, hoy = _preparar(db, plan_id, est, body.dias)
    if not estado["extensible"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "El plan se puede extender cuando terminó sin alcanzar el dominio requerido.")
    fin = hoy + timedelta(days=body.dias - 1)
    reajustar(versiones, hoy, fin, "extensión", _modulo_de_refuerzo(_estado(db, obj)))
    _guardar(db, obj, versiones, hoy, body.dias)
    return {"version": len(versiones), "fin": fin}


@router.post("/plans/{plan_id}/plan/avanzar")
def avanzar(plan_id: int, body: DiasIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Dominio requerido alcanzado: el estudiante sigue estudiando el tema con el nivel siguiente durante 1 a 7 días
    (HU-010, CA6). La evaluación de Aprender ajusta su dificultad al nivel nuevo (HU-004, CA6) y Practicar sigue con
    los ejercicios no resueltos; los módulos aprobados y el mejor resultado de cada uno se conservan."""
    obj, estado, versiones, hoy = _preparar(db, plan_id, est, body.dias)
    siguiente = estado["nivel_siguiente"]
    if not siguiente:
        raise HTTPException(status.HTTP_409_CONFLICT, "Se puede seguir con otro nivel al alcanzar el dominio requerido, "
                                                      "si todavía no estás en el nivel avanzado.")
    obj.nivel_inicial = siguiente
    avanzar_nivel(versiones, hoy, body.dias)
    _guardar(db, obj, versiones, hoy, body.dias)
    return {"version": len(versiones), "nivel": siguiente, "fin": hoy + timedelta(days=body.dias - 1)}
