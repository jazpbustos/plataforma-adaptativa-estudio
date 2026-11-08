"""Módulo Practicar: ejercicios, intentos, detección de bloqueos e intervenciones (HU-005, 006, 007, 009 y 011).

Flujo de un ejercicio:
1. GET /plans/{id}/practicar devuelve el ejercicio en curso, o el siguiente según el nivel inicial.
2. Cada envío (POST …/intentos) se ejecuta en Judge0, se clasifica y se registra en INTENTO. Si corresponde,
   se genera la intervención (pista mínima o explicación elaborada) y se registra en DIFICULTAD_DETECTADA.
3. Cada 30 segundos sin envíos el frontend informa el tiempo activo (POST …/tiempo) y se evalúa la regla de
   tiempo, de modo que la señal se identifica sin necesidad de un nuevo intento (HU-006, CA3).
4. En la primera resolución correcta se asignan los puntos, se marca la actividad del plan y se recalcula el
   nivel de dominio del tema.
"""
import json
import logging
import random
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, func, select

from ..config import P, settings
from ..db import get_session
from ..models import (DificultadDetectada, Ejercicio, Estudiante, Explicacion, Intento, MaterialEstudio, NivelDominio,
                      ObjetivoEstudio, Punto, SesionEstudio, Tema)
from ..schemas import LANGUAGES
from ..security import current_user
from ..services import practica as reglas
from ..services.codigo import CORRECTO, clasificar, plantilla, programa
from ..services.ejecucion import EjecucionNoDisponible, ejecutor
from ..services import llm, pistas, rag
from ..services.planner import (dias_vencidos_con_pendientes, estado_del_dia, plan_a_json, plan_desde_json, reajustar,
                                required_mastery, vigente)
from ..services.progreso import BLOQUEADO, estado_modulos, nivel_dominio

log = logging.getLogger(__name__)
router = APIRouter(tags=["practicar"])
REQUERIDOS = P["practicar"]["ejercicios_para_aprobar"]


class IntentoIn(BaseModel):
    id_ejercicio: int
    lenguaje: LANGUAGES
    codigo: str = Field(max_length=20_000)
    tiempo_activo: float = Field(default=0, ge=0)  # segundos, medidos por el frontend


class TiempoIn(BaseModel):
    id_ejercicio: int
    tiempo_activo: float = Field(ge=0)


# ---------------- Lectura del estado del tema ----------------

def _objetivo(db: Session, plan_id: int, est: Estudiante) -> ObjetivoEstudio:
    obj = db.get(ObjetivoEstudio, plan_id)
    if not obj or obj.id_estudiante != est.id_estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan no encontrado")
    return obj


def _sesiones(db: Session, obj: ObjetivoEstudio, modulo: str | None = None):
    q = select(SesionEstudio.id_sesion).where(SesionEstudio.id_objetivo == obj.id_objetivo)
    return q.where(SesionEstudio.modulo == modulo) if modulo else q


def _puntos_por_ejercicio(db: Session, obj: ObjetivoEstudio) -> dict[int, int]:
    filas = db.exec(select(Punto).where(Punto.id_sesion.in_(_sesiones(db, obj)))).all()
    return {p.id_ejercicio: p.cantidad for p in filas}


def _resultados(db: Session, obj: ObjetivoEstudio) -> tuple[float | None, dict[int, int], str | None]:
    """Mejor evaluación de Aprender, puntos por ejercicio resuelto y última explicación concluyente."""
    mejor = db.exec(select(func.max(SesionEstudio.resultado_evaluacion)).where(
        SesionEstudio.id_objetivo == obj.id_objetivo, SesionEstudio.modulo == "aprender")).one()
    explicacion = db.exec(select(Explicacion.resultado).where(
        Explicacion.id_sesion.in_(_sesiones(db, obj, "consolidar")), Explicacion.resultado != "no concluyente")
        .order_by(Explicacion.fecha_hora.desc(), Explicacion.id_explicacion.desc())).first()
    return mejor, _puntos_por_ejercicio(db, obj), explicacion


