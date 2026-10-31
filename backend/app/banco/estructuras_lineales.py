"""Estructuras de datos lineales: siete ejercicios (dos básicos, dos intermedios y tres avanzados)."""
from . import AVANZADO, BASICO, INTERMEDIO, Ejercicio

EJERCICIOS = [
    Ejercicio(
        "Sumar los elementos", BASICO, 6, "sumaElementos", [("arr", "int[]")], "int",
        "Escribí una función que devuelva la suma de los elementos del arreglo arr, recorriéndolo con un bucle.",
        [([[]], 0), ([[4]], 4), ([[1, 2, 3]], 6), ([[-1, 5, -2]], 2)],
        "def suma_elementos(arr):\n    total = 0\n    for x in arr:\n        total += x\n    return total\n",
        "public static int sumaElementos(int[] arr) {\n    int total = 0;\n    for (int x : arr) total += x;\n"
        "    return total;\n}\n",
    ),
    Ejercicio(
        "Mayor elemento", BASICO, 8, "mayor", [("arr", "int[]")], "int",
        "arr tiene al menos un elemento. Escribí una función que devuelva el mayor valor del arreglo, sin usar "
        "funciones del lenguaje que lo calculen directamente.",
        [([[3, 7, 2]], 7), ([[-4, -1, -9]], -1), ([[5]], 5), ([[2, 8, 8, 1]], 8)],
        "def mayor(arr):\n    m = arr[0]\n    for x in arr:\n        if x > m:\n            m = x\n    return m\n",
        "public static int mayor(int[] arr) {\n    int m = arr[0];\n    for (int x : arr) if (x > m) m = x;\n"
        "    return m;\n}\n",
    ),
    Ejercicio(
        "Invertir un arreglo", INTERMEDIO, 10, "invertirArreglo", [("arr", "int[]")], "int[]",
        "Escribí una función que devuelva un arreglo nuevo con los elementos de arr en orden inverso.",
        [([[]], []), ([[1]], [1]), ([[1, 2, 3]], [3, 2, 1]), ([[4, 9, 9, 0]], [0, 9, 9, 4])],
        "def invertir_arreglo(arr):\n    resultado = []\n    for i in range(len(arr) - 1, -1, -1):\n"
        "        resultado.append(arr[i])\n    return resultado\n",
        "public static int[] invertirArreglo(int[] arr) {\n    int[] resultado = new int[arr.length];\n"
        "    for (int i = 0; i < arr.length; i++) resultado[i] = arr[arr.length - 1 - i];\n    return resultado;\n}\n",
    ),
    Ejercicio(
        "Contar mayores", INTERMEDIO, 10, "contarMayores", [("arr", "int[]"), ("x", "int")], "int",
        "Escribí una función que cuente cuántos elementos de arr son estrictamente mayores que x.",
        [([[1, 5, 3, 8], 4], 2), ([[], 1], 0), ([[2, 2, 2], 2], 0), ([[10, -1, 7], 0], 2)],
        "def contar_mayores(arr, x):\n    total = 0\n    for v in arr:\n        if v > x:\n            total += 1\n"
        "    return total\n",
        "public static int contarMayores(int[] arr, int x) {\n    int total = 0;\n    for (int v : arr) if (v > x) total++;\n"
        "    return total;\n}\n",
    ),
    Ejercicio(
        "Paréntesis balanceados", AVANZADO, 18, "balanceado", [("s", "str")], "bool",
        "s contiene solo los caracteres ( ) [ ] { }. Escribí una función que, usando una pila, indique si están "
        "balanceados: cada apertura tiene su cierre del mismo tipo y en el orden correcto.",
        [(["()"], True), (["([]{})"], True), (["{[()()]}"], True), ([""], True), (["(]"], False), (["(()"], False),
         ([")("], False)],
        "def balanceado(s):\n    pares = {')': '(', ']': '[', '}': '{'}\n    pila = []\n    for c in s:\n"
        "        if c in '([{':\n            pila.append(c)\n        elif not pila or pila.pop() != pares[c]:\n"
        "            return False\n    return not pila\n",
        "public static boolean balanceado(String s) {\n    Deque<Character> pila = new ArrayDeque<>();\n"
        "    for (char c : s.toCharArray()) {\n        if (c == '(' || c == '[' || c == '{') {\n            pila.push(c);\n"
        "        } else {\n            if (pila.isEmpty()) return false;\n            char a = pila.pop();\n"
        "            if ((c == ')' && a != '(') || (c == ']' && a != '[') || (c == '}' && a != '{')) return false;\n"
        "        }\n    }\n    return pila.isEmpty();\n}\n",
    ),
    Ejercicio(
        "Evaluar una expresión postfija", AVANZADO, 20, "evaluarPostfija", [("expresion", "str")], "int",
        "expresion es una expresión en notación postfija con números enteros no negativos y los operadores + − *, "
        "separados por un espacio (por ejemplo, \"3 4 + 2 *\" vale 14). Escribí una función que la evalúe usando "
        "una pila.",
        [(["3 4 +"], 7), (["3 4 + 2 *"], 14), (["5 1 2 + 4 * + 3 -"], 14), (["9"], 9), (["10 2 -"], 8)],
        "def evaluar_postfija(expresion):\n    pila = []\n    for t in expresion.split():\n        if t in '+-*':\n"
        "            b = pila.pop()\n            a = pila.pop()\n            if t == '+':\n                pila.append(a + b)\n"
        "            elif t == '-':\n                pila.append(a - b)\n            else:\n                pila.append(a * b)\n"
        "        else:\n            pila.append(int(t))\n    return pila.pop()\n",
        "public static int evaluarPostfija(String expresion) {\n    Deque<Integer> pila = new ArrayDeque<>();\n"
        "    for (String t : expresion.split(\" \")) {\n        if (t.equals(\"+\") || t.equals(\"-\") || t.equals(\"*\")) {\n"
        "            int b = pila.pop(), a = pila.pop();\n"
        "            pila.push(t.equals(\"+\") ? a + b : t.equals(\"-\") ? a - b : a * b);\n"
        "        } else {\n            pila.push(Integer.parseInt(t));\n        }\n    }\n    return pila.pop();\n}\n",
    ),
    Ejercicio(
        "Rotar con una cola", AVANZADO, 15, "rotarIzquierda", [("arr", "int[]"), ("k", "int")], "int[]",
        "arr tiene al menos un elemento y k ≥ 0. Escribí una función que, usando una cola, devuelva el arreglo "
        "rotado k posiciones hacia la izquierda: en cada paso el primer elemento pasa al final.",
        [([[1, 2, 3, 4, 5], 2], [3, 4, 5, 1, 2]), ([[1, 2, 3], 0], [1, 2, 3]), ([[1, 2, 3], 3], [1, 2, 3]),
         ([[7], 5], [7]), ([[1, 2, 3, 4], 5], [2, 3, 4, 1])],
        "from collections import deque\n\n\ndef rotar_izquierda(arr, k):\n    cola = deque(arr)\n    for _ in range(k):\n"
        "        cola.append(cola.popleft())\n    return list(cola)\n",
        "public static int[] rotarIzquierda(int[] arr, int k) {\n    Deque<Integer> cola = new ArrayDeque<>();\n"
        "    for (int x : arr) cola.addLast(x);\n    for (int i = 0; i < k; i++) cola.addLast(cola.pollFirst());\n"
        "    int[] resultado = new int[arr.length];\n    for (int i = 0; i < resultado.length; i++) resultado[i] = cola.pollFirst();\n"
        "    return resultado;\n}\n",
    ),
]
