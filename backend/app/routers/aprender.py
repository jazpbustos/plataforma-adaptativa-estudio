"""Módulo Aprender: plan del tema, lección guiada, práctica, repetición y evaluación de comprensión (HU-003 y HU-004).

Todo lo que se registra va a SESION_ESTUDIO (módulo "aprender"), según el DER:
- modo: lección guiada | tarjetas de memoria | cuestionario de práctica | repetición | evaluación;
- detalle_aprender (JSON): los conceptos recorridos, las tarjetas o preguntas falladas que retoma la
  repetición y, en la lección guiada, las explicaciones ya generadas (así recargar la página no vuelve a
  consumir el modelo); en la evaluación, sus preguntas con la clave de corrección y las respuestas;
- resultado_evaluacion: el porcentaje de la evaluación; el mejor es A en la fórmula del dominio (HU-010).
"""
import json
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..config import P
from ..db import get_session
from ..models import Estudiante, MaterialEstudio, ObjetivoEstudio, SesionEstudio, Tema
from ..security import current_user
from ..services import aprender as gen
from ..services import llm, rag
from ..services.progreso import nivel_dominio
from .practicar import _completar_actividad, _estado, _objetivo, _registrar_dominio, _resultados

log = logging.getLogger(__name__)
router = APIRouter(tags=["aprender"])
A = P["aprender"]

LECCION, TARJETAS, CUESTIONARIO, REPETICION, EVALUACION = (
    "lección guiada", "tarjetas de memoria", "cuestionario de práctica", "repetición", "evaluación")
MODOS_PRACTICA = {"tarjetas": TARJETAS, "cuestionario": CUESTIONARIO, "repeticion": REPETICION}
NO_DISPONIBLE = "La generación de contenido no está disponible en este momento. Probá de nuevo en unos minutos."


class LeccionIn(BaseModel):
    concepto: str
    general: bool = False  # el estudiante pidió la explicación aunque el material sea insuficiente (HU-003, CA5)


class ComprobacionIn(BaseModel):
    concepto: str
    respuesta: int


class ConsultaIn(BaseModel):
    consulta: str = Field(min_length=2, max_length=600)
    general: bool = False
    concepto: str | None = None  # el que se está estudiando: la búsqueda y la respuesta se enfocan en él


class PracticaIn(BaseModel):
    modo: str  # tarjetas | cuestionario
    conceptos: list[str] | None = None  # los que se practican: el que se está estudiando o los ya recorridos


class ResultadoItem(BaseModel):
    item: dict
    correcta: bool


class ResultadoPracticaIn(BaseModel):
    modo: str  # tarjetas | cuestionario | repeticion
    resultados: list[ResultadoItem] = Field(max_length=40)


class RespuestasIn(BaseModel):
    respuestas: dict[str, int | str | None]


# ---------------- Datos del tema y de las sesiones ----------------

def _tema(db: Session, obj: ObjetivoEstudio) -> Tema:
    return db.get(Tema, obj.id_tema)


def _conceptos(tema: Tema) -> list[str]:
    return json.loads(tema.conceptos_esperados or "[]")


def _propios(db: Session, obj: ObjetivoEstudio) -> list[int]:
    return list(db.exec(select(MaterialEstudio.id_material).where(MaterialEstudio.id_objetivo == obj.id_objetivo,
                                                                   MaterialEstudio.estado == "procesado")).all())


def _sesiones(db: Session, obj: ObjetivoEstudio, modo: str | None = None) -> list[SesionEstudio]:
    q = select(SesionEstudio).where(SesionEstudio.id_objetivo == obj.id_objetivo, SesionEstudio.modulo == "aprender")
    if modo:
        q = q.where(SesionEstudio.modo == modo)
    return list(db.exec(q.order_by(SesionEstudio.id_sesion)).all())


def _detalle(s: SesionEstudio) -> dict:
    return json.loads(s.detalle_aprender or "{}")


def _guardar(s: SesionEstudio, detalle: dict) -> None:
    s.detalle_aprender = json.dumps(detalle, ensure_ascii=False)


def _sesion_del_dia(db: Session, obj: ObjetivoEstudio, modo: str) -> SesionEstudio:
    hoy = [s for s in _sesiones(db, obj, modo) if s.fecha_hora_inicio.date() == date.today()]
    if hoy:
        return hoy[-1]
    s = SesionEstudio(id_objetivo=obj.id_objetivo, modulo="aprender", modo=modo)
    db.add(s)
    db.flush()
    return s


