"""Tablas de la base de datos (SQLModel = SQLAlchemy + Pydantic)."""
from datetime import date, datetime, timezone

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    google_sub: str = Field(index=True, unique=True)  # id estable de Google, no el mail
    email: str
    name: str
    picture: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    last_login: datetime = Field(default_factory=utcnow)


class StudyPlan(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    subject: str
    topic: str
    language: str = "python"  # o "material": se toma del material cuando se procese (HU-003)
    goal: str  # "examen" | "aprender"
    start_date: date
    end_date: date
    weekdays: str  # "0,2,4" (0 = lunes)
    minutes_per_session: int
    preferred_time: str  # "manana" | "tarde" | "noche"
    level: str  # nivel inicial: "principiante" | "intermedio" | "avanzado"
    target_grade: int = 8  # nota objetivo, de 6 a 10
    required_mastery: int = 80  # dominio requerido por la nota: 60, 80 o 90 %
    learn_format: str  # "resumen" | "preguntas" | "ejercicio" | "variar"
    hint_level: str  # "minimas" | "normales"
    mastery: int = 0  # 0..100
    points: int = 0
    status: str = "activo"
    created_at: datetime = Field(default_factory=utcnow)


class StudySession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    plan_id: int = Field(foreign_key="studyplan.id", index=True)
    position: int
    day: date
    module: str  # "aprender" | "practicar" | "consolidar"
    minutes: int
    status: str = "pendiente"  # "pendiente" | "hecha"


class Material(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    plan_id: int = Field(foreign_key="studyplan.id", index=True)
    filename: str
    stored_path: str
    size_bytes: int
    status: str = "subido"  # luego: "procesando" | "indexado" (pipeline RAG)
    uploaded_at: datetime = Field(default_factory=utcnow)
