"""Esquemas de entrada/salida de la API (validación con Pydantic)."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .config import P

O = P["objetivo"]
LANGUAGES = Literal["java", "python"]  # Alcances: los lenguajes admitidos en la demostración


class GoogleLoginIn(BaseModel):
    access_token: str = Field(min_length=20)  # el que devuelve el popup de Google


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    picture: str | None
    role: str = "estudiante"
    # HU-001: sin objetivo de estudio va a la configuración (CA1); con objetivo, al panel (CA2).
    has_plan: bool = False
    preferred_language: LANGUAGES | None = None  # precompleta el lenguaje al armar un objetivo nuevo


class PreferenciasIn(BaseModel):
    preferred_language: LANGUAGES | None = None


class PlanIn(BaseModel):
    """Datos del objetivo de estudio (HU-002). Se guardan en objetivo_estudio; ver routers/plans.py.

    Los días disponibles fuera de 1 a 14 (CA5) y por debajo del mínimo de la nota (CA6) los valida el
    planificador, para responder con el mensaje que pide cada criterio.
    """
    topic: str = Field(min_length=2, max_length=120)  # nombre de uno de los temas cargados
    days: int  # días disponibles
    level: Literal["principiante", "intermedio", "avanzado"]
    target_grade: int = Field(ge=O["nota_min"], le=O["nota_max"])
    language: LANGUAGES  # obligatorio: sin lenguaje no se puede continuar (CA4)

    @field_validator("topic")
    @classmethod
    def sin_espacios_extra(cls, v: str) -> str:
        return " ".join(v.split())


class ActivityOut(BaseModel):
    module: str
    type: str
    status: str


class SessionOut(BaseModel):
    """Un día del plan: con al menos 3 días, cada día corresponde a un solo módulo."""
    position: int
    day: date
    module: str
    activities: list[ActivityOut]
    status: str = "pendiente"


class PreviewOut(BaseModel):
    required_mastery: int
    min_days: int
    total_sessions: int
    by_module: dict[str, int]
    sessions: list[SessionOut]
    warning: str | None = None