def _estado(db: Session, obj: ObjetivoEstudio) -> dict:
    mejor, puntos, explicacion = _resultados(db, obj)
    estados = estado_modulos(mejor, len(puntos), explicacion)
    if settings.desbloquear_modulos:  # solo desarrollo: permite probar Practicar y Consolidar sin aprobar los anteriores
        for modulo in ("practicar", "consolidar"):
            if estados[modulo]["estado"] == BLOQUEADO:
                estados[modulo] = {"estado": "habilitado", "falta": None}
    return estados


def _intentos(db: Session, obj: ObjetivoEstudio, id_ejercicio: int) -> list[Intento]:
    return list(db.exec(select(Intento).where(Intento.id_ejercicio == id_ejercicio,
                                              Intento.id_sesion.in_(_sesiones(db, obj, "practicar")))
                        .order_by(Intento.fecha_hora, Intento.id_intento)).all())


def _dificultades(db: Session, intentos: list[Intento]) -> list[DificultadDetectada]:
    ids = [i.id_intento for i in intentos]
    if not ids:
        return []
    return list(db.exec(select(DificultadDetectada).where(DificultadDetectada.id_intento.in_(ids))
                        .order_by(DificultadDetectada.fecha_hora, DificultadDetectada.id_dificultad)).all())


def _a_reglas(intentos: list[Intento], dificultades: list[DificultadDetectada]):
    posicion = {i.id_intento: n for n, i in enumerate(intentos)}
    return ([reglas.Intento(i.codigo, i.resultado, i.tipo_error) for i in intentos],
            [reglas.Intervencion(d.nivel_intervencion, d.tipo_patron, posicion[d.id_intento]) for d in dificultades])


def _ejercicio_en_curso(db: Session, obj: ObjetivoEstudio, resueltos: set[int]) -> tuple[Ejercicio, bool]:
    """El ejercicio con intentos pendientes de resolver o, si no hay, el siguiente según el nivel inicial.

    La elección al azar usa una semilla fija por objetivo y cantidad de resueltos: recargar la página
    presenta el mismo ejercicio hasta resolverlo, y cada nuevo ejercicio es distinto.
    """
    ultimo = db.exec(select(Intento).where(Intento.id_sesion.in_(_sesiones(db, obj, "practicar")))
                     .order_by(Intento.fecha_hora.desc(), Intento.id_intento.desc())).first()
    if ultimo and ultimo.id_ejercicio not in resueltos:
        return db.get(Ejercicio, ultimo.id_ejercicio), False
    banco = db.exec(select(Ejercicio).where(Ejercicio.id_tema == obj.id_tema).order_by(Ejercicio.id_ejercicio)).all()
    if not banco:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Este tema todavía no tiene ejercicios cargados.")
    elegido = reglas.siguiente_ejercicio([(e.id_ejercicio, e.dificultad) for e in banco], resueltos, obj.nivel_inicial,
                                         random.Random(obj.id_objetivo * 1000 + len(resueltos)))
    return db.get(Ejercicio, elegido[0]), elegido[1]


def _titulo_y_texto(ej: Ejercicio) -> tuple[str, str]:
    titulo, _, texto = ej.enunciado.partition("\n\n")
    return titulo.removeprefix("# ").strip(), texto.strip()


def _vista_ejercicio(db: Session, obj: ObjetivoEstudio, ej: Ejercicio, es_repaso: bool, resueltos: set[int]) -> dict:
    espec = json.loads(ej.casos_prueba)
    intentos = _intentos(db, obj, ej.id_ejercicio)
    dificultades = _dificultades(db, intentos)
    _, intervenciones = _a_reglas(intentos, dificultades)
    titulo, texto = _titulo_y_texto(ej)
    ya_resuelto = ej.id_ejercicio in resueltos
    return {
        "id": ej.id_ejercicio, "titulo": titulo, "enunciado": texto, "dificultad": ej.dificultad,
        "tiempo_esperado": ej.tiempo_esperado, "es_repaso": es_repaso, "ya_resuelto": ya_resuelto,
        "posicion": min(len(resueltos) + (0 if ya_resuelto else 1), REQUERIDOS) if len(resueltos) < REQUERIDOS else None,
        "plantillas": {l: plantilla(espec, l) for l in ("java", "python")},
        "ejemplos": espec["casos"][:2],
        # El lenguaje se puede cambiar solo antes de iniciar el ejercicio (HU-005, CA3).
        "lenguaje_fijo": intentos[0].lenguaje if intentos else None,
        "codigo": intentos[-1].codigo if intentos else None,
        "intentos": [{"n": n, "resultado": i.resultado, "tipo_error": i.tipo_error} for n, i in enumerate(intentos, 1)],
        "intervenciones": [_vista_intervencion(d, [i for i in intentos if i.id_intento <= d.id_intento])
                           for d in dificultades],
        "puntos_posibles": 0 if ya_resuelto else reglas.puntos(intervenciones),
    }


