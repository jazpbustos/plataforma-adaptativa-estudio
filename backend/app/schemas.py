"""Esquemas de entrada/salida de la API (validación con Pydantic)."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_DAYS = 180


class GoogleLoginIn(BaseModel):
    credential: str = Field(min_length=20)


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    picture: str | None


class PlanIn(BaseModel):
    subject: str = Field(min_length=2, max_length=120)
    topic: str = Field(min_length=2, max_length=120)
    language: Literal["python"] = "python"
    goal: Literal["examen", "aprender"]
    start_date: date
    end_date: date
    weekdays: list[int] = Field(min_length=1, max_length=7)
    minutes_per_session: Literal[25, 45, 60, 90]
    preferred_time: Literal["manana", "tarde", "noche"]
    level: int = Field(ge=0, le=3)
    learn_format: Literal["resumen", "preguntas", "ejercicio", "variar"]
    hint_level: Literal["minimas", "normales"]

    @field_validator("weekdays")
    @classmethod
    def weekdays_validos(cls, v: list[int]) -> list[int]:
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("Los días van de 0 (lunes) a 6 (domingo)")
        return sorted(set(v))

    @field_validator("subject", "topic")
    @classmethod
    def sin_espacios_extra(cls, v: str) -> str:
        return " ".join(v.split())

    @model_validator(mode="after")
    def fechas_coherentes(self):
        if self.end_date <= self.start_date:
            raise ValueError("La fecha límite tiene que ser posterior al inicio")
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
    total_sessions: int
    total_minutes: int
    by_module: dict[str, int]
    sessions: list[SessionOut]
    warning: str | None = None