def _recorridos(db: Session, obj: ObjetivoEstudio) -> set[str]:
    return {c for s in _sesiones(db, obj) for c in _detalle(s).get("recorridos", [])}


def _contenido(db: Session, obj: ObjetivoEstudio) -> dict[str, dict]:
    """Explicaciones ya generadas en la lección guiada, por concepto (la más reciente)."""
    contenido = {}
    for s in _sesiones(db, obj, LECCION):
        contenido.update(_detalle(s).get("contenido", {}))
    return contenido


def _falladas(db: Session, obj: ObjetivoEstudio) -> list[dict]:
    """Tarjetas y preguntas de práctica falladas que todavía no se respondieron bien en la repetición (CA4)."""
    falladas, resueltas = {}, set()
    for s in _sesiones(db, obj):
        d = _detalle(s)
        for it in d.get("falladas", []):
            falladas[it["id"]] = it
        resueltas |= set(d.get("resueltas", []))
    return [it for i, it in falladas.items() if i not in resueltas]


def _marcar_paso(sesion: SesionEstudio, concepto: str, paso: str) -> None:
    """Pasos hechos de la secuencia de cada concepto (lección, tarjetas, cuestionario), para mostrar el avance."""
    d = _detalle(sesion)
    pasos = d.setdefault("pasos", {})
    pasos[concepto] = sorted(set(pasos.get(concepto, [])) | {paso})
    _guardar(sesion, d)


def _pasos(db: Session, obj: ObjetivoEstudio) -> dict[str, set[str]]:
    pasos: dict[str, set[str]] = {}
    for s in _sesiones(db, obj):
        for c, ps in _detalle(s).get("pasos", {}).items():
            pasos.setdefault(c, set()).update(ps)
    return pasos


def _marcar_recorridos(db: Session, obj: ObjetivoEstudio, sesion: SesionEstudio, conceptos: set[str]) -> None:
    """Registra conceptos recorridos (CA1). El primer concepto nuevo del día completa una actividad de contenido."""
    previos = _recorridos(db, obj)
    nuevos = conceptos - previos
    if not nuevos:
        return
    d = _detalle(sesion)
    d["recorridos"] = sorted(set(d.get("recorridos", [])) | nuevos)
    _guardar(sesion, d)
    db.add(sesion)
    hoy = [s for s in _sesiones(db, obj) if s.fecha_hora_inicio.date() == date.today() and s.id_sesion != sesion.id_sesion]
    if not any(set(_detalle(s).get("recorridos", [])) for s in hoy) and not (set(d["recorridos"]) - nuevos):
        _completar_actividad(obj, "aprender", "contenido")
        db.add(obj)


def _evaluaciones(db: Session, obj: ObjetivoEstudio) -> tuple[list[SesionEstudio], SesionEstudio | None]:
    todas = _sesiones(db, obj, EVALUACION)
    pendiente = next((s for s in reversed(todas) if s.resultado_evaluacion is None), None)
    return [s for s in todas if s.resultado_evaluacion is not None], pendiente


def _composicion(preguntas: list[dict]) -> str:
    cuenta = {d: sum(p["dificultad"] == d for p in preguntas) for d in gen.DIFICULTADES}
    partes = [f"{n} {d}{'s' if n > 1 else ''}" for d, n in cuenta.items() if n]
    return ", ".join(partes[:-1]) + (" y " if len(partes) > 1 else "") + partes[-1]


def _fragmentos(obj: ObjetivoEstudio, consulta: str, propios: list[int]) -> dict:
    try:
        return rag.recuperar(obj.id_tema, consulta, propios, obj.lenguaje)
    except Exception as e:  # modelos del RAG o base vectorial no disponibles
        log.warning("No se pudo recuperar material: %s", e)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)


def _por_concepto(obj: ObjetivoEstudio, tema: Tema, conceptos: list[str], propios: list[int]) -> dict[str, list[dict]]:
    return {c: _fragmentos(obj, c, propios)["fragmentos"][:A["fragmentos_por_concepto"]] for c in conceptos}


def _requiere_modelo() -> None:
    if not llm.configurado():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)


# ---------------- Endpoints ----------------

