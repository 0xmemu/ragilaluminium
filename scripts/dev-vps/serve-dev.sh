#!/usr/bin/env bash
# Dev-only: serve Laravel on 0.0.0.0:8200 via Nginx + php-fpm (run from app root).
# Static /build and /images are served by Nginx so Inertia/Vite chunks do not
# queue behind php artisan serve (classic white-screen on remote preview).
# Queue: start separately — php artisan queue:work --tries=3
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

CONF_SRC="${ROOT}/scripts/dev-vps/nginx-ragil-dev.conf"
CONF_DST="/etc/nginx/sites-available/ragil-dev"
ENABLED="/etc/nginx/sites-enabled/ragil-dev"

rm -f public/hot

if [[ "${EUID}" -ne 0 ]]; then
  echo "Nginx bind :8200 needs root. Re-run:" >&2
  echo "  sudo bash scripts/dev-vps/serve-dev.sh" >&2
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y nginx
fi

if ! systemctl is-active --quiet php8.3-fpm && ! systemctl is-active --quiet php8.2-fpm; then
  systemctl enable --now php8.3-fpm 2>/dev/null || systemctl enable --now php8.2-fpm
fi

# Free :8200 if old artisan serve is still bound.
if command -v fuser >/dev/null 2>&1; then
  fuser -k 8200/tcp 2>/dev/null || true
else
  pkill -f "artisan serve --host=0.0.0.0 --port=8200" 2>/dev/null || true
  pkill -f "php8.3 -S 0.0.0.0:8200" 2>/dev/null || true
fi
sleep 0.5

# Rewrite root path in case APP_DIR differs from default.
sed "s|/var/www/website.4.0|${ROOT}|g" "${CONF_SRC}" > "${CONF_DST}"
ln -sfn "${CONF_DST}" "${ENABLED}"

# Avoid default site fighting for attention (keeps :80 free / default).
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx || systemctl restart nginx

echo "Serving ${ROOT} on 0.0.0.0:8200 via Nginx + php-fpm."
echo "Ensure UFW allows 8200. Queue separately: php artisan queue:work --tries=3"
curl -sS -o /dev/null -w "health %{http_code}\n" "http://127.0.0.1:8200/" || true
