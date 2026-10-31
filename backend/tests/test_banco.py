"""Banco de ejercicios, programa generado, clasificación de intentos y cliente de Judge0."""
import json
import shutil
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlmodel import Session, SQLModel, select

from app.banco import AVANZADO, BASICO, INTERMEDIO, banco
from app.db import engine
from app.models import Ejercicio as EjercicioDB
from app.services.codigo import CORRECTO, EJECUCION, LOGICO, SINTAXIS, TIPOS, Ejecucion, clasificar, plantilla, programa
from app.services.ejecucion import EjecucionNoDisponible, EjecutorLocal, Judge0

HAY_JAVA = shutil.which("javac") is not None
LENGUAJES = ["python"] + (["java"] if HAY_JAVA else [])


# ---------------- Composición del banco (Alcances) ----------------

def test_composicion_del_banco():
    b = banco()
    assert len(b["Recursividad"]) == 15
    cuenta = lambda ejs, d: sum(1 for e in ejs if e.dificultad == d)
    assert [cuenta(b["Recursividad"], d) for d in (BASICO, INTERMEDIO, AVANZADO)] == [5, 5, 5]
    for tema in ("Sintaxis y estructuras de control", "Estructuras de datos lineales", "Búsqueda y ordenamiento"):
        assert [cuenta(b[tema], d) for d in (BASICO, INTERMEDIO, AVANZADO)] == [2, 2, 3], tema


def test_cada_ejercicio_cumple_el_diccionario_de_datos():
    for tema, ejs in banco().items():
        assert len({e.titulo for e in ejs}) == len(ejs), f"títulos repetidos en {tema}"
        for e in ejs:
            assert 1 <= e.tiempo_esperado <= 60, e.titulo  # EJERCICIO.tiempo_esperado
            assert len(e.casos) >= 3, e.titulo  # al menos tres casos de prueba
            assert {t for _, t in e.parametros} | {e.retorno} <= TIPOS, e.titulo
            assert all(len(entrada) == len(e.parametros) for entrada, _ in e.casos), e.titulo


def _correr(args):
    e, lenguaje = args
    esp = e.especificacion()
    return e.titulo, lenguaje, clasificar(EjecutorLocal().ejecutar(lenguaje, programa(esp, lenguaje, getattr(e, lenguaje))), esp, lenguaje)


def test_todas_las_soluciones_de_referencia_pasan_sus_casos():
    """Garantiza que cada ejercicio tiene solución en los dos lenguajes y que las salidas esperadas son correctas."""
    trabajos = [(e, l) for ejs in banco().values() for e in ejs for l in LENGUAJES]
    with ThreadPoolExecutor(8) as p:
        fallan = [(t, l, c.mensaje) for t, l, c in p.map(_correr, trabajos) if c.resultado != CORRECTO]
    assert fallan == []


# ---------------- Plantilla y clasificación (HU-005, HU-006 CA1) ----------------

FACTORIAL = next(e for e in banco()["Recursividad"] if e.titulo == "Factorial").especificacion()


def test_plantillas():
    assert plantilla(FACTORIAL, "python").startswith("def factorial(n):")
    assert plantilla(FACTORIAL, "java").startswith("public static int factorial(int n) {")
    sumad = next(e for e in banco()["Recursividad"] if e.titulo == "Suma de dígitos").especificacion()
    assert plantilla(sumad, "python").startswith("def suma_digitos(n):")  # snake_case en Python


def intentar(lenguaje, codigo):
    return clasificar(EjecutorLocal().ejecutar(lenguaje, programa(FACTORIAL, lenguaje, codigo)), FACTORIAL, lenguaje)


INTENTOS = {
    "python": [
        ("def factorial(n)\n    return 1\n", SINTAXIS, "sintaxis: SyntaxError"),
        ("def factorial(n):\n    return n * factorial(n - 1)\n", EJECUCION, "ejecución: RecursionError"),
        ("def factorial(n):\n    return 1 if n <= 1 else n * factorail(n - 1)\n", EJECUCION, "ejecución: NameError"),
        ("def factorial(n):\n    return 1 if n <= 1 else n * factorial(n - 2)\n", LOGICO, "lógico: caso 3"),
        ("def factorial(n):\n    while True:\n        pass\n", EJECUCION, "ejecución: tiempo límite excedido"),
        ("def factorial(n):\n    return True\n", LOGICO, "lógico: caso 1"),  # True no es 1: se compara también el tipo
    ],
    "java": [
        ("public static int factorial(int n) {\n    return n <= 1 ? 1 : n * factorail(n - 1);\n}\n", SINTAXIS,
         "sintaxis: cannot find symbol"),
        ("public static int factorial(int n) {\n    return n * factorial(n - 1);\n}\n", EJECUCION, "ejecución: StackOverflowError"),
        ("public static int factorial(int n) {\n    return n <= 1 ? 1 : n * factorial(n - 2);\n}\n", LOGICO, "lógico: caso 3"),
    ],
}


