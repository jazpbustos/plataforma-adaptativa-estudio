#!/bin/sh
# Arranque en producción (Railway). Los datos viven en el volumen montado en /data.
set -e
mkdir -p /data/uploads /data/chroma

# Crea las tablas y carga temas y ejercicios antes de abrir el servidor.
python -c "from app.db import init_db; init_db()"

# La primera vez descarga e indexa las fuentes académicas en segundo plano: el servidor ya atiende mientras tanto.
python -m app.produccion fuentes > /data/fuentes.log 2>&1 &

# Un solo proceso: SQLite y los modelos cargados en memoria no se comparten entre procesos.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
