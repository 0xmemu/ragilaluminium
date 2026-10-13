#!/usr/bin/env bash
# Dev-only: serve Laravel on 0.0.0.0:8200 via Nginx + php-fpm (run from app root).
# Static /build and /images are served by Nginx so Inertia/Vite chunks do not
# queue behind php artisan serve (classic white-screen on remote preview).
# Queue: start separately — php artisan queue:work database --queue=imports,media,default
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

# Rewrite root path in case APP_DIR differs from default, and inject the R2
# host only when the operator explicitly configured a public media URL/host.
MEDIA_R2_HOST_VALUE="${MEDIA_R2_HOST:-}"
if [[ -z "${MEDIA_R2_HOST_VALUE}" && -f .env ]]; then
  MEDIA_R2_URL_VALUE="$(awk -F= '/^(MEDIA_PUBLIC_URL|AWS_URL)=/ { value=$2; gsub(/\"|\r/, "", value); if (value != "") { print value; exit } }' .env)"
  MEDIA_R2_HOST_VALUE="$(printf '%s' "${MEDIA_R2_URL_VALUE}" | sed -E 's#^[a-zA-Z]+://([^/]+).*#\1#')"
fi
if [[ -n "${MEDIA_R2_HOST_VALUE}" ]]; then
  sed "s|/var/www/ragilaluminium|${ROOT}|g; s|__MEDIA_R2_HOST__|${MEDIA_R2_HOST_VALUE}|g" "${CONF_SRC}" > "${CONF_DST}.raw"
  sed '/MEDIA_PROXY_BEGIN/,/MEDIA_PROXY_END/ { /MEDIA_PROXY_BEGIN/d; /MEDIA_PROXY_END/d; }' "${CONF_DST}.raw" > "${CONF_DST}"
  rm -f "${CONF_DST}.raw"
else
  awk '/MEDIA_PROXY_BEGIN/{skip=1; next} /MEDIA_PROXY_END/{skip=0; next} !skip' "${CONF_SRC}" | sed "s|/var/www/ragilaluminium|${ROOT}|g" > "${CONF_DST}"
  echo "MEDIA_R2_HOST is unset; /media-cdn proxy disabled."
fi
ln -sfn "${CONF_DST}" "${ENABLED}"

# Avoid default site fighting for attention (keeps :80 free / default).
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx || systemctl restart nginx

echo "Serving ${ROOT} on 0.0.0.0:8200 via Nginx + php-fpm."
echo "Ensure UFW allows 8200. Queue separately: php artisan queue:work database --queue=imports,media,default --timeout=1800"
curl -sS -o /dev/null -w "health %{http_code}\n" "http://127.0.0.1:8200/" || true
