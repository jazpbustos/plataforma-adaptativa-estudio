# Imagen de producción: un solo servicio que entrega la API y el frontend compilado (mismo dominio).

# 1) Frontend: npm run build -> /front/dist
FROM node:22-slim AS front
WORKDIR /front
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Backend
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FASTEMBED_CACHE_PATH=/models \
    FRONTEND_DIR=/app/frontend \
    DATABASE_URL=sqlite:////data/plataforma.db \
    CHROMA_DIR=/data/chroma \
    UPLOAD_DIR=/data/uploads \
    COOKIE_SECURE=true \
    DEV_LOGIN=false \
    EJECUCION_LOCAL=false \
    DESBLOQUEAR_MODULOS=false
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# Los modelos de embeddings y re-ranking (~700 MB) quedan dentro de la imagen.
RUN python -m app.produccion modelos
COPY --from=front /front/dist /app/frontend

RUN chmod +x start.sh
CMD ["./start.sh"]
