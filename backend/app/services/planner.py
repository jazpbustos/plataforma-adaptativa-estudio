"""Generador de la ruta de aprendizaje inicial.

Primera versión determinística: reparte las sesiones disponibles entre los tres
módulos respetando el orden pedagógico (Aprender → Practicar → Consolidar).
El recálculo adaptativo según el avance real se suma en un sprint posterior.
"""
from dataclasses import dataclass
from datetime import date, timedelta

MODULES = ("aprender", "practicar", "consolidar")
MIN_SESSIONS = 3

# Proporción de sesiones por módulo según la autoevaluación inicial.
# Quien ya sabe más necesita menos teoría y más práctica/consolidación.
WEIGHTS = {
    0: (0.50, 0.35, 0.15),  # nunca lo vi
    1: (0.42, 0.40, 0.18),  # lo vi pero no lo entiendo
    2: (0.32, 0.46, 0.22),  # lo entiendo pero me cuesta aplicarlo
    3: (0.22, 0.50, 0.28),  # puedo resolver ejercicios
}


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


def build_plan(start: date, end: date, weekdays: list[int], minutes: int, level: int) -> list[PlannedSession]:
    days = available_days(start, end, weekdays)
    if not days:
        raise NotEnoughSessions("No hay ningún día disponible entre esas fechas.")
    # La ruta cubre siempre los tres módulos. Si hay menos días que módulos (por ejemplo,
    # se estudia para un examen de mañana), varias sesiones caen en el mismo día.
    total = max(MIN_SESSIONS, len(days))
    counts = split_counts(total, WEIGHTS[level])
    modules = [m for m, c in zip(MODULES, counts) for _ in range(c)]
    return [PlannedSession(i + 1, days[i * len(days) // total], m, minutes) for i, m in enumerate(modules)]