@router.get("/plans/{plan_id}/practicar")
def ver_practicar(plan_id: int, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    obj = _objetivo(db, plan_id, est)
    tema = db.get(Tema, obj.id_tema)
    estados = _estado(db, obj)
    puntos = _puntos_por_ejercicio(db, obj)
    resumen = {"tema": tema.nombre, "lenguaje": obj.lenguaje, "modulo": estados["practicar"],
               "resueltos": len(puntos), "requeridos": REQUERIDOS, "puntos": sum(puntos.values()),
               "aprobado": reglas.practicar_aprobado(len(puntos)), "consolidar": estados["consolidar"]}
    if estados["practicar"]["estado"] == BLOQUEADO:
        return {**resumen, "ejercicio": None}  # HU-011, CA3: se informa la condición que falta
    ej, repaso = _ejercicio_en_curso(db, obj, set(puntos))
    return {**resumen, "ejercicio": _vista_ejercicio(db, obj, ej, repaso, set(puntos))}


# ---------------- Registro ----------------

def _sesion_practicar(db: Session, obj: ObjetivoEstudio) -> SesionEstudio:
    """La sesión de Practicar de hoy; si no hay, se abre una (HU-009, CA1)."""
    hoy = datetime.now(timezone.utc).date()
    for s in db.exec(select(SesionEstudio).where(SesionEstudio.id_objetivo == obj.id_objetivo,
                                                 SesionEstudio.modulo == "practicar")
                     .order_by(SesionEstudio.fecha_hora_inicio.desc())).all():
        inicio = s.fecha_hora_inicio if s.fecha_hora_inicio.tzinfo else s.fecha_hora_inicio.replace(tzinfo=timezone.utc)
        if inicio.date() == hoy:
            return s
        break
    s = SesionEstudio(id_objetivo=obj.id_objetivo, modulo="practicar")
    db.add(s)
    db.flush()
    return s


def _completar_actividad(obj: ObjetivoEstudio, modulo: str, tipo: str) -> None:
    """Marca como completada la primera actividad pendiente de ese módulo y tipo en la versión vigente del plan.

    Si no queda ninguna de ese tipo, completa una de refuerzo del mismo módulo. Si la actividad era del día
    siguiente y el de hoy ya estaba completo, el estudiante se adelantó: el plan se reajusta y las actividades
    restantes se corren un día (HU-010, CA4)."""
    versiones = plan_desde_json(obj.plan_estudio)
    dias = vigente(versiones)["dias"]
    for t in (tipo, "refuerzo"):
        for i, dia in enumerate(dias):
            for a in dia["actividades"]:
                if a["modulo"] == modulo and a["tipo"] == t and a["estado"] == "pendiente":
                    a["estado"] = "completada"
                    hoy = date.today()
                    adelanto = (i > 0 and date.fromisoformat(dia["fecha"]) > hoy and date.fromisoformat(dias[i - 1]["fecha"]) == hoy
                                and all(estado_del_dia(d) != "pendiente" for d in dias[:i]))
                    if adelanto:
                        reajustar(versiones, hoy, _fin(obj, versiones), "reajuste: adelanto", adelantar=True)
                    obj.plan_estudio = plan_a_json(versiones)
                    return


def _fin(obj: ObjetivoEstudio, versiones: list[dict]) -> date:
    """Último día disponible del objetivo: el primero del plan inicial más los días disponibles."""
    return date.fromisoformat(versiones[0]["dias"][0]["fecha"]) + timedelta(days=obj.dias_disponibles - 1)


def _modulo_de_refuerzo(estados: dict) -> str:
    """El refuerzo va al primer módulo sin aprobar que ya está habilitado (en el orden pedagógico)."""
    for m in ("aprender", "practicar", "consolidar"):
        if estados[m]["estado"] == "habilitado":
            return m
    return "practicar"


def revisar_plan(db: Session, obj: ObjetivoEstudio) -> bool:
    """HU-010, CA3: si venció un día con actividades pendientes y el dominio no llega al requerido, reprograma lo
    pendiente desde hoy dentro de los días disponibles y suma refuerzo. Se ejecuta al consultar el panel."""
    versiones = plan_desde_json(obj.plan_estudio)
    hoy = date.today()
    if not dias_vencidos_con_pendientes(vigente(versiones), hoy):
        return False
    mejor, puntos, explicacion = _resultados(db, obj)
    if nivel_dominio(mejor, list(puntos.values()), explicacion) >= required_mastery(obj.nota_objetivo):
        return False
    if not reajustar(versiones, hoy, _fin(obj, versiones), "reajuste: actividades pendientes", _modulo_de_refuerzo(_estado(db, obj))):
        return False  # no quedan días: el estudiante puede extender el plan
    obj.plan_estudio = plan_a_json(versiones)
    db.add(obj)
    return True


def _registrar_dominio(db: Session, obj: ObjetivoEstudio) -> float:
    mejor, puntos, explicacion = _resultados(db, obj)
    porcentaje = nivel_dominio(mejor, list(puntos.values()), explicacion)
    db.add(NivelDominio(id_objetivo=obj.id_objetivo, porcentaje=porcentaje))
    return porcentaje


def _ejercicio_del_tema(db: Session, obj: ObjetivoEstudio, id_ejercicio: int) -> Ejercicio:
    ej = db.get(Ejercicio, id_ejercicio)
    if not ej or ej.id_tema != obj.id_tema:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ejercicio no encontrado en este tema")
    return ej


def _verificar_habilitado(db: Session, obj: ObjetivoEstudio) -> None:
    modulo = _estado(db, obj)["practicar"]
    if modulo["estado"] == BLOQUEADO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, modulo["falta"])


