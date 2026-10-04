"""Generador de la ruta de aprendizaje inicial.

Primera versión determinística: reparte las sesiones disponibles entre los tres
módulos respetando el orden pedagógico (Aprender → Practicar → Consolidar).
El recálculo adaptativo según el avance real se suma en un sprint posterior.
"""
from dataclasses import dataclass
from datetime import date, timedelta

MODULES = ("aprender", "practicar", "consolidar")
MIN_SESSIONS = 3

# Proporción de sesiones por módulo según el nivel inicial.
# Quien ya sabe más necesita menos teoría y más práctica/consolidación.
WEIGHTS = {
    "principiante": (0.48, 0.36, 0.16),
    "intermedio": (0.36, 0.44, 0.20),
    "avanzado": (0.24, 0.50, 0.26),
}


def required_mastery(grade: int) -> int:
    """Dominio requerido según la nota objetivo (HU-002, CA2): 60 % para 6 o 7, 80 % para 8 o 9 y 90 % para 10."""
    if not 6 <= grade <= 10:
        raise ValueError("La nota objetivo va de 6 a 10")
    return 60 if grade <= 7 else 80 if grade <= 9 else 90


def weights_for(level: str, mastery: int) -> tuple[float, float, float]:
    """Una nota más alta exige más dominio: se pasa parte de Aprender a Practicar y Consolidar.
    Con 60 % no cambia; con 80 %, 4 puntos; con 90 %, 8 puntos (dos tercios a Practicar)."""
    a, p, c = WEIGHTS[level]
    shift = {60: 0.0, 80: 0.04, 90: 0.08}[mastery]
    return (a - shift, p + shift * 2 / 3, c + shift / 3)


class NotEnoughSessions(ValueError):
    pass


@dataclass
class PlannedSession:
    position: int
    day: date
    module: str
    minutes: int


def available_days(start: date, end: date, weekdays: list[int]) -> list[date]:
    """Fechas entre start y end (inclusive) que caen en los días elegidos."""
    wanted = set(weekdays)
    days, d = [], start
    while d <= end:
        if d.weekday() in wanted:
            days.append(d)
        d += timedelta(days=1)
    return days


def split_counts(total: int, weights: tuple[float, ...]) -> list[int]:
    """Reparte `total` según `weights` (método del mayor resto), mínimo 1 por módulo."""
    raw = [total * w for w in weights]
    counts = [max(1, int(r)) for r in raw]
    # ajustar para que sumen exactamente `total`
    while sum(counts) < total:
        i = max(range(len(raw)), key=lambda k: raw[k] - counts[k])
        counts[i] += 1
    while sum(counts) > total:
        i = max((k for k in range(len(counts)) if counts[k] > 1), key=lambda k: counts[k] - raw[k])
        counts[i] -= 1
    return counts


def build_plan(start: date, end: date, weekdays: list[int], minutes: int, level: str, mastery: int = 60) -> list[PlannedSession]:
    days = available_days(start, end, weekdays)
    if not days:
        raise NotEnoughSessions("No hay ningún día disponible entre esas fechas.")
    # La ruta cubre siempre los tres módulos. Si hay menos días que módulos (por ejemplo,
    # se estudia para un examen de mañana), varias sesiones caen en el mismo día.
    total = max(MIN_SESSIONS, len(days))
    counts = split_counts(total, weights_for(level, mastery))
    modules = [m for m, c in zip(MODULES, counts) for _ in range(c)]
    return [PlannedSession(i + 1, days[i * len(days) // total], m, minutes) for i, m in enumerate(modules)]
