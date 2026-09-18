# Plataforma de estudio · prototipo (TFG)

Prototipo de la *Plataforma Adaptativa de Estudio con Inteligencia Artificial*.
Sprint 1: inicio de sesión con Google, pantalla de inicio y configuración del plan de estudio.

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
| POST | `/api/plans/{id}/materials` | Sube un apunte (pdf, md, txt, docx, py · 10 MB) |
| GET | `/api/materials` | Material de los planes activos |
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
| `/app/configuracion` | Cuenta y apariencia |

La configuración sigue el flujo definido para la plataforma:

| Paso | Datos | Se usa en |
|---|---|---|
| 1. Configurar objetivo | tema, días disponibles, minutos por sesión, nivel inicial (0–3) | ruta adaptativa |
| 2. Subir material | apuntes (opcional) | material híbrido (pipeline RAG, próximo sprint) |
| 3. Revisar la ruta | sesiones por semana y por módulo | confirmación antes de crear |

El prototipo trabaja sobre **una única materia de programación**, según el alcance de la Entrega 1: el alumno elige el *tema* dentro de ella, no la materia. Esa materia se define en una sola constante (`MATERIA`, en `frontend/src/lib/format.js`).

El formato de estudio y la intensidad de las pistas no se piden al configurar: se eligen dentro de cada módulo.

El generador inicial (`backend/app/services/planner.py`) toma los días disponibles y los reparte entre Aprender → Practicar → Consolidar en ese orden, con proporciones según el nivel inicial. La ruta cubre siempre los tres módulos: si hay menos días que módulos (por ejemplo, un examen al día siguiente), varias sesiones caen en el mismo día. El recálculo según el avance real queda para un sprint posterior.

## 6. Próximos pasos

- Módulo Aprender (botón *Empezar sesión*).
- Pipeline RAG del material (LangChain + ChromaDB) con el loader del cerebro.
- Recalcular la ruta según el avance y calcular el dominio.