def _fragmentos(db: Session, obj: ObjetivoEstudio, consulta: str) -> list[dict]:
    """Fragmentos del tema (fuentes académicas y material del estudiante) para la explicación elaborada."""
    if not rag.listo():
        # Todavía se están cargando (recién arrancó el servidor): no se hace esperar al estudiante.
        log.info("Modelos del RAG aún sin cargar: explicación sin fragmentos del material")
        return []
    propios = db.exec(select(MaterialEstudio.id_material).where(MaterialEstudio.id_objetivo == obj.id_objetivo,
                                                               MaterialEstudio.estado == "procesado")).all()
    try:
        r = rag.recuperar(obj.id_tema, consulta, list(propios), obj.lenguaje)
    except Exception as e:  # sin fragmentos la explicación se genera igual, solo con el enunciado y el código
        log.warning("No se pudo recuperar material para la explicación: %s", e)
        return []
    return r["fragmentos"] if r["suficiente"] else []


def _intervenir(db: Session, obj: ObjetivoEstudio, ej: Ejercicio, espec: dict, intentos: list[Intento],
                tiempo_activo: float, mensaje: str | None = None, solo_tiempo: bool = False) -> DificultadDetectada | None:
    dificultades = _dificultades(db, intentos)
    r_intentos, r_intervenciones = _a_reglas(intentos, dificultades)
    decision = reglas.siguiente_intervencion(r_intentos, r_intervenciones, tiempo_activo, ej.tiempo_esperado)
    if not decision or (solo_tiempo and decision != (reglas.PISTA_MINIMA, reglas.TIEMPO_EXCEDIDO)):
        return None
    nivel, patron = decision
    # La intervención queda ligada al último intento fallido: el que originó la señal (por tiempo, el último).
    origen = next(i for i in reversed(intentos) if i.resultado != CORRECTO)
    titulo, texto = _titulo_y_texto(ej)
    if llm.configurado():
        # El intento queda guardado antes de esperar al modelo: así la base no queda tomada durante la espera.
        db.add(obj)
        db.commit()
    fragmentos = (_fragmentos(db, obj, pistas.consulta_material(espec, origen.tipo_error, titulo, texto))
                  if nivel == reglas.EXPLICACION_ELABORADA and llm.configurado() else None)
    generada = pistas.intervencion(nivel, espec, origen.tipo_error, titulo=titulo, enunciado=texto,
                                   lenguaje=origen.lenguaje, codigo=origen.codigo, mensaje=mensaje,
                                   fragmentos=fragmentos)
    d = DificultadDetectada(id_sesion=origen.id_sesion, id_intento=origen.id_intento, tipo_patron=patron,
                            nivel_intervencion=nivel, intervencion_generada=generada.texto)
    db.add(d)
    return d


