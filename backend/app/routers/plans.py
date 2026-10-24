"""Objetivos de estudio (HU-002), material (HU-003) y datos del panel.

La API mantiene los nombres que usa el front (plan, topic, sessions…) y los traduce a las
entidades del DER: objetivo_estudio, tema, material_estudio, nivel_dominio, sesion_estudio y punto.
"""
import logging
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session, func, select

from ..config import P, settings
from ..db import engine, get_session
from ..models import Estudiante, MaterialEstudio, NivelDominio, ObjetivoEstudio, Punto, SesionEstudio, Tema
from ..schemas import PlanIn, PreviewOut, SessionOut
from ..security import current_user
from ..services import rag
from ..services.planner import (MODULES, DiasInsuficientes, construir_dias, dia_completo, dias_minimos, modulo_del_dia,
                                plan_a_json, plan_desde_json, plan_inicial, required_mastery, vigente)

router = APIRouter(tags=["planes"])
log = logging.getLogger(__name__)
M = P["material"]
MB = 1024 * 1024
FORMATOS = set(M["formatos"])


def _objetivo_o_404(db: Session, id_objetivo: int, est: Estudiante) -> ObjetivoEstudio:
    obj = db.get(ObjetivoEstudio, id_objetivo)
    if not obj or obj.id_estudiante != est.id_estudiante:  # nunca revelar objetivos ajenos
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan no encontrado")
    return obj


def _tema_o_422(db: Session, nombre: str) -> Tema:
    tema = db.exec(select(Tema).where(Tema.nombre == nombre)).first()
    if not tema:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Ese tema no está dentro del alcance del prototipo.")
    return tema


def _sesiones(dias: list[dict]) -> list[SessionOut]:
    return [SessionOut(position=i, day=d["fecha"], module=modulo_del_dia(d),
                       activities=[{"module": a["modulo"], "type": a["tipo"], "status": a["estado"]} for a in d["actividades"]],
                       status="hecha" if dia_completo(d) else "pendiente")
            for i, d in enumerate(dias, 1)]


def _preview(body: PlanIn) -> PreviewOut:
    try:
        dias = construir_dias(date.today(), body.days, body.level, body.target_grade)
    except DiasInsuficientes as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e))
    sesiones = _sesiones(dias)
    return PreviewOut(
        required_mastery=required_mastery(body.target_grade),
        min_days=dias_minimos(body.target_grade),
        total_sessions=len(sesiones),
        by_module={m: sum(1 for s in sesiones if s.module == m) for m in MODULES},
        sessions=sesiones,
    )


