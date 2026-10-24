"""Generador del plan de estudio (OBJETIVO_ESTUDIO.plan_estudio), HU-002.

El estudiante indica de 1 a 14 días disponibles; el plan arranca hoy y asigna cada día a un módulo,
respetando el orden pedagógico (Aprender → Practicar → Consolidar) y con proporciones según el nivel
inicial y el dominio requerido por la nota objetivo. Cada nota exige un mínimo de días (3, 4 o 5).

Formato guardado (diccionario de datos): un arreglo de versiones. Cada versión tiene su número, fecha
de generación, motivo (inicial o reajuste) y lista de días; cada día, su fecha y sus actividades; y
cada actividad, el módulo, el tipo (contenido, evaluación, ejercicio o refuerzo) y el estado
(pendiente o completada). Un reajuste (HU-010) agrega una versión nueva sin tocar las anteriores.
"""
import json
from datetime import date, timedelta

from ..config import P

MODULES = ("aprender", "practicar", "consolidar")
O = P["objetivo"]
EJERCICIOS_PARA_APROBAR = P["practicar"]["ejercicios_para_aprobar"]

# Proporción de días por módulo según el nivel inicial.
# Quien ya sabe más necesita menos teoría y más práctica/consolidación.
WEIGHTS = {
    "principiante": (0.48, 0.36, 0.16),
    "intermedio": (0.36, 0.44, 0.20),
    "avanzado": (0.24, 0.50, 0.26),
}


class DiasInsuficientes(ValueError):
    """La cantidad de días no alcanza para la nota objetivo (HU-002, CA6) o está fuera del rango (CA5)."""


def required_mastery(grade: int) -> int:
    """Dominio requerido según la nota objetivo (HU-002, CA2): 60 % para 6 o 7, 80 % para 8 o 9 y 90 % para 10."""
    if not O["nota_min"] <= grade <= O["nota_max"]:
        raise ValueError(f"La nota objetivo va de {O['nota_min']} a {O['nota_max']}")
    return O["dominio_requerido"][str(grade)]


def dias_minimos(grade: int) -> int:
    """Días mínimos que necesita una nota objetivo (HU-002, CA6): 3 para 6 o 7, 4 para 8 o 9 y 5 para 10."""
    required_mastery(grade)  # valida el rango
    return O["dias_minimos"][str(grade)]


def nota_maxima_para(dias: int) -> int | None:
    """La nota objetivo más alta que entra en esa cantidad de días (para ofrecer bajarla)."""
    posibles = [int(n) for n, d in O["dias_minimos"].items() if d <= dias]
    return max(posibles) if posibles else None


def validar_dias(dias: int, grade: int) -> None:
    if not O["dias_min"] <= dias <= O["dias_max"]:
        raise DiasInsuficientes(f"Los días disponibles van de {O['dias_min']} a {O['dias_max']}.")
    minimo = dias_minimos(grade)
    if dias < minimo:
        otra = nota_maxima_para(dias)
        opcion = f" o bajá la nota objetivo a {otra}" if otra else ""
        raise DiasInsuficientes(f"Para una nota de {grade} necesitás al menos {minimo} días. "
                                f"Ampliá los días disponibles{opcion}.")


def weights_for(level: str, mastery: int) -> tuple[float, float, float]:
    """Una nota más alta exige más dominio: se pasa parte de Aprender a Practicar y Consolidar.
    Con 60 % no cambia; con 80 %, 4 puntos; con 90 %, 8 puntos (dos tercios a Practicar)."""
    a, p, c = WEIGHTS[level]
    shift = {60: 0.0, 80: 0.04, 90: 0.08}[mastery]
    return (a - shift, p + shift * 2 / 3, c + shift / 3)


def split_counts(total: int, weights: tuple[float, ...]) -> list[int]:
    """Reparte `total` según `weights` (método del mayor resto), mínimo 1 por módulo."""
    raw = [total * w for w in weights]
    counts = [max(1, int(r)) for r in raw]
    while sum(counts) < total:
        i = max(range(len(raw)), key=lambda k: raw[k] - counts[k])
        counts[i] += 1
    while sum(counts) > total:
        i = max((k for k in range(len(counts)) if counts[k] > 1), key=lambda k: counts[k] - raw[k])
        counts[i] -= 1
    return counts


def _actividad(modulo: str, tipo: str) -> dict:
    return {"modulo": modulo, "tipo": tipo, "estado": "pendiente"}


def construir_dias(inicio: date, dias: int, level: str, grade: int) -> list[dict]:
    """Días del plan con sus actividades.

    - Aprender: un día de contenido por día asignado; el último suma la evaluación de comprensión.
    - Practicar: los cinco ejercicios que aprueban el módulo, repartidos entre sus días (al menos uno por día).
    - Consolidar: la explicación del tema, que el sistema evalúa.
    """
    validar_dias(dias, grade)
    n_a, n_p, n_c = split_counts(dias, weights_for(level, required_mastery(grade)))
    modulos = ["aprender"] * n_a + ["practicar"] * n_p + ["consolidar"] * n_c
    ejercicios = [EJERCICIOS_PARA_APROBAR // n_p + (1 if i < EJERCICIOS_PARA_APROBAR % n_p else 0) for i in range(n_p)]
    ejercicios = [max(1, e) for e in ejercicios]

    plan, i_a, i_p = [], 0, 0
    for i, modulo in enumerate(modulos):
        if modulo == "aprender":
            i_a += 1
            acts = [_actividad("aprender", "contenido")] + ([_actividad("aprender", "evaluación")] if i_a == n_a else [])
        elif modulo == "practicar":
            acts = [_actividad("practicar", "ejercicio") for _ in range(ejercicios[i_p])]
            i_p += 1
        else:
            acts = [_actividad("consolidar", "evaluación")]
        plan.append({"fecha": (inicio + timedelta(days=i)).isoformat(), "actividades": acts})
    return plan


def plan_inicial(inicio: date, dias: int, level: str, grade: int) -> list[dict]:
    """Arreglo de versiones con la versión 1 (motivo: inicial)."""
    return [{"numero": 1, "fecha_generacion": inicio.isoformat(), "motivo": "inicial",
             "dias": construir_dias(inicio, dias, level, grade)}]


def plan_a_json(versiones: list[dict]) -> str:
    return json.dumps(versiones, ensure_ascii=False)


def plan_desde_json(texto: str) -> list[dict]:
    return json.loads(texto)


def vigente(versiones: list[dict]) -> dict:
    return versiones[-1]


def modulo_del_dia(dia: dict) -> str:
    return dia["actividades"][0]["modulo"]


def dia_completo(dia: dict) -> bool:
    return all(a["estado"] == "completada" for a in dia["actividades"])