def _vista_intervencion(d: DificultadDetectada | None, intentos: list[Intento]) -> dict | None:
    if not d:
        return None
    if d.tipo_patron == reglas.INTENTOS_REPETIDOS:
        cambios = max(reglas.lineas_cambiadas(a.codigo, b.codigo) for a, b in zip(intentos[-3:], intentos[-2:]))
        motivo = f"Mismo error en los últimos 3 intentos, con {cambios} {'línea modificada' if cambios == 1 else 'líneas modificadas'} entre ellos."
    elif d.tipo_patron == reglas.TIEMPO_EXCEDIDO:
        factor = f"{reglas.D['factor_tiempo']:g}".replace(".", ",")
        motivo = f"El tiempo en el ejercicio superó {factor} veces el esperado, con al menos un intento fallido."
    else:
        motivo = d.tipo_patron
    if d.nivel_intervencion == reglas.EXPLICACION_ELABORADA:
        motivo = "La dificultad sigue después de la pista."
    # Etiqueta visible del bloqueo: qué regla del detector disparó la intervención (HU-006).
    if d.nivel_intervencion == reglas.EXPLICACION_ELABORADA:
        etiqueta = "Bloqueo persistente · mismo error después de la pista"
    elif d.tipo_patron == reglas.TIEMPO_EXCEDIDO:
        etiqueta = "Posible bloqueo · tiempo excedido"
    else:
        etiqueta = "Posible bloqueo · intentos repetidos"
    return {"nivel": d.nivel_intervencion, "texto": d.intervencion_generada, "motivo": motivo, "etiqueta": etiqueta}


