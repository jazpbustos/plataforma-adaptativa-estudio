# Evaluación de la recuperación (HU-003)

Cada sección es una medición de `python -m app.evaluar` sobre `evaluacion/consultas.json`, con los parámetros de `parametros.toml` vigentes en ese momento.

## inicial · 2026-10-25 11:44

Parámetros: tam_fragmento = 400, solapamiento = 60, k_por_fuente = 6, similitud_minima = 0.5, fragmentos_minimos = 2; modelo sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2; 3385 fragmentos académicos.

| umbral | acierto@1 | acierto@6 | mrr | positivas suficientes | rechazo de negativas | concentración |
|---|---|---|---|---|---|---|
| 0.4 | 0.5 | 0.833 | 0.617 | 0.958 | 0.6 | 0.602 |
| 0.45 | 0.458 | 0.792 | 0.576 | 0.958 | 0.8 | 0.569 |
| **0.5** (actual) | 0.458 | 0.667 | 0.531 | 0.792 | 0.8 | 0.534 |
| 0.55 | 0.417 | 0.583 | 0.468 | 0.75 | 0.8 | 0.532 |
| 0.6 | 0.375 | 0.542 | 0.426 | 0.708 | 1 | 0.5 |

Similitud del fragmento más parecido (sin umbral):

| consultas | n | mínimo | máximo | promedio |
|---|---|---|---|---|
| positivas | 24 | 0.411 | 0.89 | 0.685 |
| negativas | 5 | 0.377 | 0.634 | 0.444 |

Detalle por consulta (posición del primer acierto con el umbral 0.5 y sin umbral):

| id | consulta | pos. | pos. sin umbral | sim. máx. | sim. 1.er acierto | suficiente | primer fragmento |
|---|---|---|---|---|---|---|---|
| R01 | ¿Qué es el caso base y por qué toda función recursiva lo necesita? | 2 | 2 | 0.784 | 0.767 | sí | Think Python ·  y recursividad (5.8 a 5.10) · 5.13. Glossary |
| R02 | ¿Qué es el caso recursivo y cómo hace para acercarse al caso base? | 1 | 1 | 0.738 | 0.738 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R03 | ¿Qué pasa si una función recursiva no tiene caso base? | 5 | 5 | 0.817 | 0.759 | sí | Think Python ·  y recursividad (5.8 a 5.10) · 5.13. Glossary |
| R04 | ¿Cómo se guarda cada llamada recursiva en la pila de llamadas? | – | – | 0.713 | – | sí | Composing Programs · 1.7 Recursive Functions · Tree Recursion |
| R05 | ¿Qué error tira Python cuando hay un desbordamiento de pila por demasiadas llamadas recursivas? | 1 | 1 | 0.771 | 0.771 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R06 | ¿Cómo cambio el límite de recursión en Python? | 1 | 1 | 0.89 | 0.89 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R07 | ¿Cómo se calcula el factorial de un número con una función recursiva? | 1 | 1 | 0.747 | 0.747 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R08 | ¿Por qué el Fibonacci recursivo es tan lento y repite cálculos? | 3 | 3 | 0.766 | 0.721 | sí | Algorithms · Cap. 3: Dynamic Programming · pág. 7 |
| R09 | ¿Cómo se resuelven las torres de Hanoi con recursión? | 1 | 1 | 0.745 | 0.745 | sí | Problem Solving with Algorithms and Data Structures using Python · 4.10 Tower of Hanoi · 4.10. Tower of Hanoi |
| R10 | ¿Qué es la recursión de cola? | – | – | 0.774 | – | sí | Think Java · vos (8.2 a 8.4) · 8.3 Value-Returning Methods |
| R11 | ¿Qué es la memoización y cómo evita recalcular resultados? | – | 4 | 0.595 | 0.493 | sí | Structure and Interpretation of Computer Programs · They Generate (1.2.1) · Probabilistic methods |
| R12 | ¿Cómo convierto una función recursiva en una iterativa con un bucle? | – | – | 0.752 | – | sí | Problem Solving with Algorithms and Data Structures using Python ·  Recursion · 4.4. The Three Laws of Recursion |
| R13 | ¿Qué es la recursión mutua entre dos funciones? | 5 | 5 | 0.72 | 0.7 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R14 | ¿Cómo sumo los elementos de una lista de forma recursiva? | – | – | 0.688 | – | sí | Problem Solving with Algorithms and Data Structures using Python ·  Recursion · 4.4. The Three Laws of Recursion |
| R15 | ¿Qué significa el salto de fe cuando escribo una función recursiva? | 1 | 1 | 0.728 | 0.728 | sí | Think Java · ecursivos (8.2 a 8.4) · 8.4 The Leap of Faith |
| S01 | ¿Cuál es la diferencia entre un bucle while y un bucle for? | 2 | 2 | 0.55 | 0.545 | sí | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S02 | ¿Para qué sirven break y continue dentro de un bucle? | 1 | 1 | 0.555 | 0.555 | no ✗ | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S03 | ¿Cómo funciona la sentencia switch en Java? | – | 3 | 0.489 | 0.48 | no ✗ | Think Java · Cap. 3: Entrada y salida |
| L01 | ¿Qué diferencia hay entre una pila y una cola? | – | 1 | 0.411 | 0.411 | no ✗ | Introduction to Programming Using Java ·  9.3: Stacks, Queues, and ADTs · 9.3.2 Queues |
| L02 | ¿Cómo uso una lista de Python como si fuera una pila? | 1 | 1 | 0.732 | 0.732 | sí | Problem Solving with Algorithms and Data Structures using Python ·  Python · 3.5. Implementing a Stack in Python |
| L03 | ¿Cómo recorro todos los elementos de un arreglo en Java? | – | 2 | 0.476 | 0.474 | no ✗ | Think Java · rreglos y referencias · 7.3 Displaying Arrays |
| B01 | ¿Cómo funciona la búsqueda binaria y por qué la lista tiene que estar ordenada? | 1 | 1 | 0.796 | 0.796 | sí | Introduction to Programming Using Java ·  7.5: Searching and Sorting · 7.5.1 Searching |
| B02 | ¿Cómo funciona el ordenamiento burbuja? | 1 | 1 | 0.688 | 0.688 | sí | Problem Solving with Algorithms and Data Structures using Python · 5.7 The Bubble Sort · 5.7. The Bubble Sort |
| B03 | ¿Qué diferencia hay entre el ordenamiento por inserción y el de selección? | 1 | 1 | 0.519 | 0.519 | no ✗ | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.3 Insertion Sort |
| N01 | ¿Cómo funciona una tabla hash? | – | – | 0.377 | – | no | Documentación de PostgreSQL · .8.3. Common Table Expression Materialization |
| N02 | ¿Cómo funciona el ordenamiento burbuja? | – | – | 0.407 | – | no | Algorithms · Cap. 3: Dynamic Programming · pág. 11 |
| N03 | ¿Cómo armo una ventana con botones en una interfaz gráfica? | – | – | 0.395 | – | no | Think Java · vos (8.2 a 8.4) · 8.7 Recursive Binary Method |
| N04 | ¿Cómo hago que una clase herede los métodos de otra? | – | – | 0.634 | – | sí ✗ | Documentación oficial de Python · jo · 4.10. Intermezzo: Estilo de programación |
| N05 | ¿Cómo funciona el merge sort? | – | – | 0.409 | – | no | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.4 Selection Sort |

