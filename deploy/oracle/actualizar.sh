#!/usr/bin/env bash
# Trae los últimos cambios del repositorio y reconstruye la app. Los datos (volumen) se conservan.
set -euo pipefail
cd "$(dirname "$0")"
git pull
sudo docker compose up -d --build
sudo docker image prune -f
