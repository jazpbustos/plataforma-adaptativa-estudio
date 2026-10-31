"""Sintaxis y estructuras de control: siete ejercicios (dos básicos, dos intermedios y tres avanzados)."""
from . import AVANZADO, BASICO, INTERMEDIO, Ejercicio

EJERCICIOS = [
    Ejercicio(
        "Par o impar", BASICO, 5, "esPar", [("n", "int")], "bool",
        "Escribí una función que indique si el número entero n es par.",
        [([4], True), ([7], False), ([0], True), ([-3], False), ([-8], True)],
        "def es_par(n):\n    return n % 2 == 0\n",
        "public static boolean esPar(int n) {\n    return n % 2 == 0;\n}\n",
    ),
    Ejercicio(
        "Mayor de tres", BASICO, 6, "mayorDeTres", [("a", "int"), ("b", "int"), ("c", "int")], "int",
        "Escribí una función que devuelva el mayor de los tres números, usando condicionales y sin funciones del "
        "lenguaje que calculen el máximo.",
        [([1, 2, 3], 3), ([9, 4, 2], 9), ([5, 8, 1], 8), ([-1, -5, -3], -1), ([4, 4, 2], 4)],
        "def mayor_de_tres(a, b, c):\n    mayor = a\n    if b > mayor:\n        mayor = b\n    if c > mayor:\n"
        "        mayor = c\n    return mayor\n",
        "public static int mayorDeTres(int a, int b, int c) {\n    int mayor = a;\n    if (b > mayor) mayor = b;\n"
        "    if (c > mayor) mayor = c;\n    return mayor;\n}\n",
    ),
    Ejercicio(
        "Suma de pares", INTERMEDIO, 8, "sumaPares", [("n", "int")], "int",
        "Escribí una función que devuelva, usando un bucle, la suma de los números pares entre 1 y n (n ≥ 0).",
        [([0], 0), ([1], 0), ([4], 6), ([10], 30), ([11], 30)],
        "def suma_pares(n):\n    total = 0\n    for i in range(2, n + 1, 2):\n        total += i\n    return total\n",
        "public static int sumaPares(int n) {\n    int total = 0;\n    for (int i = 2; i <= n; i += 2) total += i;\n"
        "    return total;\n}\n",
    ),
    Ejercicio(
        "Contar vocales", INTERMEDIO, 10, "contarVocales", [("s", "str")], "int",
        "Escribí una función que cuente cuántas vocales (a, e, i, o, u, en minúscula o mayúscula y sin tilde) tiene "
        "la cadena s.",
        [(["hola"], 2), (["programacion"], 5), (["xyz"], 0), (["AEIOU"], 5), ([""], 0)],
        "def contar_vocales(s):\n    total = 0\n    for c in s:\n        if c in 'aeiouAEIOU':\n            total += 1\n"
        "    return total\n",
        "public static int contarVocales(String s) {\n    int total = 0;\n    for (char c : s.toCharArray()) {\n"
        "        if (\"aeiouAEIOU\".indexOf(c) >= 0) total++;\n    }\n    return total;\n}\n",
    ),
    Ejercicio(
        "Número primo", AVANZADO, 12, "esPrimo", [("n", "int")], "bool",
        "Escribí una función que indique si n es primo, es decir, si es mayor que 1 y solo es divisible por 1 y por "
        "sí mismo.",
        [([1], False), ([2], True), ([17], True), ([21], False), ([97], True), ([0], False)],
        "def es_primo(n):\n    if n < 2:\n        return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n"
        "            return False\n        i += 1\n    return True\n",
        "public static boolean esPrimo(int n) {\n    if (n < 2) return false;\n    for (int i = 2; i * i <= n; i++) {\n"
        "        if (n % i == 0) return false;\n    }\n    return true;\n}\n",
    ),
    Ejercicio(
        "FizzBuzz", AVANZADO, 10, "fizzBuzz", [("n", "int")], "str",
        "Escribí una función que devuelva \"FizzBuzz\" si n es múltiplo de 3 y de 5, \"Fizz\" si solo es múltiplo de "
        "3, \"Buzz\" si solo es múltiplo de 5 y, en otro caso, el número como cadena.",
        [([3], "Fizz"), ([5], "Buzz"), ([15], "FizzBuzz"), ([7], "7"), ([30], "FizzBuzz"), ([9], "Fizz")],
        "def fizz_buzz(n):\n    if n % 15 == 0:\n        return 'FizzBuzz'\n    if n % 3 == 0:\n        return 'Fizz'\n"
        "    if n % 5 == 0:\n        return 'Buzz'\n    return str(n)\n",
        "public static String fizzBuzz(int n) {\n    if (n % 15 == 0) return \"FizzBuzz\";\n"
        "    if (n % 3 == 0) return \"Fizz\";\n    if (n % 5 == 0) return \"Buzz\";\n    return String.valueOf(n);\n}\n",
    ),
    Ejercicio(
        "Invertir un número", AVANZADO, 12, "invertirNumero", [("n", "int")], "int",
        "Escribí una función que devuelva el número n (n ≥ 0) con sus dígitos en orden inverso, usando un bucle y "
        "operaciones aritméticas, sin convertirlo a cadena. Los ceros que quedan adelante se descartan.",
        [([1234], 4321), ([7], 7), ([1200], 21), ([0], 0), ([105], 501)],
        "def invertir_numero(n):\n    invertido = 0\n    while n > 0:\n        invertido = invertido * 10 + n % 10\n"
        "        n //= 10\n    return invertido\n",
        "public static int invertirNumero(int n) {\n    int invertido = 0;\n    while (n > 0) {\n"
        "        invertido = invertido * 10 + n % 10;\n        n /= 10;\n    }\n    return invertido;\n}\n",
    ),
]
