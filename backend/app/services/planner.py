"""Generador del plan de estudio (OBJETIVO_ESTUDIO.plan_estudio), HU-002.

El estudiante indica de 1 a 14 días disponibles; el plan arranca hoy y asigna cada día a un módulo,
respetando el orden pedagógico (Aprender → Practicar → Consolidar) y con proporciones según el nivel
inicial y el dominio requerido por la nota objetivo. Cada nota exige un mínimo de días (3, 4 o 5).

Formato guardado (diccionario de datos): un arreglo de versiones. Cada versión tiene su número, fecha
de generación, motivo (inicial o reajuste) y lista de días; cada día, su fecha y sus actividades; y
cada actividad, el módulo, el tipo (contenido, evaluación, ejercicio o refuerzo) y el estado
(pendiente, completada o reprogramada). Un reajuste (HU-010) agrega una versión nueva sin tocar las anteriores.

Reajustes (HU-010, CA3 y CA4) y extensión:
- Día vencido con actividades pendientes y dominio inferior al requerido: las pendientes se reprograman desde hoy
  dentro de los días disponibles y se suma refuerzo (CA3). En el día vencido quedan como «reprogramada».
- Avance sobre el día siguiente con el de hoy completo: las actividades restantes se adelantan un día (CA4).
- Plan terminado sin alcanzar el dominio: el estudiante puede extenderlo de 1 a 7 días; lo pendiente y el
  refuerzo se reparten en los días nuevos.
- Dominio requerido alcanzado: el estudiante puede seguir con el nivel siguiente durante 1 a 7 días (HU-010, CA6);
  la versión nueva propone la evaluación de Aprender, ejercicios nuevos y la explicación de Consolidar.
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


# ---------------- Reajuste del plan (HU-010, CA3 y CA4) ----------------

REPROGRAMADA = "reprogramada"
DIAS_EXTENSION = (1, 7)


def _fecha(dia: dict) -> date:
    return date.fromisoformat(dia["fecha"])


def _copia(x):
    return json.loads(json.dumps(x))


def _repartir(grupos: list[list[dict]], n: int) -> list[list[dict]]:
    """Reparte los grupos (uno por día original), en orden, en `n` días: si sobran grupos, se juntan los consecutivos."""
    if len(grupos) <= n:
        return [list(g) for g in grupos]
    base, extra = divmod(len(grupos), n)
    dias, i = [], 0
    for k in range(n):
        tam = base + (1 if k < extra else 0)
        dias.append([a for g in grupos[i:i + tam] for a in g])
        i += tam
    return dias


def dias_vencidos_con_pendientes(version: dict, hoy: date) -> bool:
    return any(_fecha(d) < hoy and any(a["estado"] == "pendiente" for a in d["actividades"]) for d in version["dias"])


def reajustar(versiones: list[dict], hoy: date, fin: date, motivo: str, refuerzo: str | None = None,
              adelantar: bool = False) -> bool:
    """Agrega una versión nueva del plan. Devuelve False si no quedan días disponibles (de hoy a `fin`).

    - Los días anteriores a hoy se conservan; sus actividades pendientes pasan a «reprogramada» y se vuelven a
      planificar desde hoy, antes que las de los días siguientes (CA3).
    - Con `adelantar`, las actividades del día siguiente se suman a las de hoy y las demás se corren un día (CA4).
    - Con `refuerzo` (módulo), los días que quedan libres reciben una actividad de refuerzo de ese módulo; si no
      queda ninguno libre, el refuerzo se suma al primer día.
    """
    n = (fin - hoy).days + 1
    if n <= 0:
        return False
    nueva = _copia(vigente(versiones))
    pasados = [d for d in nueva["dias"] if _fecha(d) < hoy]
    siguientes = [d for d in nueva["dias"] if _fecha(d) >= hoy]
    grupos = []
    for d in pasados:
        pendientes = [a for a in d["actividades"] if a["estado"] == "pendiente"]
        if pendientes:
            grupos.append([{**a} for a in pendientes])
            for a in pendientes:
                a["estado"] = REPROGRAMADA
    futuros = [list(d["actividades"]) for d in siguientes]
    if adelantar and len(futuros) >= 2:
        futuros = [futuros[0] + futuros[1]] + futuros[2:]
    dias = _repartir(grupos + futuros, n)
    libres = n - len(dias)
    if refuerzo:
        if libres:
            dias += [[_actividad(refuerzo, "refuerzo")] for _ in range(libres)]
        elif dias:
            dias[0].append(_actividad(refuerzo, "refuerzo"))
    nueva["dias"] = pasados + [{"fecha": (hoy + timedelta(days=i)).isoformat(), "actividades": acts}
                               for i, acts in enumerate(dias) if acts]
    nueva.update(numero=len(versiones) + 1, fecha_generacion=hoy.isoformat(), motivo=motivo)
    versiones.append(nueva)
    return True


def estado_del_dia(dia: dict) -> str:
    """hecha (todo completado), no realizada (venció y lo pendiente se reprogramó) o pendiente."""
    estados = {a["estado"] for a in dia["actividades"]}
    if estados <= {"completada"}:
        return "hecha"
    return "no realizada" if "pendiente" not in estados else "pendiente"


# ---------------- Avance de nivel (HU-010, CA6) ----------------

NIVELES = ("principiante", "intermedio", "avanzado")
AVANCE = "avance de nivel"


def nivel_siguiente(nivel: str) -> str | None:
    i = NIVELES.index(nivel) if nivel in NIVELES else len(NIVELES) - 1
    return NIVELES[i + 1] if i + 1 < len(NIVELES) else None


def avanzar_nivel(versiones: list[dict], hoy: date, dias: int) -> None:
    """Agrega la versión del avance de nivel: se conservan los días anteriores a hoy y, desde hoy, se reparten en
    `dias` días la evaluación de Aprender, tres ejercicios nuevos de Practicar y la explicación de Consolidar, con el
    nivel nuevo. Los días que quedan libres reciben un ejercicio de refuerzo."""
    nueva = _copia(vigente(versiones))
    pasados = [d for d in nueva["dias"] if _fecha(d) < hoy]
    grupos = ([[_actividad("aprender", "evaluación")]] + [[_actividad("practicar", "ejercicio")] for _ in range(3)]
              + [[_actividad("consolidar", "evaluación")]])
    por_dia = _repartir(grupos, dias)
    por_dia += [[_actividad("practicar", "refuerzo")] for _ in range(dias - len(por_dia))]
    nueva["dias"] = pasados + [{"fecha": (hoy + timedelta(days=i)).isoformat(), "actividades": acts}
                               for i, acts in enumerate(por_dia)]
    nueva.update(numero=len(versiones) + 1, fecha_generacion=hoy.isoformat(), motivo=AVANCE)
    versiones.append(nueva)
