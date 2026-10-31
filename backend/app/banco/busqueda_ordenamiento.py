"""Búsqueda y ordenamiento: siete ejercicios (dos básicos, dos intermedios y tres avanzados).

El alcance del prototipo es un algoritmo de búsqueda y uno de ordenamiento: búsqueda binaria y
ordenamiento de burbuja, con la búsqueda lineal como punto de partida.
"""
from . import AVANZADO, BASICO, INTERMEDIO, Ejercicio

ORDENADO = [1, 3, 5, 7, 9, 11]

EJERCICIOS = [
    Ejercicio(
        "Búsqueda lineal", BASICO, 6, "busquedaLineal", [("arr", "int[]"), ("x", "int")], "int",
        "Escribí una función que devuelva la posición de la primera aparición de x en arr, recorriéndolo de "
        "principio a fin, o -1 si x no está.",
        [([[4, 2, 7], 7], 2), ([[4, 2, 7], 5], -1), ([[], 1], -1), ([[3, 3, 3], 3], 0)],
        "def busqueda_lineal(arr, x):\n    for i in range(len(arr)):\n        if arr[i] == x:\n            return i\n"
        "    return -1\n",
        "public static int busquedaLineal(int[] arr, int x) {\n    for (int i = 0; i < arr.length; i++) {\n"
        "        if (arr[i] == x) return i;\n    }\n    return -1;\n}\n",
    ),
    Ejercicio(
        "¿Está ordenado?", BASICO, 8, "estaOrdenado", [("arr", "int[]")], "bool",
        "Escribí una función que indique si arr está ordenado de menor a mayor (se admiten valores repetidos).",
        [([[]], True), ([[1]], True), ([[1, 2, 2, 5]], True), ([[3, 1, 2]], False), ([[1, 2, 3, 0]], False)],
        "def esta_ordenado(arr):\n    for i in range(1, len(arr)):\n        if arr[i - 1] > arr[i]:\n            return False\n"
        "    return True\n",
        "public static boolean estaOrdenado(int[] arr) {\n    for (int i = 1; i < arr.length; i++) {\n"
        "        if (arr[i - 1] > arr[i]) return false;\n    }\n    return true;\n}\n",
    ),
    Ejercicio(
        "Búsqueda binaria", INTERMEDIO, 12, "busquedaBinaria", [("arr", "int[]"), ("x", "int")], "int",
        "arr está ordenado de menor a mayor y no tiene repetidos. Escribí una función que devuelva la posición de x "
        "usando búsqueda binaria con un bucle (en cada paso se descarta la mitad del intervalo), o -1 si no está.",
        [([ORDENADO, 7], 3), ([ORDENADO, 1], 0), ([ORDENADO, 11], 5), ([ORDENADO, 4], -1), ([[], 3], -1)],
        "def busqueda_binaria(arr, x):\n    inicio, fin = 0, len(arr) - 1\n    while inicio <= fin:\n"
        "        medio = (inicio + fin) // 2\n        if arr[medio] == x:\n            return medio\n        if arr[medio] < x:\n"
        "            inicio = medio + 1\n        else:\n            fin = medio - 1\n    return -1\n",
        "public static int busquedaBinaria(int[] arr, int x) {\n    int inicio = 0, fin = arr.length - 1;\n"
        "    while (inicio <= fin) {\n        int medio = (inicio + fin) / 2;\n        if (arr[medio] == x) return medio;\n"
        "        if (arr[medio] < x) inicio = medio + 1; else fin = medio - 1;\n    }\n    return -1;\n}\n",
    ),
    Ejercicio(
        "Ordenamiento de burbuja", INTERMEDIO, 15, "burbuja", [("arr", "int[]")], "int[]",
        "Escribí una función que devuelva arr ordenado de menor a mayor con el algoritmo de burbuja: se recorre el "
        "arreglo intercambiando elementos vecinos que están en el orden equivocado, hasta que no quede ninguno. No "
        "uses funciones de ordenamiento del lenguaje.",
        [([[]], []), ([[1]], [1]), ([[3, 1, 2]], [1, 2, 3]), ([[5, 4, 3, 2, 1]], [1, 2, 3, 4, 5]), ([[2, 9, 2, 0]], [0, 2, 2, 9])],
        "def burbuja(arr):\n    a = list(arr)\n    for i in range(len(a) - 1):\n        for j in range(len(a) - 1 - i):\n"
        "            if a[j] > a[j + 1]:\n                a[j], a[j + 1] = a[j + 1], a[j]\n    return a\n",
        "public static int[] burbuja(int[] arr) {\n    int[] a = arr.clone();\n    for (int i = 0; i < a.length - 1; i++) {\n"
        "        for (int j = 0; j < a.length - 1 - i; j++) {\n            if (a[j] > a[j + 1]) {\n"
        "                int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;\n            }\n        }\n    }\n    return a;\n}\n",
    ),
    Ejercicio(
        "Intercambios de la burbuja", AVANZADO, 18, "intercambiosBurbuja", [("arr", "int[]")], "int",
        "Escribí una función que devuelva cuántos intercambios hace el algoritmo de burbuja para ordenar arr de "
        "menor a mayor.",
        [([[1, 2, 3]], 0), ([[3, 2, 1]], 3), ([[2, 1, 3]], 1), ([[4, 3, 2, 1]], 6), ([[1, 3, 2, 5, 4]], 2)],
        "def intercambios_burbuja(arr):\n    a = list(arr)\n    total = 0\n    for i in range(len(a) - 1):\n"
        "        for j in range(len(a) - 1 - i):\n            if a[j] > a[j + 1]:\n                a[j], a[j + 1] = a[j + 1], a[j]\n"
        "                total += 1\n    return total\n",
        "public static int intercambiosBurbuja(int[] arr) {\n    int[] a = arr.clone();\n    int total = 0;\n"
        "    for (int i = 0; i < a.length - 1; i++) {\n        for (int j = 0; j < a.length - 1 - i; j++) {\n"
        "            if (a[j] > a[j + 1]) {\n                int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;\n"
        "                total++;\n            }\n        }\n    }\n    return total;\n}\n",
    ),
    Ejercicio(
        "Primera aparición", AVANZADO, 20, "primeraAparicion", [("arr", "int[]"), ("x", "int")], "int",
        "arr está ordenado de menor a mayor y puede tener repetidos. Escribí una función que, usando búsqueda "
        "binaria, devuelva la posición de la primera aparición de x, o -1 si no está.",
        [([[1, 2, 2, 2, 3], 2], 1), ([[1, 1, 1], 1], 0), ([[1, 3, 5], 4], -1), ([[], 2], -1), ([[1, 2, 3, 4, 5, 5], 5], 4)],
        "def primera_aparicion(arr, x):\n    inicio, fin, resultado = 0, len(arr) - 1, -1\n    while inicio <= fin:\n"
        "        medio = (inicio + fin) // 2\n        if arr[medio] == x:\n            resultado = medio\n            fin = medio - 1\n"
        "        elif arr[medio] < x:\n            inicio = medio + 1\n        else:\n            fin = medio - 1\n"
        "    return resultado\n",
        "public static int primeraAparicion(int[] arr, int x) {\n    int inicio = 0, fin = arr.length - 1, resultado = -1;\n"
        "    while (inicio <= fin) {\n        int medio = (inicio + fin) / 2;\n        if (arr[medio] == x) {\n"
        "            resultado = medio;\n            fin = medio - 1;\n        } else if (arr[medio] < x) {\n"
        "            inicio = medio + 1;\n        } else {\n            fin = medio - 1;\n        }\n    }\n    return resultado;\n}\n",
    ),
    Ejercicio(
        "Insertar en un arreglo ordenado", AVANZADO, 15, "insertarOrdenado", [("arr", "int[]"), ("x", "int")], "int[]",
        "arr está ordenado de menor a mayor. Escribí una función que devuelva un arreglo nuevo con x insertado en "
        "la posición que mantiene el orden, como en el ordenamiento por inserción.",
        [([[1, 3, 5], 4], [1, 3, 4, 5]), ([[], 2], [2]), ([[2, 4], 1], [1, 2, 4]), ([[2, 4], 9], [2, 4, 9]),
         ([[1, 2, 2], 2], [1, 2, 2, 2])],
        "def insertar_ordenado(arr, x):\n    i = 0\n    while i < len(arr) and arr[i] <= x:\n        i += 1\n"
        "    return arr[:i] + [x] + arr[i:]\n",
        "public static int[] insertarOrdenado(int[] arr, int x) {\n    int[] r = new int[arr.length + 1];\n"
        "    int i = 0;\n    while (i < arr.length && arr[i] <= x) {\n        r[i] = arr[i];\n        i++;\n    }\n"
        "    r[i] = x;\n    for (int j = i; j < arr.length; j++) r[j + 1] = arr[j];\n    return r;\n}\n",
    ),
]
