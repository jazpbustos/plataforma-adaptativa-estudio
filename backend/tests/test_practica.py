"""Reglas de Practicar y de progreso, probadas con los ejemplos de las historias de usuario de la Entrega 3."""
import random

import pytest

from app.services.practica import (EXPLICACION_ELABORADA, INTENTOS_REPETIDOS, PISTA_MINIMA, TIEMPO_EXCEDIDO, Intento,
                                   Intervencion, hubo_avance, lineas_cambiadas, puntos, senal_por_intentos,
                                   senal_por_tiempo, siguiente_ejercicio, siguiente_intervencion)
from app.services.progreso import BLOQUEADO, HABILITADO, APROBADO, estado_modulos, nivel_dominio

BASE = "public static int f(int n) {\n    int x = 1;\n    return g(n);\n}\n"


def fallido(codigo=BASE, tipo="sintaxis: cannot find symbol", resultado="error de sintaxis"):
    return Intento(codigo, resultado, tipo)


def correcto(codigo=BASE):
    return Intento(codigo, "correcto", None)


def con_linea(n):  # el código base con una línea distinta en cada intento
    return BASE.replace("int x = 1;", f"int x = {n};")


# ---------------- HU-006: detección de bloqueos ----------------

def test_lineas_cambiadas():
    assert lineas_cambiadas(BASE, BASE) == 0
    assert lineas_cambiadas(BASE, con_linea(2)) == 1
    assert lineas_cambiadas(BASE, BASE + "   \n\n") == 0  # espacios y líneas en blanco no cuentan
    assert lineas_cambiadas("a\nb\nc\n", "a\nX\nY\nZ\nc\n") == 3


def test_ejemplo_positivo_tres_intentos_con_el_mismo_error():
    # CA5: tiempo esperado 10 min, tres intentos con "cannot find symbol" y una línea modificada entre ellos.
    intentos = [fallido(con_linea(1)), fallido(con_linea(2))]
    assert not senal_por_intentos(intentos)  # con dos todavía no
    intentos.append(fallido(con_linea(3)))
    assert senal_por_intentos(intentos)  # en el tercero sí


def test_ejemplo_negativo_errores_de_distinta_categoria():
    # CA8: sintaxis, luego ejecución y luego lógico: el estudiante avanza.
    intentos = [fallido(tipo="sintaxis: cannot find symbol"),
                fallido(tipo="ejecución: StackOverflowError", resultado="error de ejecución"),
                fallido(tipo="lógico: caso 2", resultado="error lógico")]
    assert not senal_por_intentos(intentos)


def test_mismo_error_pero_con_cambios_grandes_no_es_bloqueo():
    reescrito = BASE + "\n".join(f"// línea nueva {i}" for i in range(3))
    assert not senal_por_intentos([fallido(), fallido(reescrito), fallido(reescrito + "x\n")])


def test_un_intento_correcto_corta_la_racha():
    assert not senal_por_intentos([fallido(), correcto(), fallido()])


def test_ejemplo_positivo_por_tiempo():
    # CA6: tiempo esperado 10 min y un intento fallido: a los 26 min de tiempo activo hay señal (umbral 25 min).
    assert senal_por_tiempo(26 * 60, 10, [fallido()])
    assert not senal_por_tiempo(25 * 60, 10, [fallido()])


def test_ejemplo_negativo_pestana_oculta():
    # CA7: con la pestaña oculta 30 min el tiempo activo no avanza (lo mide el frontend): no hay señal.
    assert not senal_por_tiempo(0, 10, [fallido()])


def test_pausa_sin_intentos_fallidos_no_es_bloqueo():
    # CA4.
    assert not senal_por_tiempo(60 * 60, 10, [])
    assert not senal_por_tiempo(60 * 60, 10, [correcto()])


# ---------------- HU-007: intervenciones ----------------

def test_primera_senal_da_la_pista_minima():
    intentos = [fallido(con_linea(i)) for i in range(3)]
    assert siguiente_intervencion(intentos, [], 0, 10) == (PISTA_MINIMA, INTENTOS_REPETIDOS)


def test_si_persiste_despues_de_la_pista_escala_a_la_explicacion():
    intentos = [fallido(con_linea(i)) for i in range(3)]
    pista = Intervencion(PISTA_MINIMA, INTENTOS_REPETIDOS, despues_del_intento=2)
    assert siguiente_intervencion(intentos, [pista], 0, 10) is None  # todavía no hay intento posterior a la pista
    intentos.append(fallido(con_linea(9)))
    assert siguiente_intervencion(intentos, [pista], 0, 10) == (EXPLICACION_ELABORADA, INTENTOS_REPETIDOS)
    explicacion = Intervencion(EXPLICACION_ELABORADA, INTENTOS_REPETIDOS, despues_del_intento=3)
    intentos.append(fallido(con_linea(8)))
    assert siguiente_intervencion(intentos, [pista, explicacion], 0, 10) is None  # no hay un tercer nivel


