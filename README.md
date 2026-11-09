# Plataforma de estudio · prototipo (TFG)

Prototipo de la *Plataforma Adaptativa de Estudio con Inteligencia Artificial*.
Incluye el núcleo definido en los alcances, alineado con la Entrega 3 (historias de usuario HU-001 a HU-012, DER,
diccionario de datos y Seguridad): inicio de sesión con Google, configuración del objetivo y plan de estudio, carga del
material con RAG, los módulos Aprender, Practicar y Consolidar, y Progreso con el nivel de dominio y el reajuste del plan.

Todas las reglas y umbrales del diseño (días, notas, límites de carga, etapas del RAG, modelos, detector de bloqueos,
puntos y fórmula de dominio) están en **`backend/parametros.toml`**, para poder reproducir las pruebas con los mismos valores.

```
plataforma-estudio/
├── backend/    FastAPI + SQLModel (SQLite) · auth con Google + JWT en cookie
└── frontend/   React + Vite + Tailwind v4 · tokens de la identidad visual v0.5
```

## 1. Levantarlo en local

**Con doble clic (Windows):** `iniciar.bat`, en la raíz del proyecto. La primera vez crea el entorno de Python e instala
las dependencias; después compila el frontend, levanta el backend (que sirve también la página) y abre
http://localhost:8000. Necesita Python 3.11+, Node y el archivo `backend/.env`. Para cerrarlo, cerrar la ventana.

**Para las pruebas manuales** (con el servidor cerrado, desde `backend/`): `python -m app.pruebas reiniciar` deja la base
sin estudiantes ni progreso (conserva temas, ejercicios y fuentes) y `python -m app.pruebas pasar-dias 3` simula que
pasaron días, para probar el reajuste del plan. `python -m app.diagnostico <plan> "<consulta>"` muestra qué fragmentos
recupera una consulta en un plan.

**Con dos terminales (desarrollo):**

