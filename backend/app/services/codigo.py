"""Programa que se envía a ejecutar y clasificación de su resultado (HU-005 y HU-006).

Cada ejercicio describe su función con una firma independiente del lenguaje, guardada junto con los
casos de prueba en EJERCICIO.casos_prueba (JSON):

    {"funcion": "factorial", "parametros": [{"nombre": "n", "tipo": "int"}], "retorno": "int",
     "casos": [{"entrada": [5], "salida": 120}, ...]}

Tipos admitidos: int, bool, str e int[]. El nombre de la función está en camelCase, como en Java; en
Python se usa su equivalente en snake_case (factorial, suma_digitos).

El estudiante escribe solo la función (y las auxiliares que quiera). La plataforma le agrega los casos de
prueba y envía el programa completo a Judge0. Cada caso imprime una línea con un marcador propio
(@@CASO|n|...), para no confundirla con lo que imprima el estudiante; a partir de esas líneas y del estado
de la ejecución se clasifica el intento en correcto, error de sintaxis, error de ejecución o error lógico,
con el tipo de error normalizado que usa el detector de bloqueos (HU-006, CA1).
"""
import json
import re
from dataclasses import dataclass, field

MARCA = "@@CASO|"
TIPOS = {"int", "bool", "str", "int[]"}  # tipos admitidos en las firmas del banco (los valida test_banco)
JAVA = {"int": "int", "bool": "boolean", "str": "String", "int[]": "int[]"}
VACIO_JAVA = {"int": "0", "bool": "false", "str": '""', "int[]": "new int[0]"}

CORRECTO, SINTAXIS, EJECUCION, LOGICO = "correcto", "error de sintaxis", "error de ejecución", "error lógico"


