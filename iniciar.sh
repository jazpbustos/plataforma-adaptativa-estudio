#!/usr/bin/env bash
# Inicia la plataforma en macOS o Linux (equivalente a iniciar.bat): instala lo necesario la primera vez,
# compila el frontend, levanta el backend (que entrega también el frontend) y abre http://localhost:8000.
# Uso, desde la carpeta del proyecto:  bash iniciar.sh      Para cerrarla: Ctrl+C.
set -e
cd "$(dirname "$0")"
RAIZ="$(pwd)"

PY=python3
command -v "$PY" >/dev/null 2>&1 || PY=python
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "No se encontró Python. Instalar Python 3.11 o superior desde https://www.python.org"; exit 1
fi

if [ ! -x "backend/.venv/bin/python" ]; then
  echo "[1/3] Primera vez: creando el entorno de Python e instalando dependencias..."
  "$PY" -m venv backend/.venv
  backend/.venv/bin/python -m pip install -r backend/requirements.txt
fi

if [ ! -f "backend/.env" ]; then
  echo "Falta el archivo backend/.env con la clave de Anthropic. Ver la guía de instalación."; exit 1
fi

if command -v npm >/dev/null 2>&1; then
  echo "[2/3] Compilando el frontend..."
  ( cd frontend && { [ -d node_modules ] || npm install; } && npm run build )
elif [ ! -f "frontend/dist/index.html" ]; then
  echo "No se encontró Node.js ni un frontend ya compilado. Instalar Node.js desde https://nodejs.org"; exit 1
else
  echo "[2/3] Node.js no está instalado: se usa el frontend ya compilado."
fi

echo "[3/3] Iniciando el servidor en http://localhost:8000   (para cerrarlo: Ctrl+C)"
export FRONTEND_DIR="$RAIZ/frontend/dist"
export FRONTEND_ORIGIN="http://localhost:8000"
(
  for _ in $(seq 1 120); do
    if curl -s -o /dev/null http://localhost:8000/api/health; then
      if command -v open >/dev/null 2>&1; then open http://localhost:8000; else xdg-open http://localhost:8000 >/dev/null 2>&1 || true; fi
      break
    fi
    sleep 1
  done
) &
cd backend
exec .venv/bin/python -m uvicorn app.main:app --port 8000