def test_pista_por_tiempo_excedido():
    assert siguiente_intervencion([fallido()], [], 26 * 60, 10) == (PISTA_MINIMA, TIEMPO_EXCEDIDO)


def test_no_se_interviene_en_un_ejercicio_resuelto():
    intentos = [fallido(con_linea(i)) for i in range(3)] + [correcto()]
    assert siguiente_intervencion(intentos, [], 99 * 60, 10) is None


def test_avance_posterior_a_la_intervencion():
    # CA3: avanza si resuelve o si deja atrás el error sobre el que se intervino.
    origen = fallido()
    assert hubo_avance(origen, correcto())
    assert hubo_avance(origen, fallido(tipo="lógico: caso 1", resultado="error lógico"))
    assert not hubo_avance(origen, fallido())


# ---------------- HU-011: puntos ----------------

def test_puntos_segun_la_ayuda_recibida():
    pista = Intervencion(PISTA_MINIMA, TIEMPO_EXCEDIDO, 0)
    explicacion = Intervencion(EXPLICACION_ELABORADA, TIEMPO_EXCEDIDO, 1)
    assert (puntos([]), puntos([pista]), puntos([pista, explicacion])) == (10, 7, 4)


# ---------------- Selección de ejercicios (Alcances) ----------------

BANCO_7 = [(1, "básico"), (2, "básico"), (3, "intermedio"), (4, "intermedio"), (5, "avanzado"), (6, "avanzado"), (7, "avanzado")]


def recorrer(nivel, banco=BANCO_7, semilla=0):
    azar, resueltos, orden = random.Random(semilla), set(), []
    while len(resueltos) < 5:
        i, repaso = siguiente_ejercicio(banco, resueltos, nivel, azar)
        assert not repaso and i not in resueltos
        orden.append(dict(banco)[i])
        resueltos.add(i)
    return orden, resueltos


@pytest.mark.parametrize("nivel,esperado", [
    ("principiante", ["básico", "básico", "intermedio", "intermedio", "avanzado"]),
    ("intermedio", ["básico", "intermedio", "intermedio", "avanzado", "avanzado"]),
    ("avanzado", ["intermedio", "intermedio", "avanzado", "avanzado", "avanzado"]),
])
def test_cinco_ejercicios_en_dificultad_creciente_segun_el_nivel(nivel, esperado):
    # Los temas con siete ejercicios alcanzan para cualquier nivel inicial.
    assert recorrer(nivel)[0] == esperado


def test_cada_ingreso_presenta_ejercicios_distintos():
    vistos = {siguiente_ejercicio(BANCO_7, set(), "principiante", random.Random(s))[0] for s in range(20)}
    assert vistos == {1, 2}  # al azar entre los básicos no resueltos


def test_practica_adicional_y_repaso():
    _, resueltos = recorrer("principiante")
    i, repaso = siguiente_ejercicio(BANCO_7, resueltos, "principiante", random.Random(1))
    assert not repaso and i not in resueltos  # todavía quedan ejercicios nuevos
    i, repaso = siguiente_ejercicio(BANCO_7, set(range(1, 8)), "principiante", random.Random(1))
    assert repaso  # no quedan nuevos: repaso de uno resuelto


# ---------------- HU-010 y HU-011: dominio y desbloqueo ----------------

def test_nivel_de_dominio():
    assert nivel_dominio(None, [], None) == 0  # módulos no realizados valen 0
    # A = 80; P = cinco mejores (10 + 10 + 10 + 10 + 7 = 47) sobre 50 = 94 %; C = correcta = 100.
    assert nivel_dominio(80, [10, 7, 4, 10, 10, 10], "correcta") == round(0.3 * 80 + 0.4 * 94 + 0.3 * 100, 1)
    assert nivel_dominio(60, [10] * 5, "incompleta") == round(0.3 * 60 + 0.4 * 100 + 0.3 * 50, 1)
    assert nivel_dominio(100, [], "no concluyente") == 30  # no concluyente no se computa


def test_desbloqueo_progresivo():
    e = estado_modulos(None, 0, None)
    assert [e[m]["estado"] for m in ("aprender", "practicar", "consolidar")] == [HABILITADO, BLOQUEADO, BLOQUEADO]
    assert "60 %" in e["practicar"]["falta"]
    e = estado_modulos(60, 3, None)
    assert [e[m]["estado"] for m in ("aprender", "practicar", "consolidar")] == [APROBADO, HABILITADO, BLOQUEADO]
    assert "llevás 3" in e["consolidar"]["falta"]
    e = estado_modulos(80, 5, "incompleta")
    assert e["consolidar"] == {"estado": HABILITADO, "falta": None}
    e = estado_modulos(80, 6, "correcta")
    assert all(e[m]["estado"] == APROBADO for m in e)