def snake(nombre: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", nombre).lower()


def nombre_funcion(espec: dict, lenguaje: str) -> str:
    return espec["funcion"] if lenguaje == "java" else snake(espec["funcion"])


# ---------------- Plantilla inicial del editor ----------------

def plantilla(espec: dict, lenguaje: str) -> str:
    """El código con el que arranca el editor: la firma de la función, vacía."""
    if lenguaje == "python":
        params = ", ".join(snake(p["nombre"]) for p in espec["parametros"])
        return f"def {nombre_funcion(espec, 'python')}({params}):\n    # Escribí tu solución acá\n    pass\n"
    params = ", ".join(f"{JAVA[p['tipo']]} {p['nombre']}" for p in espec["parametros"])
    return (f"public static {JAVA[espec['retorno']]} {espec['funcion']}({params}) {{\n"
            f"    // Escribí tu solución acá\n    return {VACIO_JAVA[espec['retorno']]};\n}}\n")


# ---------------- Programa con los casos de prueba ----------------

def _literal_java(valor, tipo: str) -> str:
    if tipo == "bool":
        return "true" if valor else "false"
    if tipo == "str":
        return json.dumps(valor, ensure_ascii=False)  # las comillas y los escapes de JSON valen en Java
    if tipo == "int[]":
        return "new int[]{" + ", ".join(str(v) for v in valor) + "}"
    return str(valor)


def _python(espec: dict, codigo: str) -> str:
    casos = json.dumps([[c["entrada"], c["salida"]] for c in espec["casos"]], ensure_ascii=False)
    f = nombre_funcion(espec, "python")
    return f'''{codigo.rstrip()}


# ---- Casos de prueba (los agrega la plataforma) ----
import json as __json


def __mostrar(valor):
    try:
        return __json.dumps(valor, ensure_ascii=False)
    except TypeError:
        return repr(valor)


for __n, (__entrada, __esperado) in enumerate(__json.loads({casos!r}), 1):
    try:
        __obtenido = {f}(*__entrada)
    except BaseException as __e:
        print("{MARCA}%d|EXCEPCION|%s: %s" % (__n, type(__e).__name__, __e), flush=True)
        continue
    __igual = __obtenido == __esperado and type(__obtenido) is type(__esperado)
    print("{MARCA}%d|%s" % (__n, "OK" if __igual else "FALLA|" + __mostrar(__obtenido)), flush=True)
'''


ENCABEZADO_JAVA = "import java.util.*;\n\npublic class Main {\n"


def _java(espec: dict, codigo: str) -> str:
    ret, f = espec["retorno"], espec["funcion"]
    casos = []
    for n, c in enumerate(espec["casos"], 1):
        args = ", ".join(_literal_java(v, p["tipo"]) for v, p in zip(c["entrada"], espec["parametros"]))
        esperado = _literal_java(c["salida"], ret)
        if ret == "int[]":
            igual = f"Arrays.equals(__r, {esperado})"
        elif ret == "str":
            igual = f"Objects.equals(__r, {esperado})"
        else:
            igual = f"__r == {esperado}"
        casos.append(
            f"        try {{\n"
            f"            {JAVA[ret]} __r = {f}({args});\n"
            f"            System.out.println({igual} ? \"{MARCA}{n}|OK\" : \"{MARCA}{n}|FALLA|\" + __mostrar(__r));\n"
            f"        }} catch (Throwable __e) {{\n"
            f"            System.out.println(\"{MARCA}{n}|EXCEPCION|\" + __e.getClass().getSimpleName() + \": \" + __e.getMessage());\n"
            f"        }}\n")
    return (ENCABEZADO_JAVA + codigo.rstrip() + "\n\n"
            "    // ---- Casos de prueba (los agrega la plataforma) ----\n"
            "    private static String __mostrar(Object v) {\n"
            "        if (v instanceof int[]) return Arrays.toString((int[]) v);\n"
            "        if (v instanceof String) return \"\\\"\" + v + \"\\\"\";\n"
            "        return String.valueOf(v);\n"
            "    }\n\n"
            "    public static void main(String[] args) {\n" + "".join(casos) + "    }\n}\n")


def programa(espec: dict, lenguaje: str, codigo: str) -> str:
    """El programa completo que se ejecuta: el código del estudiante más los casos de prueba."""
    return _java(espec, codigo) if lenguaje == "java" else _python(espec, codigo)


def lineas_antes_del_codigo(lenguaje: str) -> int:
    """Líneas que la plataforma agrega antes del código del estudiante: para informarle la línea correcta."""
    return ENCABEZADO_JAVA.count("\n") if lenguaje == "java" else 0


# ---------------- Clasificación del resultado ----------------

@dataclass
class Ejecucion:
    """Lo que devuelve el ejecutor (Judge0 o el local de desarrollo)."""
    estado: str  # terminado | error de compilación | tiempo límite | error de ejecución
    salida: str = ""
    error: str = ""  # salida de errores (stderr)
    compilacion: str = ""  # mensajes del compilador


@dataclass
class Clasificacion:
    resultado: str  # correcto | error de sintaxis | error de ejecución | error lógico
    tipo_error: str | None  # categoría y mensaje normalizado, o el caso que falla; None si es correcto
    mensaje: str = ""  # lo que se le muestra al estudiante
    casos: list[dict] = field(default_factory=list)  # por caso: n, estado (OK, FALLA, EXCEPCION), detalle


def _casos(salida: str) -> list[dict]:
    casos = []
    for linea in salida.splitlines():
        if linea.startswith(MARCA):
            partes = linea[len(MARCA):].split("|", 2)
            casos.append({"n": int(partes[0]), "estado": partes[1], "detalle": partes[2] if len(partes) > 2 else ""})
    return casos


def _tipo_excepcion(detalle: str) -> str:
    """"RecursionError: maximum recursion depth…" → "RecursionError". El tipo identifica el error;
    el mensaje cambia con los valores y no sirve para decidir si dos errores son el mismo."""
    return detalle.split(":", 1)[0].strip()


def _corregir_lineas(texto: str, lenguaje: str) -> str:
    desplazamiento = lineas_antes_del_codigo(lenguaje)
    if not desplazamiento:
        return texto
    return re.sub(r"Main\.java:(\d+)", lambda m: f"línea {int(m.group(1)) - desplazamiento}", texto)


def clasificar(ejec: Ejecucion, espec: dict, lenguaje: str) -> Clasificacion:
    """Clasifica un intento a partir de la ejecución (HU-006, CA1).

    Prioridad: el código no compila (sintaxis) → no termina a tiempo o lanza una excepción (ejecución)
    → alguna salida no coincide con la esperada (lógico) → correcto. El tipo de error queda como
    "categoría: mensaje" (el mensaje del compilador o el tipo de excepción, sin números de línea) o, en
    los errores lógicos, "lógico: caso n", para comparar intentos consecutivos.
    """
    total = len(espec["casos"])
    if ejec.estado == "error de compilación":  # Java
        m = re.search(r"error: (.+)", ejec.compilacion)
        msg = m.group(1).strip() if m else "error de compilación"
        return Clasificacion(SINTAXIS, f"sintaxis: {msg}", _corregir_lineas(ejec.compilacion.strip(), lenguaje))
    casos = _casos(ejec.salida)
    errores_py = re.findall(r"^(SyntaxError|IndentationError|TabError)\b.*$", ejec.error, re.M)
    if not casos and errores_py:  # Python: el archivo no se pudo interpretar
        ultima = [l for l in ejec.error.strip().splitlines() if l.startswith(errores_py[-1])][-1]
        return Clasificacion(SINTAXIS, f"sintaxis: {ultima.strip()}", ejec.error.strip())
    if ejec.estado == "tiempo límite":
        return Clasificacion(EJECUCION, "ejecución: tiempo límite excedido",
                             "El programa no terminó a tiempo: revisá que los bucles o la recursión terminen.", casos)
    for c in casos:
        if c["estado"] == "EXCEPCION":
            return Clasificacion(EJECUCION, f"ejecución: {_tipo_excepcion(c['detalle'])}",
                                 f"Caso {c['n']}: {c['detalle'].removesuffix(': null')}", casos)
    if len(casos) < total:  # se cortó antes de terminar los casos (p. ej., un error fuera de la función)
        lineas = [l for l in ejec.error.strip().splitlines() if l.strip()]
        ultima = lineas[-1] if lineas else "el programa terminó antes de completar los casos"
        return Clasificacion(EJECUCION, f"ejecución: {_tipo_excepcion(ultima)}",
                             _corregir_lineas(ejec.error.strip() or ultima, lenguaje), casos)
    for c in casos:
        if c["estado"] == "FALLA":
            caso = espec["casos"][c["n"] - 1]
            return Clasificacion(LOGICO, f"lógico: caso {c['n']}",
                                 f"Caso {c['n']}: con {json.dumps(caso['entrada'], ensure_ascii=False)[1:-1]} se esperaba "
                                 f"{json.dumps(caso['salida'], ensure_ascii=False)} y se obtuvo {c['detalle']}.", casos)
    return Clasificacion(CORRECTO, None, f"¡Bien! Pasaste los {total} casos de prueba.", casos)
