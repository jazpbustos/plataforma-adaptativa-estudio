"""Texto de las intervenciones ante un bloqueo (HU-007).

La intervención se escalona en dos niveles, según los principios de retroalimentación formativa de Shute
(2008): primero una pista mínima y específica sobre el error (especificidad) y, si la dificultad persiste,
una explicación más elaborada de por qué ocurre y cómo encararlo (elaboración). Ninguna revela la solución.

Según el criterio de asignación de modelos, las pistas mínimas las redacta Claude Haiku y las explicaciones
elaboradas, Claude Sonnet, a partir del enunciado, el código y el error. Mientras el servicio del modelo de
lenguaje no esté configurado se usan estos textos por categoría de error, que respetan los mismos dos
niveles y sirven además de respaldo si el modelo no responde.
"""
import json


def _caso(espec: dict, tipo_error: str) -> str:
    n = int(tipo_error.rsplit(" ", 1)[-1])
    c = espec["casos"][n - 1]
    entrada = json.dumps(c["entrada"], ensure_ascii=False)[1:-1]
    return f"con {entrada} se esperaba {json.dumps(c['salida'], ensure_ascii=False)}"


def _categoria(tipo_error: str) -> str:
    t = tipo_error.lower()
    if "recursion" in t or "stackoverflow" in t:
        return "recursion"
    if "tiempo límite" in t:
        return "bucle"
    if "cannot find symbol" in t or "nameerror" in t:
        return "nombre"
    if "index" in t or "outofbounds" in t:
        return "indice"
    if "nullpointer" in t or "typeerror" in t or "attributeerror" in t:
        return "tipo"
    if t.startswith("lógico"):
        return "logico"
    if t.startswith("sintaxis"):
        return "sintaxis"
    return "otro"


PISTAS = {
    "recursion": "Fijate qué valor recibe la función en cada llamada. ¿Cambia en algún momento? ¿Qué debería pasar "
                 "para que el problema se achique en cada paso?",
    "bucle": "El programa no termina. Revisá la condición que corta el bucle o la recursión: ¿llega a cumplirse alguna vez?",
    "nombre": "Hay un nombre que no se reconoce. Compará letra por letra cómo lo usás con cómo lo declaraste.",
    "indice": "Se está accediendo a una posición que no existe. ¿Cuál es la primera y cuál la última posición válida?",
    "tipo": "Se está usando un valor de un tipo distinto del que se espera. Revisá qué devuelve cada expresión.",
    "logico": "El código se ejecuta, pero no da lo esperado: {caso}. Seguí a mano qué hace tu función con esos valores.",
    "sintaxis": "El código no compila. Mirá la línea que señala el mensaje y la anterior: suele faltar un símbolo.",
    "otro": "Leé con atención el mensaje de error: indica qué falló y en qué parte del código.",
}

EXPLICACIONES = {
    "recursion": "Una función recursiva necesita dos partes: un caso base, que devuelve un resultado sin volver a "
                 "llamarse, y un caso recursivo, que se llama con un problema más chico. Si cada llamada recibe el "
                 "mismo valor, o uno que nunca llega al caso base, las llamadas se acumulan en la pila hasta "
                 "desbordarla. Escribí primero el caso base y después verificá que el argumento de la llamada "
                 "recursiva se acerque a él en cada paso.",
    "bucle": "Un bucle termina cuando su condición deja de cumplirse, así que algo dentro del bucle tiene que "
             "modificar las variables de esa condición. Anotá los valores de esas variables en las primeras "
             "vueltas: si no cambian, o cambian en la dirección equivocada, el bucle no termina nunca.",
    "nombre": "El compilador o el intérprete busca cada nombre entre las variables y funciones declaradas hasta ese "
              "punto. Si no lo encuentra, es porque está escrito distinto (mayúsculas incluidas), se declaró en "
              "otro bloque o todavía no existe en esa línea. Revisá también el nombre de la función cuando se "
              "llama a sí misma.",
    "indice": "En un arreglo de n elementos las posiciones válidas van de 0 a n − 1. El error aparece cuando un "
              "índice llega a n o queda negativo, muchas veces por una condición con <= en lugar de <, o por "
              "acceder a un arreglo vacío. Revisá los extremos del recorrido y el caso del arreglo vacío.",
    "tipo": "Cada operación espera valores de cierto tipo. El error indica que alguna expresión produce un valor "
            "distinto del esperado, por ejemplo un número donde se espera una lista o un valor nulo. Revisá qué "
            "devuelve cada llamada y qué tipo tiene cada variable en el punto del error.",
    "logico": "Cuando el código se ejecuta pero el resultado no coincide, conviene comparar paso a paso lo que "
              "hace con lo que debería hacer: {caso}. Seguí la ejecución con esos valores anotando cada variable. "
              "Prestá atención a los casos límite (el primer y el último elemento, el valor 0, la cadena o el "
              "arreglo vacío), que son donde suele estar la diferencia.",
    "sintaxis": "Un error de compilación impide ejecutar el programa: el lenguaje no puede interpretar alguna parte "
                "del código. El mensaje indica la línea y qué esperaba encontrar. Revisá que cada llave, paréntesis "
                "y bloque esté cerrado, que las sentencias terminen como corresponde en el lenguaje y que las "
                "palabras reservadas estén bien escritas.",
    "otro": "El mensaje de error describe qué falló. Identificá en qué línea ocurre, qué valores tienen las "
            "variables en ese momento y qué operación no se pudo realizar; a partir de eso, revisá la lógica de "
            "esa parte del código.",
}


def texto_intervencion(nivel: int, espec: dict, tipo_error: str) -> str:
    """Pista mínima (nivel 1) o explicación elaborada (nivel 2) sobre el error que originó el bloqueo."""
    cat = _categoria(tipo_error or "")
    plantilla = (PISTAS if nivel == 1 else EXPLICACIONES)[cat]
    return plantilla.format(caso=_caso(espec, tipo_error) if cat == "logico" else "")