Backend (Python 3.11+):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (en Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # completar GOOGLE_CLIENT_ID y JWT_SECRET
uvicorn app.main:app --reload --port 8000
```

Frontend (Node 20.19+ o 22.12+), en otra terminal:

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

Sin `GOOGLE_CLIENT_ID` igual podés entrar con **Entrar en modo demo** (requiere `DEV_LOGIN=true`).

**Ingreso con clave de acceso** (para quien no tiene una cuenta de Google autorizada, como los docentes que evalúan el
prototipo): se habilita con `CLAVE_ACCESO=<una clave>` en el `.env`. En la pantalla de ingreso aparece "Ingresar con clave
de acceso"; cada persona pone su nombre, su correo y la clave, y con el mismo correo retoma su progreso.
Documentación interactiva de la API: http://localhost:8000/docs · Tests: `cd backend && pytest`

## 2. Obtener el Client ID de Google

1. https://console.cloud.google.com → crear proyecto.
2. *APIs y servicios → Pantalla de consentimiento de OAuth*: tipo **Externo**, completar nombre y mail, agregarte como usuario de prueba.
3. *Credenciales → Crear credenciales → ID de cliente de OAuth* → **Aplicación web**.
4. *Orígenes de JavaScript autorizados*: `http://localhost` y `http://localhost:5173` (después, la URL de Railway/Render).
5. Copiar el Client ID en `backend/.env`. No hace falta el *client secret*: solo se verifican ID tokens.

## 3. Cómo funciona el login

1. El botón de Google (Google Identity Services) devuelve un **ID token** (JWT firmado por Google).
2. El front lo manda a `POST /api/auth/google`.
3. El backend lo verifica con las claves públicas de Google: firma, expiración, `aud` = nuestro Client ID, emisor y mail verificado.
4. Crea o actualiza el usuario (se identifica por `sub`, no por el mail) y emite **su propio JWT** en una cookie `httpOnly` + `SameSite=Lax`.
5. Las rutas protegidas leen esa cookie (`current_user`). El JavaScript del front nunca toca el token.

Útil para la sección de Seguridad (Entrega 3): httpOnly mitiga el robo de sesión por XSS; SameSite=Lax + cuerpo JSON mitigan CSRF; `COOKIE_SECURE=true` en producción (HTTPS); los planes se filtran siempre por `user_id`; los archivos se guardan con nombre aleatorio (sin path traversal) y con límite de tamaño y extensión.

## 4. Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/auth/config` | Client ID y si está habilitado el modo demo |
| POST | `/api/auth/google` | Login con ID token de Google |
| POST | `/api/auth/clave` | Ingreso con nombre, correo y clave de acceso (solo con `CLAVE_ACCESO`) |
| POST | `/api/auth/dev` | Login demo (solo `DEV_LOGIN=true`) |
| GET | `/api/auth/me` | Usuario actual |
| POST | `/api/auth/logout` | Cierra sesión |
| POST | `/api/plans/preview` | Calcula la ruta sin guardarla |
| POST | `/api/plans` | Crea el plan y sus sesiones |
| GET | `/api/plans` | Planes del usuario |
| POST | `/api/plans/{id}/materials` | Sube un apunte: PDF, DOCX o PPTX (validado por contenido) · 25 MB · 20 por tema · cuota de 200 MB |
| GET | `/api/materials` | Material de los planes activos (con su estado de procesamiento) |
| GET | `/api/plans/{id}/search?q=` | Fragmentos del tema sobre el umbral e indicación de si alcanzan (RAG) |
| GET | `/api/dashboard` | Datos de inicio y progreso |

## 5. Pantallas

| Ruta | Pantalla |
|---|---|
| `/` | Presentación (hero con el cerebro de partículas) |
| `/ingresar` | Ingreso con Google (y modo demo en desarrollo) |
| `/empezar` | Configuración en 3 pasos |
| `/app` | Inicio: siguiente paso, recorrido y avance |
| `/app/material` | Mi material |
| `/app/progreso` | Progreso |
| `/app/aprender`, `/practicar`, `/consolidar` | Módulos Aprender, Practicar y Consolidar |
| `/app/configuracion` | Cuenta y sesión |

La configuración sigue el flujo definido para la plataforma:

| Paso | Datos | Se usa en |
|---|---|---|
| 1. Configurar objetivo | tema (4 contenidos del alcance), días disponibles (1 a 14), nivel inicial y nota objetivo (6 a 10) | plan de estudio y dominio requerido |
| 2. Material y lenguaje | apuntes (opcional) y lenguaje (Java o Python, obligatorio) | material híbrido (RAG) y ejercicios |
| 3. Revisar el plan | días por módulo | confirmación antes de crear |

Cada nota pide un mínimo de días (HU-002, CA6): 3 para 6 o 7, 4 para 8 o 9 y 5 para 10. Si no alcanzan, la pantalla
ofrece usar los días mínimos o bajar la nota.

El prototipo trabaja sobre **una única materia de programación**, según el alcance de la Entrega 1: el alumno elige el *tema* dentro de ella, no la materia. Esa materia se define en una sola constante (`MATERIA`, en `frontend/src/lib/format.js`).

El formato de estudio y la intensidad de las pistas no se piden al configurar: se eligen dentro de cada módulo.

El generador (`backend/app/services/planner.py`) arranca hoy y asigna cada día a un módulo, en el orden Aprender → Practicar → Consolidar, con proporciones según el nivel inicial y la nota objetivo. Cada día tiene sus actividades (contenido, evaluación, ejercicio o refuerzo): el último día de Aprender suma la evaluación de comprensión y los días de Practicar se reparten los cinco ejercicios que aprueban el módulo. El plan se guarda como un arreglo de versiones (la vigente es la última); el reajuste según el avance (HU-010) agrega versiones nuevas.

## 6. Modelo de datos

Las tablas siguen el DER de la Entrega 3 (Figura 5), con los mismos nombres: `tema`, `fuente_academica`, `estudiante`, `objetivo_estudio`, `material_estudio`, `nivel_dominio`, `ejercicio`, `sesion_estudio`, `intento`, `dificultad_detectada`, `explicacion` y `punto` (`backend/app/models.py`).

- Los cuatro temas del alcance se cargan solos al iniciar el backend, con sus conceptos esperados (`backend/app/db.py`).
- `objetivo_estudio.plan_estudio` guarda las versiones del plan en JSON; `sesion_estudio` registra las sesiones realizadas.
- Una base local creada antes de la Entrega 3 se reinicia sola al arrancar (solo tenía datos de prueba).
- Un estudiante puede tener varios objetivos (temas) a la vez, pero uno solo por tema.
- SQLite controla las claves foráneas (`PRAGMA foreign_keys = ON`).
- Campos que no figuran en el DER: `estudiante.foto_url`, `estudiante.lenguaje_preferido`, `fuente_academica.url` y, en `material_estudio`, `ruta_archivo`, `tamano_bytes` y `estado`.

La API conserva los nombres que usa el front (`plan`, `topic`, `sessions`…) y los traduce a estas entidades en `backend/app/routers/plans.py`.

## 7. Material y RAG (HU-003)

LangChain + ChromaDB, con dos modelos locales y multilingües vía FastEmbed: `paraphrase-multilingual-MiniLM-L12-v2` para
los embeddings (~220 MB) y el cross-encoder `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` para el re-ranking (~470 MB).
Ambos tienen licencia Apache 2.0, no usan servicios pagos y se descargan la primera vez que se usan.

1. Al subir un archivo se valida su tipo por contenido (no solo la extensión), su tamaño, la cantidad por tema y la cuota del estudiante.
2. Se extrae el texto: PDF por página, DOCX por sección y PPTX por diapositiva. Se normaliza antes de fragmentar: NFKC
   (ligaduras como «ﬁ»), glifos ilegibles y caracteres de control de los PDF, y palabras cortadas con guion al final de línea.
   En las fuentes académicas en HTML se descarta la interfaz de la página (menús, índices, avisos, elementos ocultos,
   bloques que son solo enlaces) y se conservan los ejemplos de código.
3. Se divide en fragmentos de hasta 400 caracteres con 60 de superposición.
4. Cada fragmento se guarda en ChromaDB con los campos de FRAGMENTO_MATERIAL (Figura 6): `id_origen`, `id_tema`, `fuente`
   (propia/académica), `nombre_archivo` y `pagina_o_seccion`, y `orden` (su posición dentro del origen).
5. `material_estudio.estado` pasa de *pendiente* a *procesado*, *sin texto* (documento escaneado o solo imágenes) o *con error*.
6. Cada búsqueda, por fuente (académica y propia) del tema:
   - trae 20 candidatos de ChromaDB y descarta los de similitud coseno menor a **0,45** (calibrado, ver abajo);
   - los reordena con el cross-encoder, que lee la consulta y cada fragmento juntos (`puntaje_reranking`);
   - elige 6 con como mucho 3 de un mismo libro (en el material propio, sin máximo);
   - agrega a cada uno su `contexto` (el fragmento anterior y el siguiente de la misma sección) y fusiona los vecinos;
   - indica si alcanzan: al menos 2 fragmentos sobre el umbral (HU-003, CA5).

Todos estos valores están en la sección `[rag]` de `backend/parametros.toml`.

Fuentes académicas (Anexo 6): `backend/fuentes/catalogo.json` asigna a cada tema las fuentes F1 a F12 con sus secciones.
Se cargan una vez, desde `backend/` (descarga las páginas y PDF, registra cada fuente con su licencia e indexa):

```bash
python -m app.fuentes                 # descarga lo que falte y lo indexa (python -m app.fuentes --forzar: todo de nuevo)
python -m app.buscar "Recursividad" "¿para qué sirve el caso base?"   # prueba de recuperación
python -m app.evaluar --umbrales 0.4,0.45,0.5 --etiqueta "prueba"   # mide la recuperación y la agrega al informe
```

**Evaluación de la recuperación.** `backend/evaluacion/consultas.json` es el conjunto de prueba: 29 consultas en español
(15 de Recursividad, 3 de cada otro tema y 5 sin respuesta en las fuentes), cada una con las secciones que la responden.
`python -m app.evaluar` verifica que esas secciones existan en los textos y calcula acierto@1, acierto@6, MRR, las
consultas con respuesta que reúnen fragmentos suficientes, el rechazo de las que no tienen respuesta, la concentración
por fuente y la distribución de similitudes. `--umbrales` repite las métricas para cada umbral, `--param nombre=valor`
prueba otro valor de `[rag]` sin editar el archivo y `--etiqueta` agrega el resultado a `backend/evaluacion/informe.md`.

Resultados (detalle y justificación del umbral en el informe):

| etapa | acierto@1 | acierto@6 | MRR | con respuesta suficientes | sin respuesta rechazadas |
|---|---|---|---|---|---|
| inicial (umbral 0,5) | 0,46 | 0,67 | 0,53 | 79 % | 4 de 5 |
| limpieza + vecinos + diversidad + re-ranking, umbral 0,45 | 0,75 | 0,92 | 0,82 | 96 % | 4 de 5 |

## 8. Banco de ejercicios y reglas de Practicar (HU-005, HU-006, HU-007, HU-010 y HU-011)

**Banco** (`backend/app/banco/`): 36 ejercicios curados. Recursividad tiene 15 (5 básicos, 5 intermedios y 5 avanzados)
y los demás temas, 7 (2, 2 y 3). Cada uno tiene enunciado, dificultad, tiempo esperado, una firma independiente del
lenguaje (tipos `int`, `bool`, `str` e `int[]`), al menos tres casos de prueba y una solución de referencia en Python y
en Java. Las soluciones no se cargan en la base: los tests las ejecutan para garantizar que cada ejercicio tiene
solución y que sus salidas esperadas son correctas. Se carga una vez, desde `backend/`:

```bash
python -m app.ejercicios          # carga o actualiza los ejercicios en la tabla ejercicio
```

**Ejecución** (`services/codigo.py` y `services/ejecucion.py`): el estudiante escribe solo la función; la plataforma le
agrega los casos de prueba y envía el programa a Judge0 (token, consulta cada 1 s, 5 s de CPU, 128 MB, espera máxima
de 30 s y un reintento). El resultado se clasifica en correcto, error de sintaxis, de ejecución o lógico, con el tipo de
error normalizado ("sintaxis: cannot find symbol", "ejecución: RecursionError", "lógico: caso 3"). Para desarrollar sin
Judge0 existe un ejecutor local que corre el código en la misma máquina: se habilita con `EJECUCION_LOCAL=true` en el
`.env` y **nunca debe usarse en producción**. En producción se configuran `JUDGE0_URL` y `JUDGE0_API_KEY`.

**Reglas** (`services/practica.py` y `services/progreso.py`), funciones puras probadas con los ejemplos de las HU:
señal de bloqueo por tres intentos con el mismo error y dos líneas o menos de cambio, o por tiempo activo mayor a 2,5
veces el esperado con un intento fallido previo; pista mínima y, si persiste, explicación elaborada; puntos 10/7/4;
selección de los cinco ejercicios según el nivel inicial; nivel de dominio (0,3 × A + 0,4 × P + 0,3 × C) y estado de
cada módulo con la condición que falta.

**Intervenciones con Claude** (`services/llm.py` y `services/pistas.py`), a través de LangChain: la pista mínima la
redacta Claude Haiku y la explicación elaborada, Claude Sonnet, apoyada en los fragmentos del material del tema que
recupera el RAG. El modelo recibe el enunciado, el código con números de línea y el error, marcados como datos, con
la regla de no escribir código ni la solución. Cada respuesta se controla: si incluye código o es demasiado larga se
descarta. Sin `ANTHROPIC_API_KEY`, o si el modelo no responde en 20 s, se usan los textos de respaldo por categoría
de error. Para comprobar la clave y los dos modelos: `python -m app.services.llm`.

**Aprender** (`services/aprender.py` y `routers/aprender.py`, HU-003 y HU-004): plan del tema con los conceptos
recorridos; lección guiada en chat que explica cada concepto con citas al material y una pregunta de comprobación, y
responde consultas libres; tarjetas de memoria, cuestionario de práctica y repetición de lo fallado; evaluación de cinco
preguntas (cuatro de opción múltiple y una de respuesta breve) con la dificultad según el nivel inicial, que con el 60 %
habilita Practicar. Claude Sonnet genera el contenido a partir de los fragmentos del RAG y responde en JSON; antes de
mostrarlo se valida: citas que existan, contradicción solo entre material propio y una fuente académica, una única
respuesta correcta y la composición de la evaluación. En la respuesta breve, un elemento cuenta solo si su cita aparece en
lo que escribió el estudiante. Con material insuficiente (menos de dos fragmentos sobre el umbral) se avisa, y la respuesta
desde el conocimiento general del modelo queda marcada como no respaldada.

**Consolidar** (`services/consolidar.py` y `routers/consolidar.py`, HU-008): una charla con Brity en dos fases. Primero,
para cada concepto esperado, una pregunta disparadora que no nombra el concepto y alterna situaciones concretas y
preguntas conceptuales, con una exigencia según el nivel inicial; cada respuesta se evalúa en el momento y, si no muestra
el concepto, Brity repregunta en forma gradual (hasta tres veces) sin decir qué falta. Después, el estudiante explica el
tema en un párrafo, que se evalúa dos veces de forma independiente contra los conceptos esperados: correcta, incompleta,
incorrecta o no concluyente si las dos evaluaciones no coinciden. Cada concepto presente tiene que citar un fragmento que
esté en lo que escribió el estudiante; si no, cuenta como ausente. La charla se guarda en
`sesion_estudio.detalle_consolidar` y se retoma donde quedó; las repreguntas quedan como dificultades en el historial.

**Progreso** (`routers/progreso.py`, HU-009 a HU-012): dominio frente al requerido por la nota objetivo, plan de hoy,
estado de cada módulo (al elegir uno, el historial muestra solo lo suyo), dificultades con la ayuda recibida, sesiones y
puntos. El plan se reajusta según el avance, puede extenderse y, al alcanzar el objetivo, seguir con el nivel siguiente.

Si una respuesta del modelo que tiene que ser JSON se corta por el límite de tokens, se pide de nuevo con el doble de
espacio (`services/llm.py`).

## 9. Despliegue

La demo se publica en Railway como un solo servicio (API + frontend compilado). La configuración paso a paso está en [DESPLIEGUE.md](DESPLIEGUE.md).

## 10. Pruebas automáticas

Desde `backend/`, con el entorno activado: `python -m pytest -q`. Usan un modelo de lenguaje simulado, así que no
consumen la clave de Anthropic ni necesitan Judge0.