## limpieza · 2026-10-25 11:59

Parámetros: tam_fragmento = 400, solapamiento = 60, k_por_fuente = 6, similitud_minima = 0.5, fragmentos_minimos = 2; modelo sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2; 3227 fragmentos académicos.

| umbral | acierto@1 | acierto@6 | mrr | positivas suficientes | rechazo de negativas | concentración |
|---|---|---|---|---|---|---|
| 0.4 | 0.5 | 0.875 | 0.623 | 0.958 | 0.6 | 0.607 |
| 0.45 | 0.458 | 0.833 | 0.581 | 0.958 | 0.8 | 0.576 |
| **0.5** (actual) | 0.458 | 0.708 | 0.529 | 0.792 | 0.8 | 0.542 |
| 0.55 | 0.417 | 0.625 | 0.467 | 0.75 | 0.8 | 0.54 |
| 0.6 | 0.375 | 0.583 | 0.425 | 0.708 | 1 | 0.509 |

Similitud del fragmento más parecido (sin umbral):

| consultas | n | mínimo | máximo | promedio |
|---|---|---|---|---|
| positivas | 24 | 0.411 | 0.89 | 0.687 |
| negativas | 5 | 0.377 | 0.634 | 0.446 |

Detalle por consulta (posición del primer acierto con el umbral 0.5 y sin umbral):

