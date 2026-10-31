"""Nivel de dominio (HU-010, CA1) y desbloqueo progresivo de los módulos (HU-011, CA2 y CA3; HU-012, CA3).

Funciones puras: reciben los resultados de cada módulo del tema y devuelven el porcentaje y el estado de
cada módulo. Los pesos y valores están en parametros.toml.
"""
from ..config import P

DOM = P["dominio"]
APROBACION_APRENDER = P["aprender"]["aprobacion"] * 100
EJERCICIOS = P["practicar"]["ejercicios_para_aprobar"]
APROBADO, HABILITADO, BLOQUEADO = "aprobado", "habilitado", "bloqueado"


def nivel_dominio(mejor_evaluacion: float | None, puntos_por_ejercicio: list[int],
                  ultima_explicacion: str | None) -> float:
    """0,3 × A + 0,4 × P + 0,3 × C, de 0 a 100.

    - A: el mejor porcentaje obtenido en la evaluación de comprensión de Aprender.
    - P: la suma de los puntos de los cinco mejores ejercicios resueltos, sobre 50, en porcentaje.
    - C: 100 si la explicación de Consolidar es correcta, 50 si es incompleta y 0 si es incorrecta.
      Un resultado "no concluyente" no se computa (HU-008, CA5): quien llama pasa el último concluyente.
    Los módulos no realizados valen 0.
    """
    a = mejor_evaluacion or 0
    mejores = sorted(puntos_por_ejercicio, reverse=True)[:EJERCICIOS]
    p = sum(mejores) / (EJERCICIOS * P["practicar"]["puntos"]["sin_ayuda"]) * 100
    c = DOM["consolidar"].get(ultima_explicacion or "", 0)
    return round(DOM["peso_aprender"] * a + DOM["peso_practicar"] * p + DOM["peso_consolidar"] * c, 1)


def estado_modulos(mejor_evaluacion: float | None, ejercicios_resueltos: int,
                   ultima_explicacion: str | None) -> dict[str, dict]:
    """Estado de cada módulo del tema y, si está bloqueado, la condición que falta cumplir.

    Aprender está siempre habilitado; Practicar se habilita al aprobar Aprender (60 %) y Consolidar, al
    resolver cinco ejercicios. Un módulo aprobado se puede volver a usar sin perder el desbloqueo (CA5).
    """
    aprender_ok = (mejor_evaluacion or 0) >= APROBACION_APRENDER
    practicar_ok = aprender_ok and ejercicios_resueltos >= EJERCICIOS
    estados = {
        "aprender": {"estado": APROBADO if aprender_ok else HABILITADO, "falta": None},
        "practicar": {"estado": (APROBADO if practicar_ok else HABILITADO) if aprender_ok else BLOQUEADO,
                      "falta": None if aprender_ok else
                      f"Aprobá la evaluación de comprensión de Aprender con al menos {APROBACION_APRENDER:.0f} %."},
        "consolidar": {"estado": (APROBADO if ultima_explicacion == "correcta" else HABILITADO) if practicar_ok else BLOQUEADO,
                       "falta": None if practicar_ok else
                       (f"Resolvé {EJERCICIOS} ejercicios en Practicar (llevás {ejercicios_resueltos})." if aprender_ok
                        else "Primero aprobá Aprender y después resolvé los ejercicios de Practicar.")},
    }
    return estados
