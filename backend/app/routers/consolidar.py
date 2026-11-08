"""Módulo Consolidar (HU-008), según la Pantalla 4.

Se habilita al aprobar Aprender y Practicar (HU-011). Es una charla con Brity en dos fases:

1. Charla guiada: para cada concepto esperado, Brity plantea una pregunta disparadora sobre una situación concreta.
   Si la respuesta muestra el concepto, lo reconoce y pasa al siguiente; si no, formula una pregunta de
   seguimiento gradual (CA6), que queda en DIFICULTAD_DETECTADA (HU-009, CA2). Tras el máximo de preguntas por
   concepto, pasa al siguiente igual: se retoma en la explicación final.
2. Explicación final: el estudiante explica el tema en un párrafo, que se evalúa con los criterios de HU-008
   (CA2 a CA5) y se guarda en EXPLICACION. Si es incompleta o incorrecta, Brity formula una pregunta de
   seguimiento; la respuesta se suma al párrafo y se evalúa el texto completo. Con una explicación correcta, el
   módulo se aprueba. El resultado "no concluyente" no se computa en el nivel de dominio (CA5; HU-010).

La charla (preguntas, respuestas, devoluciones y fase) se guarda en SESION_ESTUDIO.detalle_consolidar, así se
retoma donde quedó.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..config import P
from ..db import get_session
from ..models import DificultadDetectada, Estudiante, Explicacion, ObjetivoEstudio, SesionEstudio
from ..security import current_user
from ..services import consolidar as gen
from ..services import llm
from .aprender import NO_DISPONIBLE, _conceptos, _tema
from .practicar import BLOQUEADO, _completar_actividad, _estado, _objetivo, _registrar_dominio

router = APIRouter(tags=["consolidar"])
C = P["consolidar"]
TIPO = {gen.INCOMPLETA: "explicación incompleta", gen.INCORRECTA: "explicación incorrecta"}
CHARLA, PARRAFO, TERMINADA = "charla", "párrafo", "terminada"
CONSIGNA = ("¡Muy bien! Ya recorrimos los conceptos clave del tema. Para cerrar, explicame en un párrafo, con tus "
            "palabras, lo que entendiste de {tema}: qué es, cómo funciona y qué hay que tener en cuenta.")
PASAR = "Lo retomamos al final, en tu explicación. Sigamos con otra situación."


class RespuestaIn(BaseModel):
    texto: str = Field(max_length=C["largo_maximo"])


def _sesion_con_charla(db: Session, obj: ObjetivoEstudio) -> SesionEstudio | None:
    """La sesión de Consolidar con la charla más reciente del tema."""
    return db.exec(select(SesionEstudio).where(SesionEstudio.id_objetivo == obj.id_objetivo,
                                               SesionEstudio.modulo == "consolidar",
                                               SesionEstudio.detalle_consolidar.is_not(None))
                   .order_by(SesionEstudio.fecha_hora_inicio.desc(), SesionEstudio.id_sesion.desc())).first()


def _brity(charla: dict, texto: str, tipo: str, **extra) -> None:
    charla["mensajes"].append({"de": "brity", "texto": texto, "tipo": tipo, **extra})


def _vista(charla: dict | None) -> dict | None:
    """Lo que ve el estudiante: sin los conceptos, para no señalar cuál falta (Pantalla 4)."""
    if not charla:
        return None
    total = len(charla["conceptos"])
    return {"fase": charla["fase"], "mensajes": charla["mensajes"], "total": total,
            "actual": min(charla["actual"], total)}


def _habilitado(db: Session, obj: ObjetivoEstudio) -> None:
    estado = _estado(db, obj)["consolidar"]
    if estado["estado"] == BLOQUEADO:  # HU-011, CA3: se informa qué falta
        raise HTTPException(status.HTTP_403_FORBIDDEN, estado["falta"])
    if not llm.configurado():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)


@router.get("/plans/{plan_id}/consolidar")
def ver_consolidar(plan_id: int, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Estado del módulo y la charla más reciente, si la hay."""
    obj = _objetivo(db, plan_id, est)
    estado = _estado(db, obj)["consolidar"]
    s = _sesion_con_charla(db, obj)
    return {
        "tema": _tema(db, obj).nombre, "modulo": estado, "aprobado": estado["estado"] == "aprobado",
        "charla": _vista(json.loads(s.detalle_consolidar)) if s else None,
        "generacion_disponible": llm.configurado(),
        "largo_minimo": C["largo_minimo"], "largo_maximo": C["largo_maximo"],
        "largo_maximo_respuesta": C["largo_maximo_respuesta"],
    }


