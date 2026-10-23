"""Esquemas de entrada/salida de la API (validación con Pydantic)."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_DAYS = 180


class GoogleLoginIn(BaseModel):
    access_token: str = Field(min_length=20)  # el que devuelve el popup de Google


LANGUAGES = Literal["python", "java", "c", "cpp", "javascript"]


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    picture: str | None
    # HU-001: sin objetivo de estudio va a la configuración (CA1); con objetivo, al panel (CA2).
    has_plan: bool = False
    preferred_language: LANGUAGES | None = None  # precompleta el lenguaje al armar un objetivo nuevo


class PreferenciasIn(BaseModel):
    preferred_language: LANGUAGES | None = None


class PlanIn(BaseModel):
    """Datos del objetivo de estudio (HU-002). Se guardan en objetivo_estudio; ver routers/plans.py."""
    topic: str = Field(min_length=2, max_length=120)  # nombre de uno de los temas cargados
    # Lenguaje de los ejemplos y ejercicios. "material": se toma del material de la cátedra (HU-002, CA4).
    language: Literal["python", "java", "c", "cpp", "javascript", "material"]
    start_date: date
    end_date: date
    weekdays: list[int] = Field(min_length=1, max_length=7)
    level: Literal["principiante", "intermedio", "avanzado"]
    target_grade: int = Field(ge=6, le=10)
    # No se pide al configurar (no forma parte de HU-002): estima la duración de cada sesión.
    minutes_per_session: Literal[20, 45, 60, 90] = 45

    @field_validator("weekdays")
    @classmethod
    def weekdays_validos(cls, v: list[int]) -> list[int]:
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("Los días van de 0 (lunes) a 6 (domingo)")
        return sorted(set(v))

    @field_validator("topic")
    @classmethod
    def sin_espacios_extra(cls, v: str) -> str:
        return " ".join(v.split())

    @model_validator(mode="after")
    def fechas_coherentes(self):
        if self.end_date < self.start_date:
            raise ValueError("La fecha límite no puede ser anterior al inicio")
        if (self.end_date - self.start_date).days > MAX_DAYS:
            raise ValueError(f"El plan no puede durar más de {MAX_DAYS} días")
        return self


class SessionOut(BaseModel):
    position: int
    day: date
    module: str
    minutes: int
    status: str = "pendiente"


class PreviewOut(BaseModel):
    required_mastery: int
    total_sessions: int
    total_minutes: int
    by_module: dict[str, int]
    sessions: list[SessionOut]
    warning: str | None = None