@pytest.mark.parametrize("lenguaje,codigo,resultado,tipo", [(l, *i) for l in LENGUAJES for i in INTENTOS[l]])
def test_clasificacion_de_intentos(lenguaje, codigo, resultado, tipo):
    c = intentar(lenguaje, codigo)
    assert c.resultado == resultado and c.tipo_error.startswith(tipo), (c.tipo_error, c.mensaje)


def test_lo_que_imprime_el_estudiante_no_se_confunde_con_los_casos():
    c = intentar("python", "def factorial(n):\n    print('CASO|1|OK')\n    return 1 if n <= 1 else n * factorial(n - 1)\n")
    assert c.resultado == CORRECTO


def test_mensaje_de_error_logico_muestra_el_caso():
    c = intentar("python", "def factorial(n):\n    return 1 if n <= 1 else n * factorial(n - 2)\n")
    assert c.mensaje == "Caso 3: con 5 se esperaba 120 y se obtuvo 15."


@pytest.mark.skipif(not HAY_JAVA, reason="sin javac")
def test_java_informa_la_linea_del_codigo_del_estudiante():
    c = intentar("java", "public static int factorial(int n) {\n    return n <= 1 ? 1 : n * factorail(n - 1);\n}\n")
    assert "línea 2" in c.mensaje  # no la línea del programa completo


# ---------------- Carga en la base ----------------

def test_carga_del_banco_es_idempotente():
    from app.db import init_db
    from app.ejercicios import cargar
    init_db()
    SQLModel.metadata.drop_all(engine)
    cargar()
    cargar()
    with Session(engine) as db:
        filas = db.exec(select(EjercicioDB)).all()
    assert len(filas) == 36
    f = next(f for f in filas if f.enunciado.startswith("# Factorial"))
    esp = json.loads(f.casos_prueba)
    assert esp["funcion"] == "factorial" and len(esp["casos"]) == 5 and f.dificultad == "básico"
    assert "return" not in f.casos_prueba + f.enunciado  # las soluciones no se cargan


# ---------------- Cliente de Judge0 (simulado) ----------------

class _R:
    def __init__(self, data): self.data = data
    def json(self): return self.data
    def raise_for_status(self): pass


class Judge0Falso:
    """Responde como Judge0: un token al enviar y una secuencia de estados al consultar."""
    def __init__(self, estados):
        self.estados, self.enviados, self.headers = list(estados), [], None

    def post(self, url, json, headers, timeout):
        self.enviados.append(json); self.headers = headers
        return _R({"token": f"t{len(self.enviados)}"})

    def get(self, url, headers, timeout):
        return _R(self.estados.pop(0))


def b64(t):
    import base64
    return base64.b64encode(t.encode()).decode()


def test_judge0_envia_limites_y_consulta_hasta_terminar():
    http = Judge0Falso([{"status": {"id": 1}}, {"status": {"id": 2}},
                        {"status": {"id": 3}, "stdout": b64("@@CASO|1|OK\n"), "stderr": None, "compile_output": None}])
    ejec = Judge0("https://judge0.example", "clave", http=http, dormir=lambda s: None).ejecutar("java", "class Main {}")
    assert ejec.estado == "terminado" and ejec.salida == "@@CASO|1|OK\n"
    enviado = http.enviados[0]
    assert (enviado["language_id"], enviado["cpu_time_limit"], enviado["memory_limit"]) == (62, 5, 128 * 1024)
    assert http.headers["X-RapidAPI-Key"] == "clave"


def test_judge0_estados():
    for estado, esperado in [(5, "tiempo límite"), (6, "error de compilación"), (11, "error de ejecución")]:
        http = Judge0Falso([{"status": {"id": estado}, "stdout": None, "stderr": None, "compile_output": None}])
        assert Judge0("https://j", "", http=http, dormir=lambda s: None).ejecutar("python", "x").estado == esperado


def test_judge0_reintenta_una_vez_y_despues_avisa():
    interno = {"status": {"id": 13, "description": "Internal Error"}}
    ok = {"status": {"id": 3}, "stdout": None, "stderr": None, "compile_output": None}
    http = Judge0Falso([interno, ok])
    assert Judge0("https://j", "", http=http, dormir=lambda s: None).ejecutar("python", "x").estado == "terminado"
    assert len(http.enviados) == 2  # reintentó
    http = Judge0Falso([interno, interno])
    with pytest.raises(EjecucionNoDisponible):
        Judge0("https://j", "", http=http, dormir=lambda s: None).ejecutar("python", "x")