@router.post("/plans/{plan_id}/consolidar/charla")
def empezar(plan_id: int, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Empieza una charla nueva: prepara una pregunta disparadora por concepto y plantea la primera (CA1)."""
    obj = _objetivo(db, plan_id, est)
    _habilitado(db, obj)
    tema = _tema(db, obj)
    conceptos = _conceptos(tema)
    preguntas = gen.disparadores(tema.nombre, conceptos, obj.lenguaje, obj.nivel_inicial)
    charla = {"conceptos": conceptos, "disparadores": preguntas, "actual": 0, "nivel": 0, "respuestas": [],
              "fase": CHARLA, "explicacion": None, "nivel_final": 0, "mensajes": []}
    _brity(charla, f"Vamos a repasar {tema.nombre} charlando: te planteo algunas situaciones y vos me contás, con "
                   "tus palabras, cómo las resolverías. Al final, me explicás el tema en un párrafo.", "inicio")
    _brity(charla, preguntas[0], "disparador")
    s = SesionEstudio(id_objetivo=obj.id_objetivo, modulo="consolidar",
                      detalle_consolidar=json.dumps(charla, ensure_ascii=False))
    db.add(s)
    db.commit()
    return _vista(charla)


@router.post("/plans/{plan_id}/consolidar/respuesta")
def responder(plan_id: int, body: RespuestaIn, est: Estudiante = Depends(current_user),
              db: Session = Depends(get_session)):
    """Recibe un mensaje del estudiante: una respuesta de la charla o la explicación final, según la fase."""
    obj = _objetivo(db, plan_id, est)
    _habilitado(db, obj)
    s = _sesion_con_charla(db, obj)
    charla = json.loads(s.detalle_consolidar) if s else None
    if not charla or charla["fase"] == TERMINADA:
        raise HTTPException(status.HTTP_409_CONFLICT, "Empezá una charla nueva para seguir.")
    texto = body.texto.strip()
    tema = _tema(db, obj).nombre
    try:
        if charla["fase"] == CHARLA:
            resultado = _respuesta_charla(db, s, obj, tema, charla, texto)
        else:
            resultado = _explicacion(db, s, obj, tema, charla, texto)
    except llm.ModeloNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)
    s.detalle_consolidar = json.dumps(charla, ensure_ascii=False)
    db.add(s)
    db.commit()
    return {"charla": _vista(charla), "aprobado": _estado(db, obj)["consolidar"]["estado"] == "aprobado", **resultado}


def _respuesta_charla(db: Session, s: SesionEstudio, obj: ObjetivoEstudio, tema: str, charla: dict, texto: str) -> dict:
    """Evalúa la respuesta sobre el concepto actual y avanza: reconoce, pregunta de nuevo o pasa al siguiente."""
    if len(texto) < C["largo_minimo_respuesta"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Escribí tu respuesta.")
    if len(texto) > C["largo_maximo_respuesta"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Tu respuesta es muy larga: resumila un poco.")
    concepto = charla["conceptos"][charla["actual"]]
    respuestas = charla["respuestas"] + [texto]  # las respuestas sobre un mismo concepto se evalúan juntas
    pregunta = next(m["texto"] for m in reversed(charla["mensajes"]) if m["de"] == "brity")
    r = gen.responder_charla(tema, concepto, pregunta, respuestas, charla["nivel"] + 1, obj.lenguaje,
                            obj.nivel_inicial)
    charla["mensajes"].append({"de": "yo", "texto": texto})
    if r["estado"] == gen.PRESENTE:
        _brity(charla, r["devolucion"], "bien")
        _siguiente(charla, tema)
    elif charla["nivel"] >= C["seguimientos_por_concepto"]:
        _brity(charla, PASAR, "pasar")  # ya respondió la última pregunta de seguimiento de este concepto
        _siguiente(charla, tema)
    else:
        charla["nivel"] += 1
        charla["respuestas"] = respuestas
        _brity(charla, r["devolucion"], "seguimiento")
        tipo = TIPO[gen.INCORRECTA if r["estado"] == gen.ERRONEO else gen.INCOMPLETA]
        db.add(DificultadDetectada(id_sesion=s.id_sesion, tipo_patron=tipo, intervencion_generada=r["devolucion"]))
    return {"estado": r["estado"]}


def _siguiente(charla: dict, tema: str) -> None:
    charla["actual"] += 1
    charla["nivel"], charla["respuestas"] = 0, []
    if charla["actual"] < len(charla["conceptos"]):
        _brity(charla, charla["disparadores"][charla["actual"]], "disparador")
    else:
        charla["fase"] = PARRAFO
        _brity(charla, CONSIGNA.format(tema=tema), "consigna")


def _explicacion(db: Session, s: SesionEstudio, obj: ObjetivoEstudio, tema: str, charla: dict, texto: str) -> dict:
    """Evalúa la explicación final (CA2 a CA5); una respuesta a la pregunta de seguimiento la completa (CA6)."""
    anterior = charla["explicacion"]
    if anterior is None:
        if len(texto) < C["largo_minimo"]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                f"Tu explicación es muy corta: escribí al menos {C['largo_minimo']} caracteres.")
        completo = texto
    else:
        if len(texto) < C["largo_minimo_respuesta"]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Escribí tu respuesta.")
        completo = f"{anterior}\n\n{texto}"
    conceptos = charla["conceptos"]
    r = gen.evaluar(tema, conceptos, completo)
    charla["mensajes"].append({"de": "yo", "texto": texto})
    charla["explicacion"] = completo
    db.add(Explicacion(id_sesion=s.id_sesion, texto=completo, resultado=r["resultado"]))
    # Pantalla 4: se informa cuántos conceptos están, sin señalar cuál falta.
    presentes = None if r["resultado"] == gen.NO_CONCLUYENTE else sum(c["estado"] == gen.PRESENTE for c in r["conceptos"])
    resultado = {"resultado": r["resultado"], "presentes": presentes, "total": len(conceptos)}
    pregunta = None
    if r["resultado"] in TIPO:
        charla["nivel_final"] += 1
        objetivo = gen.objetivo_del_seguimiento(r["conceptos"], r["resultado"])
        pregunta = gen.pregunta_seguimiento(tema, objetivo, r["resultado"], completo, charla["nivel_final"])
        db.add(DificultadDetectada(id_sesion=s.id_sesion, tipo_patron=TIPO[r["resultado"]],
                                   intervencion_generada=pregunta))
        _brity(charla, pregunta, "resultado", **resultado)
    elif r["resultado"] == gen.NO_CONCLUYENTE:
        _brity(charla, f"No pude evaluar bien tu explicación. Contame un poco más sobre {r['discrepancia']}.",
               "resultado", **resultado)
    else:
        charla["fase"] = TERMINADA
        _brity(charla, "¡Excelente! Tu explicación incluye todos los conceptos clave del tema. Ya podés finalizarlo.",
               "resultado", **resultado)
        _completar_actividad(obj, "consolidar", "evaluación")
        db.add(obj)
    dominio = _registrar_dominio(db, obj)  # "no concluyente" no se computa: se usa la última concluyente
    return {**resultado, "pregunta": pregunta, "dominio": dominio}