@router.post("/plans/{plan_id}/practicar/intentos")
def enviar_intento(plan_id: int, body: IntentoIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    obj = _objetivo(db, plan_id, est)
    _verificar_habilitado(db, obj)
    ej = _ejercicio_del_tema(db, obj, body.id_ejercicio)
    espec = json.loads(ej.casos_prueba)
    previos = _intentos(db, obj, ej.id_ejercicio)
    if previos and previos[0].lenguaje != body.lenguaje:
        raise HTTPException(status.HTTP_409_CONFLICT, "El lenguaje se puede cambiar recién en el próximo ejercicio.")
    try:
        ejec = ejecutor().ejecutar(body.lenguaje, programa(espec, body.lenguaje, body.codigo))
    except EjecucionNoDisponible:
        # No se registra el intento ni se computa en el detector (Diagrama de Arquitectura).
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "La ejecución del código no está disponible en este momento. Probá de nuevo en unos minutos.")
    c = clasificar(ejec, espec, body.lenguaje)
    sesion = _sesion_practicar(db, obj)
    intento = Intento(id_sesion=sesion.id_sesion, id_ejercicio=ej.id_ejercicio, lenguaje=body.lenguaje, codigo=body.codigo,
                      resultado=c.resultado, tipo_error=c.tipo_error)
    db.add(intento)
    db.flush()
    intentos = previos + [intento]

    # HU-007, CA3: si hubo una intervención en el intento anterior, se registra si el estudiante avanzó.
    pendientes = [d for d in _dificultades(db, previos) if d.hubo_avance_posterior is None]
    for d in pendientes:
        origen = next(i for i in previos if i.id_intento == d.id_intento)
        d.hubo_avance_posterior = reglas.hubo_avance(reglas.Intento(origen.codigo, origen.resultado, origen.tipo_error),
                                                     reglas.Intento(intento.codigo, intento.resultado, intento.tipo_error))
        db.add(d)

    puntos_obtenidos, intervencion, dominio = None, None, None
    if c.resultado == CORRECTO:
        ya = db.exec(select(Punto).where(Punto.id_ejercicio == ej.id_ejercicio,
                                         Punto.id_sesion.in_(_sesiones(db, obj)))).first()
        if not ya:  # solo la primera resolución correcta suma (HU-011, CA1)
            _, intervenciones = _a_reglas(intentos, _dificultades(db, intentos))
            puntos_obtenidos = reglas.puntos(intervenciones)
            ayuda = {10: "sin ayuda", 7: "con pista mínima", 4: "con explicación elaborada"}[puntos_obtenidos]
            db.add(Punto(id_sesion=sesion.id_sesion, id_ejercicio=ej.id_ejercicio, cantidad=puntos_obtenidos,
                         motivo=f"resuelto {ayuda}"))
            _completar_actividad(obj, "practicar", "ejercicio")
            db.flush()
            dominio = _registrar_dominio(db, obj)
    else:
        intervencion = _intervenir(db, obj, ej, espec, intentos, body.tiempo_activo, mensaje=c.mensaje)
    db.add(obj)
    db.commit()

    puntos = _puntos_por_ejercicio(db, obj)
    estados = _estado(db, obj)
    return {
        "intento": len(intentos), "resultado": c.resultado, "tipo_error": c.tipo_error, "mensaje": c.mensaje,
        "casos": c.casos, "intervencion": _vista_intervencion(intervencion, intentos),
        "puntos_obtenidos": puntos_obtenidos, "dominio": dominio,
        "resueltos": len(puntos), "aprobado": reglas.practicar_aprobado(len(puntos)), "consolidar": estados["consolidar"],
    }


@router.post("/plans/{plan_id}/practicar/tiempo")
def informar_tiempo(plan_id: int, body: TiempoIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Aviso periódico del tiempo activo (HU-006, CA3): evalúa la regla de tiempo sin esperar un nuevo intento."""
    obj = _objetivo(db, plan_id, est)
    _verificar_habilitado(db, obj)
    ej = _ejercicio_del_tema(db, obj, body.id_ejercicio)
    intentos = _intentos(db, obj, ej.id_ejercicio)
    d = _intervenir(db, obj, ej, json.loads(ej.casos_prueba), intentos, body.tiempo_activo, solo_tiempo=True)
    db.commit()
    return {"intervencion": _vista_intervencion(d, intentos)}


@router.delete("/plans/{plan_id}/practicar/ejercicios/{id_ejercicio}", status_code=status.HTTP_204_NO_CONTENT)
def reiniciar_ejercicio(plan_id: int, id_ejercicio: int, est: Estudiante = Depends(current_user),
                        db: Session = Depends(get_session)):
    """Solo para pruebas (DEV_LOGIN=true): borra los intentos, las intervenciones y los puntos de un ejercicio.

    En producción no existe: si el estudiante pudiera borrar sus intentos, podría repetir un ejercicio para
    sumar puntos sin ayuda y se perdería el registro de dificultades (HU-009).
    """
    if not settings.dev_login:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")
    obj = _objetivo(db, plan_id, est)
    ej = _ejercicio_del_tema(db, obj, id_ejercicio)
    intentos = _intentos(db, obj, ej.id_ejercicio)
    for d in _dificultades(db, intentos):
        db.delete(d)
    db.flush()
    for i in intentos:
        db.delete(i)
    for p in db.exec(select(Punto).where(Punto.id_ejercicio == ej.id_ejercicio, Punto.id_sesion.in_(_sesiones(db, obj)))).all():
        db.delete(p)
    db.commit()
