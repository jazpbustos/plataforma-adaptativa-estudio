"""Recursividad: banco completo de quince ejercicios (cinco por nivel de dificultad)."""
from . import AVANZADO, BASICO, INTERMEDIO, Ejercicio

EJERCICIOS = [
    # ---------------- Básicos ----------------
    Ejercicio(
        "Factorial", BASICO, 8, "factorial", [("n", "int")], "int",
        "Escribí una función recursiva que devuelva el factorial de n (n ≥ 0). Por definición, el factorial de 0 es 1.",
        [([0], 1), ([1], 1), ([5], 120), ([7], 5040), ([10], 3628800)],
        "def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n",
        "public static int factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n",
    ),
    Ejercicio(
        "Suma hasta n", BASICO, 8, "sumaHasta", [("n", "int")], "int",
        "Escribí una función recursiva que devuelva la suma de los números enteros de 1 a n (n ≥ 0). Si n es 0, la suma es 0.",
        [([0], 0), ([1], 1), ([4], 10), ([10], 55), ([100], 5050)],
        "def suma_hasta(n):\n    if n == 0:\n        return 0\n    return n + suma_hasta(n - 1)\n",
        "public static int sumaHasta(int n) {\n    if (n == 0) return 0;\n    return n + sumaHasta(n - 1);\n}\n",
    ),
    Ejercicio(
        "Potencia", BASICO, 10, "potencia", [("base", "int"), ("exponente", "int")], "int",
        "Escribí una función recursiva que calcule base elevado a exponente (exponente ≥ 0) sin usar operadores ni "
        "funciones de potencia del lenguaje.",
        [([2, 0], 1), ([5, 1], 5), ([2, 10], 1024), ([3, 4], 81), ([-2, 3], -8)],
        "def potencia(base, exponente):\n    if exponente == 0:\n        return 1\n    return base * potencia(base, exponente - 1)\n",
        "public static int potencia(int base, int exponente) {\n    if (exponente == 0) return 1;\n    return base * potencia(base, exponente - 1);\n}\n",
    ),
    Ejercicio(
        "Contar dígitos", BASICO, 10, "contarDigitos", [("n", "int")], "int",
        "Escribí una función recursiva que devuelva cuántos dígitos tiene n (n ≥ 0). El número 0 tiene un dígito.",
        [([0], 1), ([7], 1), ([1234], 4), ([100000], 6), ([99], 2)],
        "def contar_digitos(n):\n    if n < 10:\n        return 1\n    return 1 + contar_digitos(n // 10)\n",
        "public static int contarDigitos(int n) {\n    if (n < 10) return 1;\n    return 1 + contarDigitos(n / 10);\n}\n",
    ),
    Ejercicio(
        "Suma de dígitos", BASICO, 10, "sumaDigitos", [("n", "int")], "int",
        "Escribí una función recursiva que devuelva la suma de los dígitos de n (n ≥ 0).",
        [([0], 0), ([9], 9), ([123], 6), ([9045], 18), ([1111], 4)],
        "def suma_digitos(n):\n    if n < 10:\n        return n\n    return n % 10 + suma_digitos(n // 10)\n",
        "public static int sumaDigitos(int n) {\n    if (n < 10) return n;\n    return n % 10 + sumaDigitos(n / 10);\n}\n",
    ),
    # ---------------- Intermedios ----------------
    Ejercicio(
        "Fibonacci", INTERMEDIO, 12, "fibonacci", [("n", "int")], "int",
        "Escribí una función recursiva que devuelva el n-ésimo número de Fibonacci (n ≥ 0), donde fibonacci(0) = 0, "
        "fibonacci(1) = 1 y cada término siguiente es la suma de los dos anteriores.",
        [([0], 0), ([1], 1), ([2], 1), ([7], 13), ([15], 610)],
        "def fibonacci(n):\n    if n < 2:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n",
        "public static int fibonacci(int n) {\n    if (n < 2) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}\n",
    ),
    Ejercicio(
        "Invertir una cadena", INTERMEDIO, 12, "invertirCadena", [("s", "str")], "str",
        "Escribí una función recursiva que devuelva la cadena s invertida, sin usar funciones del lenguaje que la "
        "inviertan directamente.",
        [([""], ""), (["a"], "a"), (["hola"], "aloh"), (["recursión"], "nóisrucer"), (["ab cd"], "dc ba")],
        "def invertir_cadena(s):\n    if len(s) <= 1:\n        return s\n    return invertir_cadena(s[1:]) + s[0]\n",
        "public static String invertirCadena(String s) {\n    if (s.length() <= 1) return s;\n"
        "    return invertirCadena(s.substring(1)) + s.charAt(0);\n}\n",
    ),
    Ejercicio(
        "Palíndromo", INTERMEDIO, 12, "esPalindromo", [("s", "str")], "bool",
        "Escribí una función recursiva que indique si la cadena s se lee igual de izquierda a derecha que de derecha "
        "a izquierda. La cadena vacía y las de un solo carácter son palíndromos.",
        [([""], True), (["a"], True), (["neuquen"], True), (["abba"], True), (["hola"], False), (["abca"], False)],
        "def es_palindromo(s):\n    if len(s) <= 1:\n        return True\n    return s[0] == s[-1] and es_palindromo(s[1:-1])\n",
        "public static boolean esPalindromo(String s) {\n    if (s.length() <= 1) return true;\n"
        "    return s.charAt(0) == s.charAt(s.length() - 1) && esPalindromo(s.substring(1, s.length() - 1));\n}\n",
    ),
    Ejercicio(
        "Máximo común divisor", INTERMEDIO, 12, "mcd", [("a", "int"), ("b", "int")], "int",
        "Escribí una función recursiva que calcule el máximo común divisor de a y b (a, b ≥ 0, no ambos 0) con el "
        "algoritmo de Euclides: el mcd de a y b es el mcd de b y el resto de dividir a por b, y el mcd de a y 0 es a.",
        [([12, 8], 4), ([17, 5], 1), ([100, 75], 25), ([7, 0], 7), ([0, 9], 9)],
        "def mcd(a, b):\n    if b == 0:\n        return a\n    return mcd(b, a % b)\n",
        "public static int mcd(int a, int b) {\n    if (b == 0) return a;\n    return mcd(b, a % b);\n}\n",
    ),
    Ejercicio(
        "Sumar un arreglo", INTERMEDIO, 15, "sumaArreglo", [("arr", "int[]")], "int",
        "Escribí una función recursiva que devuelva la suma de los elementos de arr. Podés escribir una función "
        "auxiliar que reciba además la posición desde la que se suma.",
        [([[]], 0), ([[5]], 5), ([[1, 2, 3, 4]], 10), ([[-3, 7, 1]], 5)],
        "def suma_arreglo(arr):\n    if not arr:\n        return 0\n    return arr[0] + suma_arreglo(arr[1:])\n",
        "public static int sumaArreglo(int[] arr) {\n    return sumaDesde(arr, 0);\n}\n\n"
        "private static int sumaDesde(int[] arr, int i) {\n    if (i == arr.length) return 0;\n"
        "    return arr[i] + sumaDesde(arr, i + 1);\n}\n",
    ),
    # ---------------- Avanzados ----------------
    Ejercicio(
        "Búsqueda binaria recursiva", AVANZADO, 20, "busquedaBinaria", [("arr", "int[]"), ("x", "int")], "int",
        "arr está ordenado de menor a mayor y no tiene elementos repetidos. Escribí una función recursiva que "
        "devuelva la posición de x en arr usando búsqueda binaria, o -1 si x no está. Podés escribir una función "
        "auxiliar que reciba el intervalo en el que se busca.",
        [([[1, 3, 5, 7, 9, 11], 7], 3), ([[1, 3, 5, 7, 9, 11], 1], 0), ([[1, 3, 5, 7, 9, 11], 11], 5),
         ([[1, 3, 5, 7, 9, 11], 4], -1), ([[], 3], -1)],
        "def busqueda_binaria(arr, x):\n    return buscar(arr, x, 0, len(arr) - 1)\n\n\n"
        "def buscar(arr, x, inicio, fin):\n    if inicio > fin:\n        return -1\n    medio = (inicio + fin) // 2\n"
        "    if arr[medio] == x:\n        return medio\n    if arr[medio] < x:\n        return buscar(arr, x, medio + 1, fin)\n"
        "    return buscar(arr, x, inicio, medio - 1)\n",
        "public static int busquedaBinaria(int[] arr, int x) {\n    return buscar(arr, x, 0, arr.length - 1);\n}\n\n"
        "private static int buscar(int[] arr, int x, int inicio, int fin) {\n    if (inicio > fin) return -1;\n"
        "    int medio = (inicio + fin) / 2;\n    if (arr[medio] == x) return medio;\n"
        "    if (arr[medio] < x) return buscar(arr, x, medio + 1, fin);\n    return buscar(arr, x, inicio, medio - 1);\n}\n",
    ),
    Ejercicio(
        "Máximo de un arreglo", AVANZADO, 18, "maximoArreglo", [("arr", "int[]")], "int",
        "arr tiene al menos un elemento. Escribí una función recursiva que devuelva su elemento mayor, sin usar "
        "funciones del lenguaje que lo calculen directamente.",
        [([[3]], 3), ([[1, 9, 4]], 9), ([[-5, -2, -9]], -2), ([[7, 7, 1, 8]], 8), ([[8, 1, 2]], 8)],
        "def maximo_arreglo(arr):\n    if len(arr) == 1:\n        return arr[0]\n    resto = maximo_arreglo(arr[1:])\n"
        "    return arr[0] if arr[0] > resto else resto\n",
        "public static int maximoArreglo(int[] arr) {\n    return maximoDesde(arr, 0);\n}\n\n"
        "private static int maximoDesde(int[] arr, int i) {\n    if (i == arr.length - 1) return arr[i];\n"
        "    int resto = maximoDesde(arr, i + 1);\n    return arr[i] > resto ? arr[i] : resto;\n}\n",
    ),
    Ejercicio(
        "Decimal a binario", AVANZADO, 18, "aBinario", [("n", "int")], "str",
        "Escribí una función recursiva que devuelva la representación en binario de n (n ≥ 0) como cadena, sin "
        "usar funciones del lenguaje que conviertan de base.",
        [([0], "0"), ([1], "1"), ([5], "101"), ([10], "1010"), ([255], "11111111")],
        "def a_binario(n):\n    if n < 2:\n        return str(n)\n    return a_binario(n // 2) + str(n % 2)\n",
        "public static String aBinario(int n) {\n    if (n < 2) return String.valueOf(n);\n"
        "    return aBinario(n / 2) + (n % 2);\n}\n",
    ),
    Ejercicio(
        "Caminos en una grilla", AVANZADO, 20, "contarCaminos", [("filas", "int"), ("columnas", "int")], "int",
        "En una grilla de filas × columnas (ambas ≥ 1) se parte de la esquina superior izquierda y se quiere llegar "
        "a la inferior derecha moviéndose solo hacia la derecha o hacia abajo. Escribí una función recursiva que "
        "devuelva cuántos caminos distintos hay.",
        [([1, 1], 1), ([1, 5], 1), ([2, 2], 2), ([3, 3], 6), ([3, 4], 10), ([4, 4], 20)],
        "def contar_caminos(filas, columnas):\n    if filas == 1 or columnas == 1:\n        return 1\n"
        "    return contar_caminos(filas - 1, columnas) + contar_caminos(filas, columnas - 1)\n",
        "public static int contarCaminos(int filas, int columnas) {\n    if (filas == 1 || columnas == 1) return 1;\n"
        "    return contarCaminos(filas - 1, columnas) + contarCaminos(filas, columnas - 1);\n}\n",
    ),
    Ejercicio(
        "Combinaciones", AVANZADO, 20, "combinaciones", [("n", "int"), ("k", "int")], "int",
        "Escribí una función recursiva que calcule cuántas formas hay de elegir k elementos de un conjunto de n "
        "(0 ≤ k ≤ n), usando la regla del triángulo de Pascal: C(n, k) = C(n − 1, k − 1) + C(n − 1, k), con "
        "C(n, 0) = C(n, n) = 1.",
        [([4, 2], 6), ([5, 0], 1), ([5, 5], 1), ([6, 3], 20), ([10, 3], 120)],
        "def combinaciones(n, k):\n    if k == 0 or k == n:\n        return 1\n"
        "    return combinaciones(n - 1, k - 1) + combinaciones(n - 1, k)\n",
        "public static int combinaciones(int n, int k) {\n    if (k == 0 || k == n) return 1;\n"
        "    return combinaciones(n - 1, k - 1) + combinaciones(n - 1, k);\n}\n",
    ),
]
