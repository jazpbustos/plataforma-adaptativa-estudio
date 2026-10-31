"""Banco curado de ejercicios del módulo Practicar (Alcances; HU-005, HU-006 y HU-011).

Los ejercicios no se generan durante la sesión ni se toman de la web: cada uno necesita casos de prueba
verificados para corregir los intentos y un tiempo esperado de resolución para calibrar el detector de
bloqueos. Recursividad tiene el banco completo (cinco básicos, cinco intermedios y cinco avanzados) y los
demás temas, siete (dos básicos, dos intermedios y tres avanzados), la cantidad mínima para componer los
cinco ejercicios que aprueban el módulo con cualquier nivel inicial.

Cada ejercicio trae una solución de referencia en Python y en Java. No se cargan en la base: los tests
las ejecutan contra los casos de prueba para garantizar que cada ejercicio tiene solución en los dos
lenguajes y que sus salidas esperadas son correctas. La carga en la base la hace `python -m app.ejercicios`.
"""
from dataclasses import dataclass

BASICO, INTERMEDIO, AVANZADO = "básico", "intermedio", "avanzado"


@dataclass
class Ejercicio:
    titulo: str
    dificultad: str
    tiempo_esperado: int  # minutos
    funcion: str  # camelCase (Java); en Python, su equivalente en snake_case
    parametros: list[tuple[str, str]]  # (nombre, tipo): int, bool, str o int[]
    retorno: str
    enunciado: str
    casos: list[tuple[list, object]]  # (argumentos, salida esperada)
    python: str  # solución de referencia
    java: str

    def especificacion(self) -> dict:
        """Lo que se guarda en EJERCICIO.casos_prueba: la firma y los casos de prueba."""
        return {"funcion": self.funcion, "parametros": [{"nombre": n, "tipo": t} for n, t in self.parametros],
                "retorno": self.retorno, "casos": [{"entrada": e, "salida": s} for e, s in self.casos]}


def banco() -> dict[str, list[Ejercicio]]:
    from . import busqueda_ordenamiento, estructuras_lineales, recursividad, sintaxis
    return {
        "Sintaxis y estructuras de control": sintaxis.EJERCICIOS,
        "Estructuras de datos lineales": estructuras_lineales.EJERCICIOS,
        "Recursividad": recursividad.EJERCICIOS,
        "Búsqueda y ordenamiento": busqueda_ordenamiento.EJERCICIOS,
    }