@router.get("/plans/{plan_id}/aprender")
def ver_aprender(plan_id: int, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Plan del tema con sus conceptos recorridos (CA1), repetición pendiente, contradicciones y evaluaciones."""
    obj = _objetivo(db, plan_id, est)
    tema = _tema(db, obj)
    conceptos, recorridos = _conceptos(tema), _recorridos(db, obj)
    hechas, pendiente = _evaluaciones(db, obj)
    ultima = hechas[-1] if hechas else None
    contenido = _contenido(db, obj)
    estados = _estado(db, obj)
    pasos, falladas = _pasos(db, obj), _falladas(db, obj)
    return {
        "tema": tema.nombre, "nivel": obj.nivel_inicial, "lenguaje": obj.lenguaje,
        "conceptos": [{"nombre": c, "recorrido": c in recorridos,
                       "pasos": {p: p in pasos.get(c, set()) for p in ("leccion", "tarjetas", "cuestionario")},
                       "repeticion": sum(it["concepto"] == c for it in falladas)} for c in conceptos],
        "todos_recorridos": set(conceptos) <= recorridos,
        "repeticion": len(falladas),
        "contradicciones": [{"concepto": c, **e["contradiccion"]} for c, e in contenido.items() if e.get("contradiccion")],
        "ultima_evaluacion": None if not ultima else {
            "puntaje": _detalle(ultima)["calificacion"]["puntaje"], "sobre": len(_detalle(ultima)["preguntas"]),
            "porcentaje": ultima.resultado_evaluacion, "composicion": _composicion(_detalle(ultima)["preguntas"])},
        "mejor_evaluacion": max((s.resultado_evaluacion for s in hechas), default=None),
        "aprobado": estados["aprender"]["estado"] == "aprobado",
        "aprobacion": round(A["aprobacion"] * 100),
        "practicar": estados["practicar"],
        "evaluacion_pendiente": None if not pendiente else {
            "id": pendiente.id_sesion, "preguntas": [gen.para_estudiante(p) for p in _detalle(pendiente)["preguntas"]]},
        "generacion_disponible": llm.configurado(),
    }


@router.post("/plans/{plan_id}/aprender/leccion")
def explicar(plan_id: int, body: LeccionIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Explicación de un concepto en la lección guiada (CA2), con el control de material insuficiente (HU-003, CA5)."""
    obj = _objetivo(db, plan_id, est)
    tema = _tema(db, obj)
    if body.concepto not in _conceptos(tema):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Concepto no encontrado en este tema")
    propios = _propios(db, obj)
    guardada = _contenido(db, obj).get(body.concepto)
    # Se reutiliza la explicación guardada solo si se hizo con el mismo material propio: si el estudiante subió o
    # borró un archivo después, se vuelve a generar para que lo tenga en cuenta.
    if (guardada and guardada.get("version") == gen.VERSION_EXPLICACION and guardada.get("propios", []) == propios
            and (not guardada.get("no_respaldada") or body.general)):
        return {"concepto": body.concepto, **guardada}
    fragmentos = None
    if not body.general:
        r = _fragmentos(obj, body.concepto, propios)
        if not r["suficiente"]:
            return {"concepto": body.concepto, "insuficiente": True}
        fragmentos = r["fragmentos"]
    _requiere_modelo()
    try:
        explicacion = gen.explicar_concepto(tema.nombre, body.concepto, obj.nivel_inicial, obj.lenguaje, fragmentos,
                                            plan=_conceptos(tema))
    except llm.ModeloNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)
    explicacion["propios"] = propios
    s = _sesion_del_dia(db, obj, LECCION)
    d = _detalle(s)
    d.setdefault("contenido", {})[body.concepto] = explicacion
    _guardar(s, d)
    db.add(s)
    db.commit()
    return {"concepto": body.concepto, **explicacion}


@router.post("/plans/{plan_id}/aprender/leccion/comprobacion")
def comprobar(plan_id: int, body: ComprobacionIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Respuesta a la pregunta de comprobación: completa la explicación del concepto, que queda recorrido (CA1)."""
    obj = _objetivo(db, plan_id, est)
    explicacion = _contenido(db, obj).get(body.concepto)
    if not explicacion:
        raise HTTPException(status.HTTP_409_CONFLICT, "Primero hay que ver la explicación del concepto")
    p = explicacion["pregunta"]
    s = _sesion_del_dia(db, obj, LECCION)
    _marcar_paso(s, body.concepto, "leccion")
    _marcar_recorridos(db, obj, s, {body.concepto})
    db.commit()
    tema = _tema(db, obj)
    recorridos = _recorridos(db, obj)
    return {"correcta": body.respuesta == p["correcta"], "indice_correcto": p["correcta"], "porque": p["porque"],
            "todos_recorridos": set(_conceptos(tema)) <= recorridos}


@router.post("/plans/{plan_id}/aprender/consulta")
def consultar(plan_id: int, body: ConsultaIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Consulta libre en la lección guiada (CA2). No se incorpora a la evaluación (CA5)."""
    obj = _objetivo(db, plan_id, est)
    tema = _tema(db, obj)
    concepto = body.concepto if body.concepto in _conceptos(tema) else None
    fragmentos = None
    if not body.general:
        propios = _propios(db, obj)
        r = _fragmentos(obj, body.consulta, propios)
        if not r["suficiente"] and llm.configurado():
            # Consulta breve o informal: se busca de nuevo con una versión completa de la pregunta (HU-003, CA5).
            reformulada = gen.reformular_consulta(tema.nombre, body.consulta, concepto)
            if reformulada:
                log.info("Consulta reformulada para la búsqueda: %r -> %r", body.consulta, reformulada)
                r = _fragmentos(obj, reformulada, propios)
        if not r["suficiente"]:
            return {"insuficiente": True}
        fragmentos = r["fragmentos"]
    _requiere_modelo()
    try:
        return gen.responder_consulta(tema.nombre, body.consulta, obj.nivel_inicial, obj.lenguaje, fragmentos, concepto,
                                    _conceptos(tema))
    except llm.ModeloNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)