| id | consulta | pos. | pos. sin umbral | sim. máx. | sim. 1.er acierto | suficiente | primer fragmento |
|---|---|---|---|---|---|---|---|
| R01 | ¿Qué es el caso base y por qué toda función recursiva lo necesita? | 3 | 3 | 0.785 | 0.767 | sí | Algorithms · Cap. 1: Recursion · pág. 47 |
| R02 | ¿Qué es el caso recursivo y cómo hace para acercarse al caso base? | 1 | 1 | 0.738 | 0.738 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R03 | ¿Qué pasa si una función recursiva no tiene caso base? | 6 | 6 | 0.817 | 0.759 | sí | Think Python ·  y recursividad (5.8 a 5.10) · 5.13. Glossary |
| R04 | ¿Cómo se guarda cada llamada recursiva en la pila de llamadas? | – | – | 0.713 | – | sí | Composing Programs · 1.7 Recursive Functions · Tree Recursion |
| R05 | ¿Qué error tira Python cuando hay un desbordamiento de pila por demasiadas llamadas recursivas? | 1 | 1 | 0.771 | 0.771 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R06 | ¿Cómo cambio el límite de recursión en Python? | 1 | 1 | 0.89 | 0.89 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R07 | ¿Cómo se calcula el factorial de un número con una función recursiva? | 1 | 1 | 0.765 | 0.765 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R08 | ¿Por qué el Fibonacci recursivo es tan lento y repite cálculos? | 3 | 3 | 0.755 | 0.726 | sí | Algorithms · Cap. 3: Dynamic Programming · pág. 2 |
| R09 | ¿Cómo se resuelven las torres de Hanoi con recursión? | 1 | 1 | 0.745 | 0.745 | sí | Problem Solving with Algorithms and Data Structures using Python · 4.10 Tower of Hanoi · 4.10. Tower of Hanoi |
| R10 | ¿Qué es la recursión de cola? | – | – | 0.774 | – | sí | Think Java · vos (8.2 a 8.4) · 8.3 Value-Returning Methods |
| R11 | ¿Qué es la memoización y cómo evita recalcular resultados? | – | 4 | 0.595 | 0.493 | sí | Structure and Interpretation of Computer Programs · They Generate (1.2.1) · Probabilistic methods |
| R12 | ¿Cómo convierto una función recursiva en una iterativa con un bucle? | – | – | 0.762 | – | sí | Composing Programs · Recursive Functions · 1.7 Recursive Functions |
| R13 | ¿Qué es la recursión mutua entre dos funciones? | 6 | 6 | 0.776 | 0.7 | sí | Composing Programs · Recursive Functions · 1.7 Recursive Functions |
| R14 | ¿Cómo sumo los elementos de una lista de forma recursiva? | 5 | 5 | 0.675 | 0.633 | sí | Algorithms · Cap. 2: Backtracking · pág. 7 |
| R15 | ¿Qué significa el salto de fe cuando escribo una función recursiva? | 1 | 1 | 0.728 | 0.728 | sí | Think Java · ecursivos (8.2 a 8.4) · 8.4 The Leap of Faith |
| S01 | ¿Cuál es la diferencia entre un bucle while y un bucle for? | 2 | 2 | 0.55 | 0.545 | sí | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S02 | ¿Para qué sirven break y continue dentro de un bucle? | 1 | 1 | 0.555 | 0.555 | no ✗ | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S03 | ¿Cómo funciona la sentencia switch en Java? | – | 2 | 0.483 | 0.48 | no ✗ | Think Java · 3: Entrada y salida · 3.7 Type Cast Operators |
| L01 | ¿Qué diferencia hay entre una pila y una cola? | – | 1 | 0.411 | 0.411 | no ✗ | Introduction to Programming Using Java ·  9.3: Stacks, Queues, and ADTs · 9.3.2 Queues |
| L02 | ¿Cómo uso una lista de Python como si fuera una pila? | 1 | 1 | 0.732 | 0.732 | sí | Problem Solving with Algorithms and Data Structures using Python ·  Python · 3.5. Implementing a Stack in Python |
| L03 | ¿Cómo recorro todos los elementos de un arreglo en Java? | – | 2 | 0.476 | 0.474 | no ✗ | Think Java · rreglos y referencias · 7.3 Displaying Arrays |
| B01 | ¿Cómo funciona la búsqueda binaria y por qué la lista tiene que estar ordenada? | 1 | 1 | 0.796 | 0.796 | sí | Introduction to Programming Using Java ·  7.5: Searching and Sorting · 7.5.1 Searching |
| B02 | ¿Cómo funciona el ordenamiento burbuja? | 1 | 1 | 0.688 | 0.688 | sí | Problem Solving with Algorithms and Data Structures using Python · 5.7 The Bubble Sort · 5.7. The Bubble Sort |
| B03 | ¿Qué diferencia hay entre el ordenamiento por inserción y el de selección? | 1 | 1 | 0.519 | 0.519 | no ✗ | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.3 Insertion Sort |
| N01 | ¿Cómo funciona una tabla hash? | – | – | 0.377 | – | no | Documentación de PostgreSQL · .8.3. Common Table Expression Materialization |
| N02 | ¿Cómo funciona el ordenamiento burbuja? | – | – | 0.416 | – | no | Algorithms · Cap. 3: Dynamic Programming · pág. 11 |
| N03 | ¿Cómo armo una ventana con botones en una interfaz gráfica? | – | – | 0.395 | – | no | Think Java · vos (8.2 a 8.4) · 8.7 Recursive Binary Method |
| N04 | ¿Cómo hago que una clase herede los métodos de otra? | – | – | 0.634 | – | sí ✗ | Documentación oficial de Python · jo · 4.10. Intermezzo: Estilo de programación |
| N05 | ¿Cómo funciona el merge sort? | – | – | 0.409 | – | no | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.4 Selection Sort |

## vecinos · 2026-10-25 12:09

