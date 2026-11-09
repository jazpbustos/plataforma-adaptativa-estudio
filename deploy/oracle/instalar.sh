#!/usr/bin/env bash
# Instala y levanta la plataforma en una máquina virtual Ubuntu (Oracle Cloud Always Free).
# Uso, desde esta carpeta: ./instalar.sh   ·   Para actualizar después de un git push: ./actualizar.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1. Docker"
if ! command -v docker >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-v2
fi

echo "== 2. Puertos 80 y 443 (las imágenes de Ubuntu de Oracle los bloquean por defecto)"
for puerto in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$puerto" -m state --state NEW -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 6 -p tcp --dport "$puerto" -m state --state NEW -j ACCEPT
  fi
done
command -v netfilter-persistent >/dev/null || sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

echo "== 3. Configuración"
if [ ! -f .env ]; then
  cp .env.ejemplo .env
  ip=$(curl -fsS https://ifconfig.me)
  dominio="${ip//./-}.sslip.io"
  pedir() { local valor; read -r -p "$2: " valor; sed -i "s|^$1=.*|$1=$valor|" .env; }
  sed -i "s|^DOMINIO=.*|DOMINIO=$dominio|" .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
  pedir ANTHROPIC_API_KEY "Clave de Anthropic"
  pedir JUDGE0_API_KEY "Clave de Judge0 (RapidAPI)"
  pedir GOOGLE_CLIENT_ID "Client ID de Google (Enter para dejarlo vacío)"
  pedir CLAVE_ACCESO "Clave de acceso para los docentes (Enter para no habilitarla)"
  chmod 600 .env
fi
dominio=$(grep '^DOMINIO=' .env | cut -d= -f2)

echo "== 4. Construcción y arranque (la primera vez tarda unos 15 minutos)"
sudo docker compose up -d --build

echo
echo "Listo. La plataforma queda en: https://$dominio"
echo "La primera vez, las fuentes académicas se cargan en segundo plano durante unos minutos."
echo "Registro: sudo docker compose logs -f app"