@router.post("/plans/{plan_id}/aprender/practica")
def generar_practica(plan_id: int, body: PracticaIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Tarjetas de memoria o cuestionario de práctica sobre los conceptos elegidos, sin calificar (CA3)."""
    if body.modo not in ("tarjetas", "cuestionario"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Modo inválido")
    obj = _objetivo(db, plan_id, est)
    tema = _tema(db, obj)
    del_tema = _conceptos(tema)
    conceptos = [c for c in del_tema if c in (body.conceptos or del_tema)]  # en el orden del plan
    if not conceptos:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Elegí al menos un concepto del tema")
    por_concepto = _por_concepto(obj, tema, conceptos, _propios(db, obj))
    _requiere_modelo()
    try:
        return {"items": gen.practica(body.modo, tema.nombre, conceptos, obj.nivel_inicial, obj.lenguaje, por_concepto)}
    except llm.ModeloNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)


@router.post("/plans/{plan_id}/aprender/resumen")
def resumir(plan_id: int, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Resumen breve de los conceptos recorridos (o de todos, si no se recorrió ninguno). No se califica."""
    obj = _objetivo(db, plan_id, est)
    tema = _tema(db, obj)
    recorridos = _recorridos(db, obj)
    conceptos = [c for c in _conceptos(tema) if c in recorridos] or _conceptos(tema)
    por_concepto = _por_concepto(obj, tema, conceptos, _propios(db, obj))
    _requiere_modelo()
    try:
        return {"conceptos": conceptos, **gen.resumen_tema(tema.nombre, conceptos, obj.nivel_inicial, obj.lenguaje, por_concepto)}
    except llm.ModeloNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)


@router.get("/plans/{plan_id}/aprender/repeticion")
def ver_repeticion(plan_id: int, concepto: str | None = None, est: Estudiante = Depends(current_user),
                   db: Session = Depends(get_session)):
    """Tarjetas y preguntas falladas, para volver a presentarlas hasta responderlas bien (CA4); opcionalmente,
    solo las de un concepto (el repaso que cierra su secuencia)."""
    items = _falladas(db, _objetivo(db, plan_id, est))
    return {"items": [it for it in items if not concepto or it["concepto"] == concepto]}


@router.post("/plans/{plan_id}/aprender/practica/resultado")
def registrar_practica(plan_id: int, body: ResultadoPracticaIn, est: Estudiante = Depends(current_user),
                       db: Session = Depends(get_session)):
    """Resultados de una ronda de práctica o repetición. Un concepto queda recorrido cuando se respondieron todas
    sus tarjetas o preguntas (CA1); las falladas pasan a la repetición, y en la repetición salen al responderlas bien."""
    if body.modo not in MODOS_PRACTICA:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Modo inválido")
    obj = _objetivo(db, plan_id, est)
    conceptos = set(_conceptos(_tema(db, obj)))
    s = _sesion_del_dia(db, obj, MODOS_PRACTICA[body.modo])
    d = _detalle(s)
    items = [(r.item, r.correcta) for r in body.resultados if r.item.get("id") and r.item.get("concepto") in conceptos]
    if body.modo == "repeticion":
        d["resueltas"] = sorted(set(d.get("resueltas", [])) | {it["id"] for it, ok in items if ok})
    else:
        previas = {it["id"] for it in d.get("falladas", [])}
        d["falladas"] = d.get("falladas", []) + [it for it, ok in items if not ok and it["id"] not in previas]
    _guardar(s, d)
    db.add(s)
    db.flush()
    if body.modo != "repeticion":
        for c in {it["concepto"] for it, _ in items}:
            _marcar_paso(s, c, body.modo)
        _marcar_recorridos(db, obj, s, {it["concepto"] for it, _ in items})
    db.commit()
    return {"repeticion": len(_falladas(db, obj)), "recorridos": sorted(_recorridos(db, obj))}