Parámetros: tam_fragmento = 400, solapamiento = 60, k_por_fuente = 6, similitud_minima = 0.5, fragmentos_minimos = 2; modelo sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2; 3212 fragmentos académicos.

| umbral | acierto@1 | acierto@6 | mrr | positivas suficientes | rechazo de negativas | concentración |
|---|---|---|---|---|---|---|
| 0.4 | 0.5 | 0.875 | 0.637 | 0.958 | 0.6 | 0.61 |
| 0.45 | 0.458 | 0.833 | 0.595 | 0.958 | 0.8 | 0.584 |
| **0.5** (actual) | 0.458 | 0.708 | 0.543 | 0.792 | 0.8 | 0.555 |
| 0.55 | 0.417 | 0.625 | 0.481 | 0.75 | 0.8 | 0.554 |
| 0.6 | 0.375 | 0.583 | 0.439 | 0.708 | 1 | 0.526 |

Similitud del fragmento más parecido (sin umbral):

| consultas | n | mínimo | máximo | promedio |
|---|---|---|---|---|
| positivas | 24 | 0.411 | 0.89 | 0.687 |
| negativas | 5 | 0.377 | 0.634 | 0.446 |

Detalle por consulta (posición del primer acierto con el umbral 0.5 y sin umbral):

| id | consulta | pos. | pos. sin umbral | sim. máx. | sim. 1.er acierto | suficiente | primer fragmento |
|---|---|---|---|---|---|---|---|
| R01 | ¿Qué es el caso base y por qué toda función recursiva lo necesita? | 2 | 2 | 0.784 | 0.767 | sí | Think Python ·  y recursividad (5.8 a 5.10) · 5.13. Glossary |
| R02 | ¿Qué es el caso recursivo y cómo hace para acercarse al caso base? | 1 | 1 | 0.738 | 0.738 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R03 | ¿Qué pasa si una función recursiva no tiene caso base? | 6 | 6 | 0.817 | 0.759 | sí | Think Python ·  y recursividad (5.8 a 5.10) · 5.13. Glossary |
| R04 | ¿Cómo se guarda cada llamada recursiva en la pila de llamadas? | – | – | 0.713 | – | sí | Composing Programs · 1.7 Recursive Functions · Tree Recursion |
| R05 | ¿Qué error tira Python cuando hay un desbordamiento de pila por demasiadas llamadas recursivas? | 1 | 1 | 0.771 | 0.771 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R06 | ¿Cómo cambio el límite de recursión en Python? | 1 | 1 | 0.89 | 0.89 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R07 | ¿Cómo se calcula el factorial de un número con una función recursiva? | 1 | 1 | 0.765 | 0.765 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R08 | ¿Por qué el Fibonacci recursivo es tan lento y repite cálculos? | 3 | 3 | 0.77 | 0.721 | sí | Algorithms · Cap. 3: Dynamic Programming · pág. 2 |
| R09 | ¿Cómo se resuelven las torres de Hanoi con recursión? | 1 | 1 | 0.745 | 0.745 | sí | Problem Solving with Algorithms and Data Structures using Python · 4.10 Tower of Hanoi · 4.10. Tower of Hanoi |
| R10 | ¿Qué es la recursión de cola? | – | – | 0.774 | – | sí | Think Java · vos (8.2 a 8.4) · 8.3 Value-Returning Methods |
| R11 | ¿Qué es la memoización y cómo evita recalcular resultados? | – | 4 | 0.595 | 0.493 | sí | Structure and Interpretation of Computer Programs · They Generate (1.2.1) · Probabilistic methods |
| R12 | ¿Cómo convierto una función recursiva en una iterativa con un bucle? | – | – | 0.762 | – | sí | Composing Programs · Recursive Functions · 1.7 Recursive Functions |
| R13 | ¿Qué es la recursión mutua entre dos funciones? | 5 | 5 | 0.776 | 0.7 | sí | Composing Programs · Recursive Functions · 1.7 Recursive Functions |
| R14 | ¿Cómo sumo los elementos de una lista de forma recursiva? | 3 | 3 | 0.653 | 0.633 | sí | Introduction to Programming Using Java · .1: Recursión · 9.1.1 Recursive Binary Search |
| R15 | ¿Qué significa el salto de fe cuando escribo una función recursiva? | 1 | 1 | 0.728 | 0.728 | sí | Think Java · ecursivos (8.2 a 8.4) · 8.4 The Leap of Faith |
| S01 | ¿Cuál es la diferencia entre un bucle while y un bucle for? | 2 | 2 | 0.55 | 0.545 | sí | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S02 | ¿Para qué sirven break y continue dentro de un bucle? | 1 | 1 | 0.555 | 0.555 | no ✗ | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S03 | ¿Cómo funciona la sentencia switch en Java? | – | 2 | 0.483 | 0.48 | no ✗ | Think Java · 3: Entrada y salida · 3.7 Type Cast Operators |
| L01 | ¿Qué diferencia hay entre una pila y una cola? | – | 1 | 0.411 | 0.411 | no ✗ | Introduction to Programming Using Java ·  9.3: Stacks, Queues, and ADTs · 9.3.2 Queues |
| L02 | ¿Cómo uso una lista de Python como si fuera una pila? | 1 | 1 | 0.732 | 0.732 | sí | Problem Solving with Algorithms and Data Structures using Python ·  Python · 3.5. Implementing a Stack in Python |
| L03 | ¿Cómo recorro todos los elementos de un arreglo en Java? | – | 2 | 0.476 | 0.474 | no ✗ | Think Java · rreglos y referencias · 7.3 Displaying Arrays |
| B01 | ¿Cómo funciona la búsqueda binaria y por qué la lista tiene que estar ordenada? | 1 | 1 | 0.796 | 0.796 | sí | Introduction to Programming Using Java ·  7.5: Searching and Sorting · 7.5.1 Searching |
| B02 | ¿Cómo funciona el ordenamiento burbuja? | 1 | 1 | 0.688 | 0.688 | sí | Problem Solving with Algorithms and Data Structures using Python · 5.7 The Bubble Sort · 5.7. The Bubble Sort |
| B03 | ¿Qué diferencia hay entre el ordenamiento por inserción y el de selección? | 1 | 1 | 0.519 | 0.519 | no ✗ | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.3 Insertion Sort |
| N01 | ¿Cómo funciona una tabla hash? | – | – | 0.377 | – | no | Documentación de PostgreSQL · .8.3. Common Table Expression Materialization |
| N02 | ¿Cómo funciona el ordenamiento burbuja? | – | – | 0.416 | – | no | Algorithms · Cap. 3: Dynamic Programming · pág. 11 |
| N03 | ¿Cómo armo una ventana con botones en una interfaz gráfica? | – | – | 0.395 | – | no | Think Java · vos (8.2 a 8.4) · 8.7 Recursive Binary Method |
| N04 | ¿Cómo hago que una clase herede los métodos de otra? | – | – | 0.634 | – | sí ✗ | Documentación oficial de Python · jo · 4.10. Intermezzo: Estilo de programación |
| N05 | ¿Cómo funciona el merge sort? | – | – | 0.409 | – | no | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.4 Selection Sort |

