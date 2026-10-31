# Despliegue en Railway

La demo corre como **un solo servicio**: el mismo servidor entrega la API (`/api/...`) y el frontend
compilado. Front y back comparten dominio, así que la cookie de sesión funciona igual que en local.

Archivos que intervienen: `Dockerfile`, `railway.json`, `backend/start.sh` y `backend/app/produccion.py`.

## Qué pasa en cada deploy

1. Railway construye la imagen con el `Dockerfile`: compila el frontend, instala el backend y descarga
   los modelos de embeddings y re-ranking (unos 700 MB). Los modelos quedan dentro de la imagen.
2. Al arrancar, `start.sh` crea las tablas, carga los temas y el banco de ejercicios, y abre el servidor.
3. La primera vez, en segundo plano, descarga e indexa las fuentes académicas (Anexo 6). Tarda unos
   minutos y el registro queda en `/data/fuentes.log`. Si alguna descarga falla, se reintenta en el
   próximo arranque.
4. La base SQLite, ChromaDB y el material subido se guardan en el **volumen** `/data`, así que no se
   borran entre deploys.

Cada `git push` a la rama principal dispara un deploy nuevo.

## Configuración (una sola vez)

### 1. Cuenta y proyecto

1. Crear una cuenta en [railway.com](https://railway.com) con GitHub y pasar al plan **Hobby**. El plan de
   prueba limita la RAM a 512 MB y no alcanza para los modelos.
2. **New Project → Deploy from GitHub repo** y elegir `plataforma-adaptativa-estudio`. Railway detecta
   `railway.json` y construye con el `Dockerfile`.

### 2. Volumen

En el servicio: **Add Volume** (o clic derecho sobre el servicio) con *Mount path* `/data`.

### 3. Variables de entorno (pestaña *Variables*)

| Variable | Valor |
|---|---|
| `JWT_SECRET` | Una cadena larga al azar. Generarla con `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `GOOGLE_CLIENT_ID` | El mismo Client ID del `.env` local |
| `FRONTEND_ORIGIN` | La URL pública del paso 4, por ejemplo `https://plataforma-estudio.up.railway.app` |
| `JUDGE0_URL` | `https://judge0-ce.p.rapidapi.com` |
| `JUDGE0_API_KEY` | La clave de RapidAPI |
| `ANTHROPIC_API_KEY` | La clave de Anthropic (cuando se conecte Claude) |

Las claves van **solo** acá: nunca en el repositorio ni en el frontend. El `Dockerfile` ya fija el resto
(rutas en `/data`, `COOKIE_SECURE=true`, `DEV_LOGIN=false`, `EJECUCION_LOCAL=false`).

### 4. Dominio público

**Settings → Networking → Generate Domain**. Esa es la URL de la demo y la que va en `FRONTEND_ORIGIN`.

### 5. Google (login)

En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), en el Client ID de OAuth:

- **Orígenes autorizados de JavaScript**: agregar la URL de Railway (sin barra final).
- **Pantalla de consentimiento**: mientras la app está en modo *Testing* solo pueden entrar los usuarios
  de prueba cargados ahí. Para que entre cualquier persona, como la evaluadora, hay que pasarla a
  **In production**. Con los permisos básicos (correo y perfil) no hace falta verificación de Google.

## Comprobar que anda

- `https://<dominio>/api/health` devuelve `{"ok":true}`.
- En la pestaña *Deployments → Logs* aparece `Uvicorn running`.
- El estado de las fuentes académicas se ve en los logs, en la línea de `/data/fuentes.log`, o desde
  la consola del servicio con `cat /data/fuentes.log`.

## Problemas comunes

- **`/bin/sh^M: not found` al arrancar**: `start.sh` se guardó con finales de línea de Windows. El
  `.gitattributes` del repo lo evita; si ya pasó, ejecutar `git add --renormalize .` y volver a hacer commit.
- **El servicio se reinicia por memoria**: revisar en *Metrics* el consumo. Con los dos modelos cargados
  ronda 1,5 GB.
- **El login de Google falla con `origin_mismatch`**: falta la URL de Railway en los orígenes autorizados.
