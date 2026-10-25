# Evaluación de la recuperación (HU-003)

Cada sección es una medición de `python -m app.evaluar` sobre `evaluacion/consultas.json`, con los parámetros de `parametros.toml` vigentes en ese momento.

## Resumen

### Conjunto de prueba y métricas

29 consultas en español, como las formularía un estudiante: 15 de Recursividad, 3 de cada uno de los otros tres temas
y 5 sin respuesta en las fuentes del tema (tres de ellas de otro tema, consultadas contra Recursividad). Cada consulta
positiva indica las secciones que la responden, tomadas de los textos de las fuentes y verificadas antes de medir.

- **acierto@1**: la primera sección devuelta es una de las esperadas. **acierto@6**: alguna aparece entre los resultados.
- **MRR**: promedio de 1 / posición del primer acierto.
- **positivas suficientes**: consultas con respuesta que reúnen los dos fragmentos mínimos (HU-003, CA5).
- **rechazo de negativas**: consultas sin respuesta que quedan como material insuficiente.
- **concentración**: proporción de los resultados que proviene de la fuente más repetida.

### Comparación de las etapas

Umbral 0,5 en todas las etapas salvo la última, para que solo cambie lo que agrega cada una.

| etapa | qué cambia | fragmentos | acierto@1 | acierto@6 | MRR | positivas suficientes | rechazo de negativas | concentración |
|---|---|---|---|---|---|---|---|---|
| inicial | — | 3385 | 0,458 | 0,667 | 0,531 | 0,792 | 0,80 | 0,534 |
| limpieza | NFKC, glifos ilegibles, guiones de PDF, interfaz de las páginas HTML | 3227 | 0,458 | 0,708 | 0,529 | 0,792 | 0,80 | 0,542 |
| vecinos | contexto con el fragmento anterior y el siguiente; fusión de vecinos; caracteres de control | 3212 | 0,458 | 0,708 | 0,543 | 0,792 | 0,80 | 0,555 |
| diversidad, máx. 2 | 20 candidatos, como mucho 2 por libro | 3212 | 0,458 | 0,625 | 0,528 | 0,792 | 0,80 | 0,486 |
| diversidad, máx. 3 | como mucho 3 por libro (elegido) | 3212 | 0,458 | 0,708 | 0,543 | 0,792 | 0,80 | 0,548 |
| re-ranking | cross-encoder mmarco-mMiniLMv2 sobre los 20 candidatos | 3212 | 0,625 | 0,792 | 0,696 | 0,792 | 0,80 | 0,533 |
| **final** | **umbral 0,45** | 3212 | **0,750** | **0,917** | **0,821** | **0,958** | **0,80** | 0,549 |

Tiempo por consulta: unos 70 ms antes del re-ranking; el re-ranking de 20 candidatos suma unos 0,6 s (máximo 0,9 s) en
una computadora de 16 núcleos, y cargar el modelo al arrancar, 1,4 s. Con 40 candidatos el acierto@1 es el mismo y el
tiempo se duplica (1,35 s).

### Umbral recomendado: 0,45

Barrido con todas las mejoras aplicadas:

| umbral | acierto@1 | acierto@6 | MRR | positivas suficientes | rechazo de negativas |
|---|---|---|---|---|---|
| 0,35 (valor inicial de la E3) | 0,792 | 0,958 | 0,863 | 1,000 | 0,20 |
| 0,40 | 0,792 | 0,958 | 0,856 | 0,958 | 0,60 |
| **0,45** | **0,750** | **0,917** | **0,821** | **0,958** | **0,80** |
| 0,50 | 0,625 | 0,792 | 0,696 | 0,792 | 0,80 |
| 0,55 | 0,583 | 0,708 | 0,633 | 0,750 | 0,80 |
| 0,60 | 0,542 | 0,667 | 0,592 | 0,708 | 1,00 |

- **0,45 es el umbral más bajo que mantiene el rechazo de negativas en 4 de 5.** Con 0,40 pasa a 3 de 5 y con 0,35, a 1 de 5:
  la plataforma generaría contenido "respaldado" por fragmentos que no responden la consulta.
- **Frente a 0,5 no pierde rechazo y gana cobertura:** las consultas con respuesta que reúnen fragmentos suficientes pasan
  de 79 % a 96 %. Con 0,5 se informaba "material insuficiente" en break y continue, la sentencia switch, recorrer un
  arreglo, la diferencia entre pila y cola y entre inserción y selección, cuyas respuestas están en las fuentes; con el
  re-ranking esas secciones quedan primeras, pero el umbral las descartaba antes.