### Ejemplo antes/después: contexto con vecinos

Consulta: «¿Qué es el caso base y por qué toda función recursiva lo necesita?» (Recursividad), con `python -m app.buscar`.

**Antes** (solo el fragmento comparado), 1.º resultado: Erickson, Cap. 1 · pág. 47, similitud 0,79:

> satisfies the following recursive conditions:

Era el final de una página con pseudocódigo de árboles binarios lleno de caracteres de control (U+0000) y su continuación
estaba en la página siguiente. Al quitar esos caracteres (normalización) dejó de aparecer entre los seis primeros.

**Después**, 1.º resultado: Think Python, 5.13. Glossary, similitud 0,78. El fragmento comparado empieza en «recursive:»
y se corta en «A recursion that doesn’t have a…»; el contexto suma el fragmento anterior y el siguiente:

> branch: One of the alternative sequences of statements in a conditional statement. · chained conditional: … ·
> nested conditional: … · recursive: A function that calls itself is recursive. · base case: A conditional branch in a
> recursive function that does not make a recursive call. · infinite recursion: A recursion that doesn’t have a base
> case, or never reaches it. Eventually, an infinite recursion causes a runtime error. · newline: …

El 3.º resultado (4.4 The Three Laws of Recursion) pasa de empezar en «The final law is…» a incluir el párrafo anterior,
que explica la segunda ley («a natural progression toward the base case is to shorten the list»).

## diversidad · 2026-10-25 12:13

Parámetros: tam_fragmento = 400, solapamiento = 60, k_por_fuente = 6, candidatos = 20, max_por_origen = 2, vecinos = 1, similitud_minima = 0.5, fragmentos_minimos = 2; modelo sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2; 3212 fragmentos académicos.

| umbral | acierto@1 | acierto@6 | mrr | positivas suficientes | rechazo de negativas | concentración |
|---|---|---|---|---|---|---|
| 0.4 | 0.5 | 0.792 | 0.622 | 0.958 | 0.6 | 0.51 |
| 0.45 | 0.458 | 0.75 | 0.58 | 0.958 | 0.8 | 0.504 |
| **0.5** (actual) | 0.458 | 0.625 | 0.528 | 0.792 | 0.8 | 0.486 |
| 0.55 | 0.417 | 0.542 | 0.465 | 0.75 | 0.8 | 0.486 |
| 0.6 | 0.375 | 0.5 | 0.424 | 0.708 | 1 | 0.446 |

Similitud del fragmento más parecido (sin umbral):

| consultas | n | mínimo | máximo | promedio |
|---|---|---|---|---|
| positivas | 24 | 0.411 | 0.89 | 0.687 |
| negativas | 5 | 0.377 | 0.634 | 0.446 |

