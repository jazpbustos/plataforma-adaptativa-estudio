"""Reglas del módulo Practicar: detección de bloqueos (HU-006), intervenciones (HU-007), puntos y selección de
ejercicios (Alcances, HU-011).

Son funciones puras, sin base de datos: reciben los intentos e intervenciones del ejercicio en curso y
devuelven qué corresponde hacer. Así se prueban directamente contra los ejemplos de las historias de
usuario. Los umbrales están en parametros.toml y son valores iniciales sujetos a calibración.
"""
import difflib
import random
from dataclasses import dataclass

from ..config import P
from .codigo import CORRECTO

D = P["detector"]
PR = P["practicar"]
DIFICULTADES = ("básico", "intermedio", "avanzado")
INTENTOS_REPETIDOS, TIEMPO_EXCEDIDO = "intentos fallidos repetidos", "tiempo excedido"
PISTA_MINIMA, EXPLICACION_ELABORADA = 1, 2


@dataclass
class Intento:
    codigo: str
    resultado: str  # correcto | error de sintaxis | error de ejecución | error lógico
    tipo_error: str | None


@dataclass
class Intervencion:
    nivel: int  # 1: pista mínima, 2: explicación elaborada
    tipo_patron: str
    despues_del_intento: int  # posición (desde 0) del intento que la originó dentro de los intentos del ejercicio


# ---------------- Detección de bloqueos (HU-006) ----------------

def lineas_cambiadas(anterior: str, nuevo: str) -> int:
    """Cuántas líneas cambian entre dos versiones del código (agregadas, borradas o modificadas).

    Se ignoran los espacios al final de cada línea y las líneas en blanco: no son cambios en la solución.
    Una línea modificada cuenta una vez, no como una borrada más una agregada.
    """
    a = [l.rstrip() for l in anterior.splitlines() if l.strip()]
    b = [l.rstrip() for l in nuevo.splitlines() if l.strip()]
    total = 0
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op != "equal":
            total += max(i2 - i1, j2 - j1)
    return total


def senal_por_intentos(intentos: list[Intento]) -> bool:
    """CA1: los últimos tres intentos fallaron con el mismo tipo de error y cambian dos líneas o menos entre sí.

    El mismo tipo de error es la misma categoría y el mismo mensaje (o, en los errores lógicos, el mismo caso
    de prueba que falla): por eso se compara tipo_error, que ya viene normalizado.
    """
    n = D["intentos_iguales"]
    if len(intentos) < n:
        return False
    ultimos = intentos[-n:]
    if any(i.resultado == CORRECTO for i in ultimos) or len({i.tipo_error for i in ultimos}) != 1:
        return False
    return all(lineas_cambiadas(a.codigo, b.codigo) <= D["lineas_cambio_minimo"] for a, b in zip(ultimos, ultimos[1:]))


def senal_por_tiempo(tiempo_activo_segundos: float, tiempo_esperado_minutos: int, intentos: list[Intento]) -> bool:
    """CA2 y CA4: el tiempo activo supera 2,5 veces el esperado, y hubo al menos un intento fallido.

    Una pausa sin intentos fallidos no es un bloqueo: el estudiante puede estar pensando o leyendo.
    """
    hubo_fallido = any(i.resultado != CORRECTO for i in intentos)
    return hubo_fallido and tiempo_activo_segundos > D["factor_tiempo"] * tiempo_esperado_minutos * 60


# ---------------- Intervenciones (HU-007) ----------------