- **Ningún umbral separa del todo las dos clases:** la positiva con menor similitud (pila y cola, 0,41) está por debajo de la
  negativa con mayor similitud (herencia contra Sintaxis, 0,63), que es aceptada con cualquier umbral menor a 0,6.
- **Limitaciones:** solo hay 5 consultas negativas (cada una vale 20 puntos de la tasa de rechazo) y el mismo conjunto se usó
  para elegir los valores. Antes de dar los resultados por definitivos conviene validarlos con consultas nuevas, no
  usadas en la calibración.

### Ejemplos antes/después

**Re-ranking.** «¿Qué pasa si una función recursiva no tiene caso base?» (Recursividad), con `python -m app.buscar`:

| | 1.er resultado | posición de 5.10 Infinite recursion |
|---|---|---|
| antes (diversidad, máx. 3) | Think Python · 5.13 Glossary | 6.ª |
| después (re-ranking) | Think Python · **5.10 Infinite recursion** (re-ranking 7,89) | 1.ª y 2.ª (dos fragmentos de la sección) |

El primer resultado ahora dice: «If a recursion never reaches a base case, it goes on making recursive calls forever,
and the program never terminates. This is known as infinite recursion».

**Limpieza.** Los fragmentos indexados ya no contienen ligaduras («ﬁnite» → «finite»), glifos ilegibles de los PDF
(«￿. R￿￿￿￿￿￿￿￿»), caracteres de control del pseudocódigo de Erickson, la llamada al visualizador de Composing Programs
(«''', step=0, cumulative=False)»), el menú, las donaciones y las autoevaluaciones de Runestone, ni los índices y la
navegación de la documentación de Python, PostgreSQL, Eck y SICP. Los ejemplos de código de Runestone, que están en un
editor oculto, se conservan.

**Vecinos.** Ver el ejemplo en la sección «vecinos»: el glosario de Think Python pasa de cortarse en «A recursion that
doesn’t have a…» a incluir las definiciones completas.

### Lo que queda pendiente

- R04 («¿cómo se guarda cada llamada recursiva en la pila de llamadas?»): la respuesta no está entre los 20 candidatos.
- La negativa de herencia (N04) se acepta con cualquier umbral menor a 0,6.
- En los PDF la sección es la página: el contexto no continúa en la página siguiente.

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

## re-ranking · 2026-10-25 12:30

Parámetros: tam_fragmento = 400, solapamiento = 60, k_por_fuente = 6, candidatos = 20, max_por_origen = 3, reranking = True, vecinos = 1, similitud_minima = 0.5, fragmentos_minimos = 2; modelo sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2; 3212 fragmentos académicos.

| umbral | acierto@1 | acierto@6 | mrr | positivas suficientes | rechazo de negativas | concentración |
|---|---|---|---|---|---|---|
| 0.4 | 0.792 | 0.958 | 0.856 | 0.958 | 0.6 | 0.552 |
| 0.45 | 0.75 | 0.917 | 0.821 | 0.958 | 0.8 | 0.549 |
| **0.5** (actual) | 0.625 | 0.792 | 0.696 | 0.792 | 0.8 | 0.533 |
| 0.55 | 0.583 | 0.708 | 0.633 | 0.75 | 0.8 | 0.524 |
| 0.6 | 0.542 | 0.667 | 0.592 | 0.708 | 1 | 0.504 |

Similitud del fragmento más parecido (sin umbral):

| consultas | n | mínimo | máximo | promedio |
|---|---|---|---|---|
| positivas | 24 | 0.411 | 0.89 | 0.671 |
| negativas | 5 | 0.353 | 0.634 | 0.435 |

Detalle por consulta (posición del primer acierto con el umbral 0.5 y sin umbral):

| id | consulta | pos. | pos. sin umbral | sim. máx. | sim. 1.er acierto | suficiente | primer fragmento |
|---|---|---|---|---|---|---|---|
| R01 | ¿Qué es el caso base y por qué toda función recursiva lo necesita? | 1 | 1 | 0.784 | 0.762 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R02 | ¿Qué es el caso recursivo y cómo hace para acercarse al caso base? | 1 | 1 | 0.738 | 0.688 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R03 | ¿Qué pasa si una función recursiva no tiene caso base? | 1 | 1 | 0.817 | 0.759 | sí | Think Python · vidad (5.8 a 5.10) · 5.10. Infinite recursion |
| R04 | ¿Cómo se guarda cada llamada recursiva en la pila de llamadas? | – | – | 0.713 | – | sí | Composing Programs · e Functions · Printing in Recursive Functions |
| R05 | ¿Qué error tira Python cuando hay un desbordamiento de pila por demasiadas llamadas recursivas? | 1 | 1 | 0.771 | 0.771 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R06 | ¿Cómo cambio el límite de recursión en Python? | 1 | 1 | 0.89 | 0.89 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R07 | ¿Cómo se calcula el factorial de un número con una función recursiva? | 1 | 1 | 0.765 | 0.765 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R08 | ¿Por qué el Fibonacci recursivo es tan lento y repite cálculos? | 1 | 1 | 0.77 | 0.721 | sí | Structure and Interpretation of Computer Programs ·  They Generate (1.2.1) · 1.2.2 Tree Recursion |
| R09 | ¿Cómo se resuelven las torres de Hanoi con recursión? | 1 | 1 | 0.641 | 0.641 | sí | Algorithms · Cap. 1: Recursion · pág. 6 |
| R10 | ¿Qué es la recursión de cola? | 2 | 2 | 0.748 | 0.643 | sí | Structure and Interpretation of Computer Programs · They Generate (1.2.1) · Probabilistic methods |
| R11 | ¿Qué es la memoización y cómo evita recalcular resultados? | – | 1 | 0.595 | 0.459 | sí | Problem Solving with Algorithms and Data Structures using Python · namic Programming · 4.12. Dynamic Programming |
| R12 | ¿Cómo convierto una función recursiva en una iterativa con un bucle? | 5 | 5 | 0.717 | 0.68 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R13 | ¿Qué es la recursión mutua entre dos funciones? | 1 | 1 | 0.703 | 0.7 | sí | Composing Programs · 1.7 Recursive Functions · Mutual Recursion |
| R14 | ¿Cómo sumo los elementos de una lista de forma recursiva? | 1 | 1 | 0.653 | 0.633 | sí | Problem Solving with Algorithms and Data Structures using Python · 4.3. Calculating the Sum of a List of Numbers |
| R15 | ¿Qué significa el salto de fe cuando escribo una función recursiva? | 2 | 2 | 0.728 | 0.635 | sí | Think Java · todos recursivos (8.2 a 8.4) · 8.9 Vocabulary |
| S01 | ¿Cuál es la diferencia entre un bucle while y un bucle for? | 2 | 2 | 0.55 | 0.375 | sí | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S02 | ¿Para qué sirven break y continue dentro de un bucle? | 1 | 1 | 0.47 | 0.434 | no ✗ | Documentación oficial de Python ·  flujo · 4.4. Las sentencias break y continue |
| S03 | ¿Cómo funciona la sentencia switch en Java? | – | 1 | 0.48 | 0.48 | no ✗ | Think Java · icionales y lógica · 5.4 The switch Statement |
| L01 | ¿Qué diferencia hay entre una pila y una cola? | – | 1 | 0.411 | 0.411 | no ✗ | Introduction to Programming Using Java ·  9.3: Stacks, Queues, and ADTs · 9.3.2 Queues |
| L02 | ¿Cómo uso una lista de Python como si fuera una pila? | 1 | 1 | 0.732 | 0.732 | sí | Problem Solving with Algorithms and Data Structures using Python ·  Python · 3.5. Implementing a Stack in Python |
| L03 | ¿Cómo recorro todos los elementos de un arreglo en Java? | – | 1 | 0.474 | 0.474 | no ✗ | Think Java · los y referencias · 7.8 The Enhanced for Loop |
| B01 | ¿Cómo funciona la búsqueda binaria y por qué la lista tiene que estar ordenada? | 1 | 1 | 0.796 | 0.796 | sí | Introduction to Programming Using Java ·  7.5: Searching and Sorting · 7.5.1 Searching |
| B02 | ¿Cómo funciona el ordenamiento burbuja? | 1 | 1 | 0.688 | 0.688 | sí | Problem Solving with Algorithms and Data Structures using Python · 5.7 The Bubble Sort · 5.7. The Bubble Sort |
| B03 | ¿Qué diferencia hay entre el ordenamiento por inserción y el de selección? | 1 | 1 | 0.467 | 0.467 | no ✗ | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.4 Selection Sort |
| N01 | ¿Cómo funciona una tabla hash? | – | – | 0.353 | – | no | Documentación de PostgreSQL · .8.3. Common Table Expression Materialization |
| N02 | ¿Cómo funciona el ordenamiento burbuja? | – | – | 0.416 | – | no | Algorithms · Cap. 3: Dynamic Programming · pág. 11 |
| N03 | ¿Cómo armo una ventana con botones en una interfaz gráfica? | – | – | 0.395 | – | no | Apéndices I y II de Algorithms (Erickson · Apéndice I: Proof by Induction · pág. 14 |
| N04 | ¿Cómo hago que una clase herede los métodos de otra? | – | – | 0.634 | – | sí ✗ | Think Java ·  6: Bucles y cadenas · 6.11 String Formatting |
| N05 | ¿Cómo funciona el merge sort? | – | – | 0.376 | – | no | Problem Solving with Algorithms and Data Structures using Python · 5.7 The Bubble Sort · 5.7. The Bubble Sort |

## final (umbral 0,45) · 2026-10-25 12:38

Parámetros: tam_fragmento = 400, solapamiento = 60, k_por_fuente = 6, candidatos = 20, max_por_origen = 3, reranking = True, vecinos = 1, similitud_minima = 0.45, fragmentos_minimos = 2; modelo sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2; 3212 fragmentos académicos.

| umbral | acierto@1 | acierto@6 | mrr | positivas suficientes | rechazo de negativas | concentración |
|---|---|---|---|---|---|---|
| 0.35 | 0.792 | 0.958 | 0.863 | 1 | 0.2 | 0.497 |
| 0.4 | 0.792 | 0.958 | 0.856 | 0.958 | 0.6 | 0.552 |
| **0.45** (actual) | 0.75 | 0.917 | 0.821 | 0.958 | 0.8 | 0.549 |
| 0.5 | 0.625 | 0.792 | 0.696 | 0.792 | 0.8 | 0.533 |
| 0.55 | 0.583 | 0.708 | 0.633 | 0.75 | 0.8 | 0.524 |
| 0.6 | 0.542 | 0.667 | 0.592 | 0.708 | 1 | 0.504 |

Similitud del fragmento más parecido (sin umbral):

| consultas | n | mínimo | máximo | promedio |
|---|---|---|---|---|
| positivas | 24 | 0.411 | 0.89 | 0.671 |
| negativas | 5 | 0.353 | 0.634 | 0.435 |

Detalle por consulta (posición del primer acierto con el umbral 0.45 y sin umbral):

| id | consulta | pos. | pos. sin umbral | sim. máx. | sim. 1.er acierto | suficiente | primer fragmento |
|---|---|---|---|---|---|---|---|
| R01 | ¿Qué es el caso base y por qué toda función recursiva lo necesita? | 1 | 1 | 0.784 | 0.762 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R02 | ¿Qué es el caso recursivo y cómo hace para acercarse al caso base? | 1 | 1 | 0.738 | 0.688 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R03 | ¿Qué pasa si una función recursiva no tiene caso base? | 1 | 1 | 0.817 | 0.759 | sí | Think Python · vidad (5.8 a 5.10) · 5.10. Infinite recursion |
| R04 | ¿Cómo se guarda cada llamada recursiva en la pila de llamadas? | – | – | 0.713 | – | sí | Composing Programs · e Functions · Printing in Recursive Functions |
| R05 | ¿Qué error tira Python cuando hay un desbordamiento de pila por demasiadas llamadas recursivas? | 1 | 1 | 0.771 | 0.771 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R06 | ¿Cómo cambio el límite de recursión en Python? | 1 | 1 | 0.89 | 0.89 | sí | Documentación oficial de Python · ímite de recursión) · sys.getrecursionlimit() |
| R07 | ¿Cómo se calcula el factorial de un número con una función recursiva? | 1 | 1 | 0.765 | 0.765 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R08 | ¿Por qué el Fibonacci recursivo es tan lento y repite cálculos? | 1 | 1 | 0.77 | 0.721 | sí | Structure and Interpretation of Computer Programs ·  They Generate (1.2.1) · 1.2.2 Tree Recursion |
| R09 | ¿Cómo se resuelven las torres de Hanoi con recursión? | 1 | 1 | 0.641 | 0.641 | sí | Algorithms · Cap. 1: Recursion · pág. 6 |
| R10 | ¿Qué es la recursión de cola? | 2 | 2 | 0.748 | 0.643 | sí | Structure and Interpretation of Computer Programs · They Generate (1.2.1) · Probabilistic methods |
| R11 | ¿Qué es la memoización y cómo evita recalcular resultados? | 1 | 1 | 0.595 | 0.459 | sí | Problem Solving with Algorithms and Data Structures using Python · namic Programming · 4.12. Dynamic Programming |
| R12 | ¿Cómo convierto una función recursiva en una iterativa con un bucle? | 5 | 5 | 0.717 | 0.68 | sí | Composing Programs · unctions · The Anatomy of Recursive Functions |
| R13 | ¿Qué es la recursión mutua entre dos funciones? | 1 | 1 | 0.703 | 0.7 | sí | Composing Programs · 1.7 Recursive Functions · Mutual Recursion |
| R14 | ¿Cómo sumo los elementos de una lista de forma recursiva? | 1 | 1 | 0.653 | 0.633 | sí | Problem Solving with Algorithms and Data Structures using Python · 4.3. Calculating the Sum of a List of Numbers |
| R15 | ¿Qué significa el salto de fe cuando escribo una función recursiva? | 2 | 2 | 0.728 | 0.635 | sí | Think Java · todos recursivos (8.2 a 8.4) · 8.9 Vocabulary |
| S01 | ¿Cuál es la diferencia entre un bucle while y un bucle for? | 2 | 2 | 0.55 | 0.375 | sí | Documentación oficial de Python · trol de flujo · 4.5. Cláusulas else en bucles |
| S02 | ¿Para qué sirven break y continue dentro de un bucle? | 1 | 1 | 0.47 | 0.434 | sí | Documentación oficial de Python ·  flujo · 4.4. Las sentencias break y continue |
| S03 | ¿Cómo funciona la sentencia switch en Java? | 1 | 1 | 0.48 | 0.48 | sí | Think Java · icionales y lógica · 5.4 The switch Statement |
| L01 | ¿Qué diferencia hay entre una pila y una cola? | – | 1 | 0.411 | 0.411 | no ✗ | Introduction to Programming Using Java ·  9.3: Stacks, Queues, and ADTs · 9.3.2 Queues |
| L02 | ¿Cómo uso una lista de Python como si fuera una pila? | 1 | 1 | 0.732 | 0.732 | sí | Problem Solving with Algorithms and Data Structures using Python ·  Python · 3.5. Implementing a Stack in Python |
| L03 | ¿Cómo recorro todos los elementos de un arreglo en Java? | 1 | 1 | 0.474 | 0.474 | sí | Think Java · los y referencias · 7.8 The Enhanced for Loop |
| B01 | ¿Cómo funciona la búsqueda binaria y por qué la lista tiene que estar ordenada? | 1 | 1 | 0.796 | 0.796 | sí | Introduction to Programming Using Java ·  7.5: Searching and Sorting · 7.5.1 Searching |
| B02 | ¿Cómo funciona el ordenamiento burbuja? | 1 | 1 | 0.688 | 0.688 | sí | Problem Solving with Algorithms and Data Structures using Python · 5.7 The Bubble Sort · 5.7. The Bubble Sort |
| B03 | ¿Qué diferencia hay entre el ordenamiento por inserción y el de selección? | 1 | 1 | 0.467 | 0.467 | sí | Introduction to Programming Using Java ·  Searching and Sorting · 7.5.4 Selection Sort |
| N01 | ¿Cómo funciona una tabla hash? | – | – | 0.353 | – | no | Documentación de PostgreSQL · .8.3. Common Table Expression Materialization |
| N02 | ¿Cómo funciona el ordenamiento burbuja? | – | – | 0.416 | – | no | Algorithms · Cap. 3: Dynamic Programming · pág. 11 |
| N03 | ¿Cómo armo una ventana con botones en una interfaz gráfica? | – | – | 0.395 | – | no | Apéndices I y II de Algorithms (Erickson · Apéndice I: Proof by Induction · pág. 14 |
| N04 | ¿Cómo hago que una clase herede los métodos de otra? | – | – | 0.634 | – | sí ✗ | Think Java ·  6: Bucles y cadenas · 6.11 String Formatting |
| N05 | ¿Cómo funciona el merge sort? | – | – | 0.376 | – | no | Problem Solving with Algorithms and Data Structures using Python · 5.7 The Bubble Sort · 5.7. The Bubble Sort |