Detalle por consulta (posición del primer acierto con el umbral 0.5 y sin umbral):

| id | consulta | pos. | pos. sin umbral | sim. máx. | sim. 1.er acierto | suficiente | primer fragmento |
|---|---|---|---|---|---|---|---|
| R01 | ¿Qué es el caso base y por qué toda función recursiva lo necesita? | 2 | 2 | 0.784 | 0.767 | sí | Think Python ·  y recursividad (5.8 a 5.10) · 5.13. Glossary |
| R02 | ¿Qué es el caso recursivo y cómo hace para acercarse al caso base? | 1 | 1 | 0.738 | 0.738 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R03 | ¿Qué pasa si una función recursiva no tiene caso base? | – | – | 0.817 | – | sí | Think Python ·  y recursividad (5.8 a 5.10) · 5.13. Glossary |
| R04 | ¿Cómo se guarda cada llamada recursiva en la pila de llamadas? | – | – | 0.713 | – | sí | Composing Programs · 1.7 Recursive Functions · Tree Recursion |
| R05 | ¿Qué error tira Python cuando hay un desbordamiento de pila por demasiadas llamadas recursivas? | 1 | 1 | 0.771 | 0.771 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R06 | ¿Cómo cambio el límite de recursión en Python? | 1 | 1 | 0.89 | 0.89 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R07 | ¿Cómo se calcula el factorial de un número con una función recursiva? | 1 | 1 | 0.765 | 0.765 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R08 | ¿Por qué el Fibonacci recursivo es tan lento y repite cálculos? | 3 | 3 | 0.77 | 0.721 | sí | Algorithms · Cap. 3: Dynamic Programming · pág. 2 |
| R09 | ¿Cómo se resuelven las torres de Hanoi con recursión? | 1 | 1 | 0.745 | 0.745 | sí | Problem Solving with Algorithms and Data Structures using Python · 4.10 Tower of Hanoi · 4.10. Tower of Hanoi |
| R10 | ¿Qué es la recursión de cola? | – | – | 0.774 | – | sí | Think Java · vos (8.2 a 8.4) · 8.3 Value-Returning Methods |
| R11 | ¿Qué es la memoización y cómo evita recalcular resultados? | – | 4 | 0.595 | 0.493 | sí | Structure and Interpretation of Computer Programs · They Generate (1.2.1) · Probabilistic methods |
| R12 | ¿Cómo convierto una función recursiva en una iterativa con un bucle? | – | – | 0.762 | – | sí | Composing Programs · Recursive Functions · 1.7 Recursive Functions |
| R13 | ¿Qué es la recursión mutua entre dos funciones? | – | – | 0.776 | – | sí | Composing Programs · Recursive Functions · 1.7 Recursive Functions |
| R14 | ¿Cómo sumo los elementos de una lista de forma recursiva? | 3 | 3 | 0.653 | 0.633 | sí | Introduction to Programming Using Java · .1: Recursión · 9.1.1 Recursive Binary Search |
| R15 | ¿Qué significa el salto de fe cuando escribo una función recursiva? | 1 | 1 | 0.728 | 0.728 | sí | Think Java · ecursivos (8.2 a 8.4) · 8.4 The Leap of Faith |
| S01 | ¿Cuál es la diferencia entre un bucle while y un bucle for? | 2 | 2 | 0.55 | 0.545 | sí | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S02 | ¿Para qué sirven break y continue dentro de un bucle? | 1 | 1 | 0.555 | 0.555 | no ✗ | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S03 | ¿Cómo funciona la sentencia switch en Java? | – | 2 | 0.483 | 0.48 | no ✗ | Think Java · 3: Entrada y salida · 3.7 Type Cast Operators |
| L01 | ¿Qué diferencia hay entre una pila y una cola? | – | 1 | 0.411 | 0.411 | no ✗ | Introduction to Programming Using Java ·  9.3: Stacks, Queues, and ADTs · 9.3.2 Queues |
| L02 | ¿Cómo uso una lista de Python como si fuera una pila? | 1 | 1 | 0.732 | 0.732 | sí | Problem Solving with Algorithms and Data Structures using Python ·  Python · 3.5. Implementing a Stack in Python |
| L03 | ¿Cómo recorro todos los elementos de un arreglo en Java? | – | 2 | 0.476 | 0.474 | no ✗ | Think Java · rreglos y referencias · 7.3 Displaying Arrays |
| B01 | ¿Cómo funciona la búsqueda binaria y por qué la lista tiene que estar ordenada? | 1 | 1 | 0.796 | 0.796 | sí | Introduction to Programming Using Java ·  7.5: Searching and Sorting · 7.5.1 Searching |
| B02 | ¿Cómo funciona el ordenamiento burbuja? | 1 | 1 | 0.688 | 0.688 | sí | Problem Solving with Algorithms and Data Structures using Python · 5.7 The Bubble Sort · 5.7. The Bubble Sort |
| B03 | ¿Qué diferencia hay entre el ordenamiento por inserción y el de selección? | 1 | 1 | 0.519 | 0.519 | no ✗ | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.3 Insertion Sort |
| N01 | ¿Cómo funciona una tabla hash? | – | – | 0.377 | – | no | Documentación de PostgreSQL · .8.3. Common Table Expression Materialization |
| N02 | ¿Cómo funciona el ordenamiento burbuja? | – | – | 0.416 | – | no | Algorithms · Cap. 3: Dynamic Programming · pág. 11 |
| N03 | ¿Cómo armo una ventana con botones en una interfaz gráfica? | – | – | 0.395 | – | no | Think Java · vos (8.2 a 8.4) · 8.7 Recursive Binary Method |
| N04 | ¿Cómo hago que una clase herede los métodos de otra? | – | – | 0.634 | – | sí ✗ | Documentación oficial de Python · jo · 4.10. Intermezzo: Estilo de programación |
| N05 | ¿Cómo funciona el merge sort? | – | – | 0.409 | – | no | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.4 Selection Sort |