@router.post("/plans/preview", response_model=PreviewOut)
def preview_plan(body: PlanIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    _tema_o_422(db, body.topic)
    return _preview(body)


@router.post("/plans", status_code=201)
def create_plan(body: PlanIn, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    tema = _tema_o_422(db, body.topic)
    # Se pueden estudiar varios temas a la vez, pero cada tema tiene un solo objetivo.
    repetido = db.exec(select(ObjetivoEstudio.id_objetivo).where(
        ObjetivoEstudio.id_estudiante == est.id_estudiante, ObjetivoEstudio.id_tema == tema.id_tema)).first()
    if repetido:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya estás estudiando este tema.")
    preview = _preview(body)
    obj = ObjetivoEstudio(
        id_estudiante=est.id_estudiante, id_tema=tema.id_tema, dias_disponibles=body.days,
        nivel_inicial=body.level, nota_objetivo=body.target_grade, lenguaje=body.language,
        plan_estudio=plan_a_json(plan_inicial(date.today(), body.days, body.level, body.target_grade)),
    )
    db.add(obj)
    db.flush()  # obtiene id_objetivo sin cerrar la transacción
    db.add(NivelDominio(id_objetivo=obj.id_objetivo, porcentaje=0))  # el dominio arranca en 0 %
    db.commit()
    return {"id": obj.id_objetivo, "total_sessions": preview.total_sessions}


@router.get("/plans")
def list_plans(est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    filas = db.exec(
        select(ObjetivoEstudio, Tema).join(Tema, ObjetivoEstudio.id_tema == Tema.id_tema)
        .where(ObjetivoEstudio.id_estudiante == est.id_estudiante).order_by(ObjetivoEstudio.fecha_creacion.desc())
    ).all()
    return [{"id": o.id_objetivo, "topic": t.nombre, "status": "activo"} for o, t in filas]


# ---------------- Material (HU-003) ----------------

def _rechazar(codigo: int, motivo: str):
    raise HTTPException(codigo, motivo)


@router.post("/plans/{plan_id}/materials", status_code=201)
async def upload_material(
    plan_id: int,
    tareas: BackgroundTasks,
    file: UploadFile = File(...),
    est: Estudiante = Depends(current_user),
    db: Session = Depends(get_session),
):
    """Valida y guarda un archivo; el texto se extrae e indexa después, en segundo plano (CA1 y CA2).

    Se rechaza, indicando el motivo, lo que no sea PDF, DOCX o PPTX (según su contenido, no solo la
    extensión), lo que supere 25 MB, el archivo número 21 de un tema y lo que exceda la cuota de 200 MB
    de material propio del estudiante. El tema sigue funcionando con las fuentes que ya tenía.
    """
    obj = _objetivo_o_404(db, plan_id, est)
    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    if ext not in FORMATOS:
        _rechazar(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                  f"Formato no admitido ({ext or 'sin extensión'}). Subí un archivo PDF, DOCX o PPTX.")
    content = await file.read(M["max_mb_por_archivo"] * MB + 1)
    if len(content) > M["max_mb_por_archivo"] * MB:
        _rechazar(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"El archivo supera los {M['max_mb_por_archivo']} MB.")
    if rag.tipo_real(content) != ext:
        _rechazar(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                  f"El contenido del archivo no corresponde a un {ext.upper()} válido.")
    en_el_tema = db.exec(select(func.count()).select_from(MaterialEstudio)
                         .where(MaterialEstudio.id_objetivo == obj.id_objetivo)).one()
    if en_el_tema >= M["max_archivos_por_tema"]:
        _rechazar(status.HTTP_409_CONFLICT, f"Ya cargaste {M['max_archivos_por_tema']} archivos en este tema, el máximo permitido.")
    usado = db.exec(select(func.coalesce(func.sum(MaterialEstudio.tamano_bytes), 0)).join(ObjetivoEstudio)
                    .where(ObjetivoEstudio.id_estudiante == est.id_estudiante)).one()
    if usado + len(content) > M["cuota_mb_por_estudiante"] * MB:
        libre = max(0, M["cuota_mb_por_estudiante"] * MB - usado) / MB
        _rechazar(status.HTTP_409_CONFLICT,
                  f"Superarías tu cuota de {M['cuota_mb_por_estudiante']} MB de material propio (te quedan {libre:.1f} MB).")

    folder = Path(settings.upload_dir) / str(obj.id_objetivo)
    folder.mkdir(parents=True, exist_ok=True)
    stored = folder / f"{uuid4().hex}.{ext}"  # nombre aleatorio: evita path traversal
    stored.write_bytes(content)
    mat = MaterialEstudio(id_objetivo=obj.id_objetivo, nombre_archivo=Path(file.filename).name, tipo_archivo=ext,
                          ruta_archivo=str(stored), tamano_bytes=len(content))
    db.add(mat)
    db.commit()
    db.refresh(mat)
    tareas.add_task(procesar_material, mat.id_material)  # se responde enseguida y se procesa después
    return {"id": mat.id_material, "filename": mat.nombre_archivo, "status": mat.estado}


def procesar_material(id_material: int) -> None:
    """Extrae, fragmenta e indexa un archivo subido.

    Estado final: "procesado"; "sin texto" si no se pudo extraer texto (un documento escaneado o una
    presentación solo con imágenes); o "con error" si el archivo está dañado.
    """
    with Session(engine) as db:
        mat = db.get(MaterialEstudio, id_material)
        obj = db.get(ObjetivoEstudio, mat.id_objetivo)
        try:
            secciones = rag.extraer(Path(mat.ruta_archivo), mat.tipo_archivo)
            n = rag.indexar(secciones, id_origen=mat.id_material, id_tema=obj.id_tema, fuente=rag.PROPIA,
                            nombre_archivo=mat.nombre_archivo, prefijo=f"mat{mat.id_material}")
            mat.estado = "procesado" if n else "sin texto"
        except Exception:
            log.exception("No se pudo procesar el material %s", id_material)
            mat.estado = "con error"
        db.add(mat)
        db.commit()


def _materiales_propios(db: Session, est: Estudiante, obj: ObjetivoEstudio) -> list[int]:
    return list(db.exec(select(MaterialEstudio.id_material).where(
        MaterialEstudio.id_objetivo == obj.id_objetivo, MaterialEstudio.estado == "procesado")).all())


@router.get("/plans/{plan_id}/search")
def search_material(plan_id: int, q: str, est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Fragmentos del tema más parecidos a la consulta (fuentes académicas y material propio), e indicación
    de si alcanzan para generar contenido (HU-003, CA5)."""
    obj = _objetivo_o_404(db, plan_id, est)
    return rag.recuperar(obj.id_tema, q, _materiales_propios(db, est, obj))


@router.get("/materials")
def list_materials(est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Material de todos los objetivos del estudiante (pantalla Mi material filtra por tema)."""
    filas = db.exec(
        select(MaterialEstudio, ObjetivoEstudio, Tema)
        .join(ObjetivoEstudio, MaterialEstudio.id_objetivo == ObjetivoEstudio.id_objetivo)
        .join(Tema, ObjetivoEstudio.id_tema == Tema.id_tema)
        .where(ObjetivoEstudio.id_estudiante == est.id_estudiante)
        .order_by(MaterialEstudio.fecha_carga.desc())
    ).all()
    return [
        {"id": m.id_material, "filename": m.nombre_archivo, "size_bytes": m.tamano_bytes, "status": m.estado,
         "uploaded_at": m.fecha_carga, "plan_id": o.id_objetivo, "topic": t.nombre}
        for m, o, t in filas
    ]


@router.get("/materials/limits")
def material_limits(est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Límites de carga y cuánto de la cuota ya usó el estudiante (los muestra Mi material)."""
    usado = db.exec(select(func.coalesce(func.sum(MaterialEstudio.tamano_bytes), 0)).join(ObjetivoEstudio)
                    .where(ObjetivoEstudio.id_estudiante == est.id_estudiante)).one()
    return {"formats": M["formatos"], "max_mb": M["max_mb_por_archivo"], "max_files_per_topic": M["max_archivos_por_tema"],
            "quota_mb": M["cuota_mb_por_estudiante"], "used_bytes": usado}


# ---------------- Panel ----------------

def _dominio(db: Session, id_objetivo: int) -> float:
    ultimo = db.exec(select(NivelDominio).where(NivelDominio.id_objetivo == id_objetivo)
                     .order_by(NivelDominio.fecha_actualizacion.desc(), NivelDominio.id_nivel.desc())).first()
    return ultimo.porcentaje if ultimo else 0


def _puntos(db: Session, id_objetivo: int) -> int:
    total = db.exec(select(func.sum(Punto.cantidad)).join(SesionEstudio, Punto.id_sesion == SesionEstudio.id_sesion)
                    .where(SesionEstudio.id_objetivo == id_objetivo)).one()
    return total or 0


@router.get("/dashboard")
def dashboard(est: Estudiante = Depends(current_user), db: Session = Depends(get_session)):
    """Todo lo que necesitan Inicio, Progreso y Mi material en una sola llamada."""
    today = date.today()
    filas = db.exec(
        select(ObjetivoEstudio, Tema).join(Tema, ObjetivoEstudio.id_tema == Tema.id_tema)
        .where(ObjetivoEstudio.id_estudiante == est.id_estudiante).order_by(ObjetivoEstudio.fecha_creacion.desc())
    ).all()

    items, planificadas = [], []
    for obj, tema in filas:
        versiones = plan_desde_json(obj.plan_estudio)
        version = vigente(versiones)
        plan = _sesiones(version["dias"])  # la versión vigente es la última (HU-012, CA4)
        planificadas += plan
        inicio = plan[0].day
        fin = inicio + timedelta(days=obj.dias_disponibles - 1)
        hechas = sum(1 for s in plan if s.status == "hecha")
        nxt = next((s for s in plan if s.status == "pendiente"), None)
        n_material = db.exec(select(func.count()).select_from(MaterialEstudio).where(MaterialEstudio.id_objetivo == obj.id_objetivo)).one()
        items.append({
            "id": obj.id_objetivo, "topic": tema.nombre, "area": tema.area,
            "start_date": inicio, "end_date": fin, "days_left": (fin - today).days,
            "level": obj.nivel_inicial, "target_grade": obj.nota_objetivo,
            "required_mastery": required_mastery(obj.nota_objetivo), "language": obj.lenguaje,
            "mastery": _dominio(db, obj.id_objetivo), "points": _puntos(db, obj.id_objetivo),
            "plan_version": version["numero"], "plan_readjusted": version["motivo"] != "inicial",
            "sessions_total": len(plan), "sessions_done": hechas,
            "by_module": {m: {"total": sum(1 for s in plan if s.module == m),
                              "done": sum(1 for s in plan if s.module == m and s.status == "hecha")} for m in MODULES},
            "next_session": {"position": nxt.position, "day": nxt.day, "module": nxt.module,
                             "activities": [a.model_dump() for a in nxt.activities]} if nxt else None,
            "materials": n_material,
        })

    # Semana actual (lunes a domingo) de todos los temas: qué días tienen actividad planificada o hecha.
    monday = today - timedelta(days=today.weekday())
    week = []
    for i in range(7):
        d = monday + timedelta(days=i)
        del_dia = [s for s in planificadas if s.day == d]
        week.append({"day": d, "planned": len(del_dia), "done": sum(1 for s in del_dia if s.status == "hecha")})

    return {"user": {"name": est.nombre, "picture": est.foto_url}, "plans": items, "week": week, "today": today}