@router.post("/plans/{plan_id}/aprender/evaluacion")
def iniciar_evaluacion(plan_id: int, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Evaluación de comprensión (CA5 y CA6): cinco preguntas nuevas, sin la clave, que queda en el servidor.
    Se puede rendir en cualquier momento, también sin recorrer los conceptos (evaluación anticipada)."""
    obj = _objetivo(db, plan_id, est)
    hechas, pendiente = _evaluaciones(db, obj)
    if pendiente:  # recargar la página no genera otra
        return {"id": pendiente.id_sesion, "preguntas": [gen.para_estudiante(p) for p in _detalle(pendiente)["preguntas"]]}
    tema = _tema(db, obj)
    conceptos = _conceptos(tema)
    por_concepto = _por_concepto(obj, tema, conceptos, _propios(db, obj))
    evitar = [p["enunciado"] for s in hechas for p in _detalle(s)["preguntas"]]
    _requiere_modelo()
    try:
        preguntas = gen.generar_evaluacion(tema.nombre, conceptos, obj.nivel_inicial, obj.lenguaje, por_concepto, evitar)
    except llm.ModeloNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)
    _, otra = _evaluaciones(db, obj)  # otro pedido simultáneo pudo haberla creado mientras se generaba
    if otra:
        return {"id": otra.id_sesion, "preguntas": [gen.para_estudiante(p) for p in _detalle(otra)["preguntas"]]}
    s = SesionEstudio(id_objetivo=obj.id_objetivo, modulo="aprender", modo=EVALUACION)
    _guardar(s, {"preguntas": preguntas})
    db.add(s)
    db.commit()
    return {"id": s.id_sesion, "preguntas": [gen.para_estudiante(p) for p in preguntas]}


@router.post("/plans/{plan_id}/aprender/evaluacion/{id_sesion}")
def entregar_evaluacion(plan_id: int, id_sesion: int, body: RespuestasIn, est: Estudiante = Depends(current_user),
                        db: Session = Depends(get_session)):
    """Corrección (CA8) y resultado (CA9): con 3 de 5 se aprueba Aprender y se habilita Practicar; si no, se muestran
    las respuestas incorrectas y los conceptos para repasar. Se conserva el mejor resultado (CA10)."""
    obj = _objetivo(db, plan_id, est)
    s = db.get(SesionEstudio, id_sesion)
    if not s or s.id_objetivo != obj.id_objetivo or s.modo != EVALUACION:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluación no encontrada")
    d = _detalle(s)
    if s.resultado_evaluacion is not None:
        # Ya se corrigió (por ejemplo, se perdió la respuesta y se volvió a entregar): se devuelve el mismo resultado,
        # sin corregir de nuevo ni cambiar lo registrado.
        return _resultado_evaluacion(db, obj, d)
    tema = _tema(db, obj)
    aprobado_antes = _estado(db, obj)["aprender"]["estado"] == "aprobado"
    calificacion = gen.calificar(d["preguntas"], body.respuestas, tema.nombre)
    d["calificacion"] = calificacion
    _guardar(s, d)
    s.resultado_evaluacion = calificacion["porcentaje"]
    db.add(s)
    db.flush()
    if calificacion["aprobado"] and not aprobado_antes:
        _completar_actividad(obj, "aprender", "evaluación")
        db.add(obj)
    _registrar_dominio(db, obj)
    db.commit()
    return _resultado_evaluacion(db, obj, d)


def _resultados_para_dominio(db: Session, obj: ObjetivoEstudio) -> tuple:
    mejor, puntos, explicacion = _resultados(db, obj)
    return mejor, list(puntos.values()), explicacion


def _resultado_evaluacion(db: Session, obj: ObjetivoEstudio, d: dict) -> dict:
    return {**d["calificacion"], "preguntas": d["preguntas"], "composicion": _composicion(d["preguntas"]),
            "dominio": nivel_dominio(*_resultados_para_dominio(db, obj)),
            "mejor_evaluacion": max(x.resultado_evaluacion for x in _evaluaciones(db, obj)[0]),
            "practicar": _estado(db, obj)["practicar"]}