## diversidad (máx. 3 por origen) · 2026-10-25 12:15

Parámetros: tam_fragmento = 400, solapamiento = 60, k_por_fuente = 6, candidatos = 20, max_por_origen = 3, vecinos = 1, similitud_minima = 0.5, fragmentos_minimos = 2; modelo sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2; 3212 fragmentos académicos.

| umbral | acierto@1 | acierto@6 | mrr | positivas suficientes | rechazo de negativas | concentración |
|---|---|---|---|---|---|---|
| 0.4 | 0.5 | 0.875 | 0.637 | 0.958 | 0.6 | 0.567 |
| 0.45 | 0.458 | 0.833 | 0.595 | 0.958 | 0.8 | 0.565 |
| **0.5** (actual) | 0.458 | 0.708 | 0.543 | 0.792 | 0.8 | 0.548 |
| 0.55 | 0.417 | 0.625 | 0.481 | 0.75 | 0.8 | 0.546 |
| 0.6 | 0.375 | 0.583 | 0.439 | 0.708 | 1 | 0.517 |

Similitud del fragmento más parecido (sin umbral):

| consultas | n | mínimo | máximo | promedio |
|---|---|---|---|---|
| positivas | 24 | 0.411 | 0.89 | 0.687 |
| negativas | 5 | 0.377 | 0.634 | 0.446 |

Detalle por consulta (posición del primer acierto con el umbral 0.5 y sin umbral):

