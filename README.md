# Plataforma de estudio · prototipo (TFG)

Prototipo de la *Plataforma Adaptativa de Estudio con Inteligencia Artificial*.
Sprint 1: inicio de sesión con Google, pantalla de inicio, configuración del plan de estudio y carga del material con RAG,
alineados con la Entrega 3 (historias de usuario HU-001 a HU-003, DER, diccionario de datos y Seguridad).

Todas las reglas y umbrales del diseño (días, notas, límites de carga, etapas del RAG, modelos, detector de bloqueos,
puntos y fórmula de dominio) están en **`backend/parametros.toml`**, para poder reproducir las pruebas con los mismos valores.

```
plataforma-estudio/
├── backend/    FastAPI + SQLModel (SQLite) · auth con Google + JWT en cookie
└── frontend/   React + Vite + Tailwind v4 · tokens de la identidad visual v0.5
```

## 1. Levantarlo en local

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
| POST | `/api/auth/dev` | Login demo (solo `DEV_LOGIN=true`) |
| GET | `/api/auth/me` | Usuario actual |
| POST | `/api/auth/logout` | Cierra sesión |
| POST | `/api/plans/preview` | Calcula la ruta sin guardarla |
| POST | `/api/plans` | Crea el plan y sus sesiones |
| GET | `/api/plans` | Planes del usuario |
| POST | `/api/plans/{id}/materials` | Sube un apunte: PDF, DOCX o PPTX (validado por contenido) · 25 MB · 20 por tema · cuota de 200 MB |
| GET | `/api/materials` | Material de los planes activos (con su estado de procesamiento) |
| GET | `/api/materials/limits` | Límites de carga y cuota usada |
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
| `/app/aprender`, `/practicar`, `/consolidar` | Módulos (en construcción) |
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

## 8. Próximos pasos

- Servicio del modelo de lenguaje (Claude) y contraste de fuentes (HU-003, CA4).
- Módulos Aprender, Practicar (editor Monaco + Judge0 + detector de bloqueos) y Consolidar.
- Cálculo del dominio, desbloqueo de módulos y reajuste del plan.