def siguiente_intervencion(intentos: list[Intento], intervenciones: list[Intervencion],
                           tiempo_activo_segundos: float, tiempo_esperado_minutos: int) -> tuple[int, str] | None:
    """Qué intervención corresponde ahora en el ejercicio, o None. Devuelve (nivel, tipo de patrón).

    - Sin intervenciones previas: ante una señal de bloqueo, la pista mínima (nivel 1, CA1).
    - Con la pista ya dada: si el intento siguiente a la pista también falla, la explicación elaborada
      (nivel 2, CA2), con el mismo patrón que originó la pista.
    - Con la explicación ya dada no se interviene más en ese ejercicio: la ayuda no llega a la solución.
    Si el ejercicio ya se resolvió, no corresponde intervenir.
    """
    if any(i.resultado == CORRECTO for i in intentos):
        return None
    dadas = {i.nivel: i for i in intervenciones}
    if EXPLICACION_ELABORADA in dadas:
        return None
    if PISTA_MINIMA in dadas:
        pista = dadas[PISTA_MINIMA]
        posteriores = intentos[pista.despues_del_intento + 1:]
        if posteriores and posteriores[-1].resultado != CORRECTO:
            return EXPLICACION_ELABORADA, pista.tipo_patron
        return None
    if senal_por_intentos(intentos):
        return PISTA_MINIMA, INTENTOS_REPETIDOS
    if senal_por_tiempo(tiempo_activo_segundos, tiempo_esperado_minutos, intentos):
        return PISTA_MINIMA, TIEMPO_EXCEDIDO
    return None


def hubo_avance(intento_que_origino: Intento, intento_siguiente: Intento) -> bool:
    """CA3: después de una intervención, el estudiante avanzó si el intento siguiente es correcto o si cambió
    el tipo de error (dejó atrás el error sobre el que se intervino, aunque todavía no haya terminado)."""
    return intento_siguiente.resultado == CORRECTO or intento_siguiente.tipo_error != intento_que_origino.tipo_error


# ---------------- Puntos (HU-011, CA1) ----------------

def puntos(intervenciones: list[Intervencion]) -> int:
    """10 sin intervenciones, 7 con pista mínima y 4 si recibió además la explicación elaborada.

    Solo se asignan en la primera resolución correcta de cada ejercicio: eso lo controla quien llama, con
    PUNTO.id_ejercicio.
    """
    nivel = max((i.nivel for i in intervenciones), default=0)
    p = PR["puntos"]
    return {0: p["sin_ayuda"], PISTA_MINIMA: p["pista_minima"], EXPLICACION_ELABORADA: p["explicacion_elaborada"]}[nivel]


# ---------------- Selección de ejercicios (Alcances, HU-011) ----------------

def requeridos(nivel_inicial: str) -> dict[str, int]:
    """Cuántos ejercicios de cada dificultad aprueban Practicar según el nivel inicial (dos básicos, dos
    intermedios y uno avanzado para principiante; uno, dos y dos para intermedio; dos intermedios y tres
    avanzados para avanzado)."""
    return dict(zip(DIFICULTADES, PR["mezcla"][nivel_inicial]))


def practicar_aprobado(resueltos: int) -> bool:
    return resueltos >= PR["ejercicios_para_aprobar"]


def siguiente_ejercicio(ejercicios: list[tuple[int, str]], resueltos: set[int], nivel_inicial: str,
                        azar: random.Random | None = None) -> tuple[int, bool] | None:
    """El próximo ejercicio a presentar: (id_ejercicio, es_repaso), o None si el tema no tiene ejercicios.

    `ejercicios` son pares (id, dificultad) del tema; `resueltos`, los ids ya resueltos correctamente.
    - Mientras no aprobó: la primera dificultad, en orden creciente, de la que todavía le faltan ejercicios
      según su nivel inicial; dentro de ella, uno al azar entre los que aún no resolvió. Así cada ingreso
      presenta ejercicios distintos.
    - Ya aprobado (práctica adicional, HU-011 CA4): uno no resuelto, respetando la progresión de
      dificultad; si no quedan, uno ya resuelto como repaso.
    """
    azar = azar or random.Random()
    if not ejercicios:
        return None
    por_dificultad = {d: [i for i, dif in ejercicios if dif == d] for d in DIFICULTADES}
    hechos = {d: sum(1 for i in por_dificultad[d] if i in resueltos) for d in DIFICULTADES}
    if not practicar_aprobado(len(resueltos)):
        for d, n in requeridos(nivel_inicial).items():
            pendientes = [i for i in por_dificultad[d] if i not in resueltos]
            if hechos[d] < n and pendientes:
                return azar.choice(pendientes), False
    for d in DIFICULTADES:
        pendientes = [i for i in por_dificultad[d] if i not in resueltos]
        if pendientes:
            return azar.choice(pendientes), False
    return azar.choice([i for i, _ in ejercicios]), True
