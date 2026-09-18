from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session, select

from ..config import settings
from ..db import get_session
from ..models import Material, StudyPlan, StudySession, User
from ..schemas import PlanIn, PreviewOut, SessionOut
from ..security import current_user
from ..services.planner import MODULES, NotEnoughSessions, build_plan

router = APIRouter(tags=["planes"])
ALLOWED_EXT = {".pdf", ".md", ".txt", ".docx", ".py"}


def _plan_or_404(db: Session, plan_id: int, user: User) -> StudyPlan:
    plan = db.get(StudyPlan, plan_id)
    if not plan or plan.user_id != user.id:  # nunca revelar planes ajenos
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan no encontrado")
    return plan


def _preview(body: PlanIn) -> PreviewOut:
    try:
        planned = build_plan(body.start_date, body.end_date, body.weekdays, body.minutes_per_session, body.level)
    except NotEnoughSessions as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    by_module = {m: sum(1 for s in planned if s.module == m) for m in MODULES}
    warning = None
    if body.goal == "examen" and len(planned) < 6:
        warning = "Quedan pocas sesiones antes del examen: conviene sumar días si podés."
    return PreviewOut(
        total_sessions=len(planned),
        total_minutes=sum(s.minutes for s in planned),
        by_module=by_module,
        sessions=[SessionOut(**s.__dict__) for s in planned],
        warning=warning,
    )


@router.post("/plans/preview", response_model=PreviewOut)
def preview_plan(body: PlanIn, user: User = Depends(current_user)):
    return _preview(body)


@router.post("/plans", status_code=201)
def create_plan(body: PlanIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    preview = _preview(body)
    data = body.model_dump()
    data["weekdays"] = ",".join(map(str, body.weekdays))
    plan = StudyPlan(user_id=user.id, **data)
    db.add(plan)
    db.flush()  # obtiene plan.id sin cerrar la transacción
    for s in preview.sessions:
        db.add(StudySession(plan_id=plan.id, **s.model_dump()))
    db.commit()
    return {"id": plan.id, "total_sessions": preview.total_sessions}


@router.get("/plans")
def list_plans(user: User = Depends(current_user), db: Session = Depends(get_session)):
    return db.exec(select(StudyPlan).where(StudyPlan.user_id == user.id).order_by(StudyPlan.created_at.desc())).all()


@router.post("/plans/{plan_id}/materials", status_code=201)
async def upload_material(
    plan_id: int,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_session),
):
    plan = _plan_or_404(db, plan_id, user)
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Formato no admitido: {ext or 'sin extensión'}")
    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Máximo {settings.max_upload_mb} MB")
    folder = Path(settings.upload_dir) / str(plan.id)
    folder.mkdir(parents=True, exist_ok=True)
    stored = folder / f"{uuid4().hex}{ext}"  # nombre aleatorio: evita path traversal
    stored.write_bytes(content)
    material = Material(plan_id=plan.id, filename=Path(file.filename).name, stored_path=str(stored), size_bytes=len(content))
    db.add(material)
    db.commit()
    db.refresh(material)
    return {"id": material.id, "filename": material.filename, "status": material.status}


@router.get("/materials")
def list_materials(user: User = Depends(current_user), db: Session = Depends(get_session)):
    """Material de todos los planes activos del usuario (pantalla Mi material)."""
    rows = db.exec(
        select(Material, StudyPlan)
        .join(StudyPlan, Material.plan_id == StudyPlan.id)
        .where(StudyPlan.user_id == user.id, StudyPlan.status == "activo")
        .order_by(Material.uploaded_at.desc())
    ).all()
    return [
        {"id": m.id, "filename": m.filename, "size_bytes": m.size_bytes, "status": m.status,
         "uploaded_at": m.uploaded_at, "plan_id": p.id, "topic": p.topic, "subject": p.subject}
        for m, p in rows
    ]


@router.get("/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_session)):
    """Todo lo que necesita la pantalla de inicio en una sola llamada."""
    today = date.today()
    plans = db.exec(
        select(StudyPlan).where(StudyPlan.user_id == user.id, StudyPlan.status == "activo").order_by(StudyPlan.created_at.desc())
    ).all()

    items = []
    for p in plans:
        sessions = db.exec(select(StudySession).where(StudySession.plan_id == p.id).order_by(StudySession.position)).all()
        done = sum(1 for s in sessions if s.status == "hecha")
        nxt = next((s for s in sessions if s.status == "pendiente"), None)
        materials = db.exec(select(Material).where(Material.plan_id == p.id)).all()
        items.append({
            "id": p.id, "subject": p.subject, "topic": p.topic, "goal": p.goal, "end_date": p.end_date,
            "start_date": p.start_date, "level": p.level, "minutes_per_session": p.minutes_per_session,
            "weekdays": [int(d) for d in p.weekdays.split(",")],
            "mastery": p.mastery, "points": p.points,
            "sessions_total": len(sessions), "sessions_done": done,
            "by_module": {m: {"total": sum(1 for s in sessions if s.module == m),
                              "done": sum(1 for s in sessions if s.module == m and s.status == "hecha")} for m in MODULES},
            "next_session": nxt.model_dump() if nxt else None,
            "materials": len(materials),
            "days_left": (p.end_date - today).days,
        })

    # semana actual (lunes a domingo): qué días tienen sesión planificada o hecha
    monday = today - timedelta(days=today.weekday())
    week = []
    plan_ids = [p.id for p in plans]
    week_sessions = db.exec(
        select(StudySession).where(StudySession.plan_id.in_(plan_ids), StudySession.day >= monday, StudySession.day <= monday + timedelta(days=6))
    ).all() if plan_ids else []
    for i in range(7):
        d = monday + timedelta(days=i)
        ss = [s for s in week_sessions if s.day == d]
        week.append({"day": d, "planned": len(ss), "done": sum(1 for s in ss if s.status == "hecha")})

    return {"user": {"name": user.name, "picture": user.picture}, "plans": items, "week": week, "today": today}