| id | consulta | pos. | pos. sin umbral | sim. máx. | sim. 1.er acierto | suficiente | primer fragmento |
|---|---|---|---|---|---|---|---|
| R01 | ¿Qué es el caso base y por qué toda función recursiva lo necesita? | 2 | 2 | 0.784 | 0.767 | sí | Think Python ·  y recursividad (5.8 a 5.10) · 5.13. Glossary |
| R02 | ¿Qué es el caso recursivo y cómo hace para acercarse al caso base? | 1 | 1 | 0.738 | 0.738 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R03 | ¿Qué pasa si una función recursiva no tiene caso base? | 6 | 6 | 0.817 | 0.759 | sí | Think Python ·  y recursividad (5.8 a 5.10) · 5.13. Glossary |
| R04 | ¿Cómo se guarda cada llamada recursiva en la pila de llamadas? | – | – | 0.713 | – | sí | Composing Programs · 1.7 Recursive Functions · Tree Recursion |
| R05 | ¿Qué error tira Python cuando hay un desbordamiento de pila por demasiadas llamadas recursivas? | 1 | 1 | 0.771 | 0.771 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R06 | ¿Cómo cambio el límite de recursión en Python? | 1 | 1 | 0.89 | 0.89 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R07 | ¿Cómo se calcula el factorial de un número con una función recursiva? | 1 | 1 | 0.765 | 0.765 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R08 | ¿Por qué el Fibonacci recursivo es tan lento y repite cálculos? | 3 | 3 | 0.77 | 0.721 | sí | Algorithms · Cap. 3: Dynamic Programming · pág. 2 |
| R09 | ¿Cómo se resuelven las torres de Hanoi con recursión? | 1 | 1 | 0.745 | 0.745 | sí | Problem Solving with Algorithms and Data Structures using Python · 4.10 Tower of Hanoi · 4.10. Tower of Hanoi |
| R10 | ¿Qué es la recursión de cola? | – | – | 0.774 | – | sí | Think Java · vos (8.2 a 8.4) · 8.3 Value-Returning Methods |
| R11 | ¿Qué es la memoización y cómo evita recalcular resultados? | – | 4 | 0.595 | 0.493 | sí | Structure and Interpretation of Computer Programs · They Generate (1.2.1) · Probabilistic methods |
| R12 | ¿Cómo convierto una función recursiva en una iterativa con un bucle? | – | – | 0.762 | – | sí | Composing Programs · Recursive Functions · 1.7 Recursive Functions |
| R13 | ¿Qué es la recursión mutua entre dos funciones? | 5 | 5 | 0.776 | 0.7 | sí | Composing Programs · Recursive Functions · 1.7 Recursive Functions |
| R14 | ¿Cómo sumo los elementos de una lista de forma recursiva? | 3 | 3 | 0.653 | 0.633 | sí | Introduction to Programming Using Java · .1: Recursión · 9.1.1 Recursive Binary Search |
| R15 | ¿Qué significa el salto de fe cuando escribo una función recursiva? | 1 | 1 | 0.728 | 0.728 | sí | Think Java · ecursivos (8.2 a 8.4) · 8.4 The Leap of Faith |
| S01 | ¿Cuál es la diferencia entre un bucle while y un bucle for? | 2 | 2 | 0.55 | 0.545 | sí | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S02 | ¿Para qué sirven break y continue dentro de un bucle? | 1 | 1 | 0.555 | 0.555 | no ✗ | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S03 | ¿Cómo funciona la sentencia switch en Java? | – | 2 | 0.483 | 0.48 | no ✗ | Think Java · 3: Entrada y salida · 3.7 Type Cast Operators |
| L01 | ¿Qué diferencia hay entre una pila y una cola? | – | 1 | 0.411 | 0.411 | no ✗ | Introduction to Programming Using Java ·  9.3: Stacks, Queues, and ADTs · 9.3.2 Queues |
| L02 | ¿Cómo uso una lista de Python como si fuera una pila? | 1 | 1 | 0.732 | 0.732 | sí | Problem Solving with Algorithms and Data Structures using Python ·  Python · 3.5. Implementing a Stack in Python |
| L03 | ¿Cómo recorro todos los elementos de un arreglo en Java? | – | 2 | 0.476 | 0.474 | no ✗ | Think Java · rreglos y referencias · 7.3 Displaying Arrays |
| B01 | ¿Cómo funciona la búsqueda binaria y por qué la lista tiene que estar ordenada? | 1 | 1 | 0.796 | 0.796 | sí | Introduction to Programming Using Java ·  7.5: Searching and Sorting · 7.5.1 Searching |
| B02 | ¿Cómo funciona el ordenamiento burbuja? | 1 | 1 | 0.688 | 0.688 | sí | Problem Solving with Algorithms and Data Structures using Python · 5.7 The Bubble Sort · 5.7. The Bubble Sort |
| B03 | ¿Qué diferencia hay entre el ordenamiento por inserción y el de selección? | 1 | 1 | 0.519 | 0.519 | no ✗ | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.3 Insertion Sort |
| N01 | ¿Cómo funciona una tabla hash? | – | – | 0.377 | – | no | Documentación de PostgreSQL · .8.3. Common Table Expression Materialization |
| N02 | ¿Cómo funciona el ordenamiento burbuja? | – | – | 0.416 | – | no | Algorithms · Cap. 3: Dynamic Programming · pág. 11 |
| N03 | ¿Cómo armo una ventana con botones en una interfaz gráfica? | – | – | 0.395 | – | no | Think Java · vos (8.2 a 8.4) · 8.7 Recursive Binary Method |
| N04 | ¿Cómo hago que una clase herede los métodos de otra? | – | – | 0.634 | – | sí ✗ | Documentación oficial de Python · jo · 4.10. Intermezzo: Estilo de programación |
| N05 | ¿Cómo funciona el merge sort? | – | – | 0.409 | – | no | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.4 Selection Sort |

### Comparación de valores de diversidad (umbral 0,5)

| configuración | acierto@1 | acierto@6 | MRR | concentración | consultas con 4+ fragmentos de un mismo libro |
|---|---|---|---|---|---|
| sin máximo (vecinos) | 0,458 | 0,708 | 0,543 | 0,555 | 4 de 29 (R08 Erickson, R13, B01, B02) |
| máx. 1 por origen | 0,458 | 0,667 | 0,542 | 0,361 | 0 |
| máx. 2 por origen | 0,458 | 0,625 | 0,528 | 0,486 | 0 |
| **máx. 3 por origen** (elegido) | 0,458 | 0,708 | 0,543 | 0,548 | 0 |
| máx. 2 y 40 candidatos | 0,458 | 0,625 | 0,528 | 0,486 | 0 |

Con máximo 2 se pierden R03 y R13: la sección esperada (5.10 Infinite recursion; Mutual Recursion) es del mismo libro
que los fragmentos generales que ocupan los primeros puestos (el glosario y Leap of faith de Think Python; Anatomy of
Recursive Functions de Composing Programs), y el límite deja afuera justamente a la respuesta. Con máximo 3 ninguna
consulta recibe más de la mitad de sus fragmentos de un mismo libro y no se pierde ningún acierto. Pedir 40 candidatos en
lugar de 20 no cambia el resultado: los lugares libres ya se completan con 20.
