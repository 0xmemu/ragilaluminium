#!/usr/bin/env bash
# Bootstrap Ragil website.4.0 on Ubuntu 22.04/24.04 — DEV workstation only.
# Usage (as root/sudo):
#   export RAGIL_GIT_URL='git@github.com:ORG/website.4.0.git'
#   export RAGIL_APP_URL='http://YOUR_VPS_IP:8200'
#   sudo -E bash scripts/dev-vps/bootstrap.sh
#
# If the tree is already on the VPS (rsync/scp), omit RAGIL_GIT_URL.
#
# Optional:
#   RAGIL_APP_DIR=/var/www/website.4.0
#   RAGIL_DB_NAME=ragil RAGIL_DB_USER=ragil RAGIL_DB_PASS=...
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo -E bash $0" >&2
  exit 1
fi

APP_DIR="${RAGIL_APP_DIR:-/var/www/website.4.0}"
GIT_URL="${RAGIL_GIT_URL:-}"
APP_URL="${RAGIL_APP_URL:-http://127.0.0.1:8200}"
DB_NAME="${RAGIL_DB_NAME:-ragil}"
DB_USER="${RAGIL_DB_USER:-ragil}"
DB_PASS="${RAGIL_DB_PASS:-}"
APP_OWNER="${SUDO_USER:-root}"

if [[ -z "${DB_PASS}" ]]; then
  DB_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Base packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git unzip zip software-properties-common

# PHP 8.2+ (prefer 8.3 on Ubuntu 24.04, else 8.2)
PHP_VER=""
if apt-cache show php8.3-cli >/dev/null 2>&1; then
  PHP_VER=8.3
elif apt-cache show php8.2-cli >/dev/null 2>&1; then
  PHP_VER=8.2
else
  echo "No php8.2/8.3 packages found." >&2
  exit 1
fi

echo "==> PHP ${PHP_VER}, MySQL, Composer deps"
apt-get install -y \
  mysql-server \
  "php${PHP_VER}-cli" "php${PHP_VER}-fpm" "php${PHP_VER}-mysql" "php${PHP_VER}-sqlite3" \
  "php${PHP_VER}-mbstring" "php${PHP_VER}-xml" "php${PHP_VER}-curl" "php${PHP_VER}-zip" \
  "php${PHP_VER}-gd" "php${PHP_VER}-bcmath" "php${PHP_VER}-intl" "php${PHP_VER}-tokenizer"

apt-get install -y "php${PHP_VER}-redis" 2>/dev/null || true

if ! command -v composer >/dev/null 2>&1; then
  curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
fi
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "==> Node.js 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> MySQL database ${DB_NAME}"
systemctl enable --now mysql
mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" || true
mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;"

echo "==> Application tree ${APP_DIR}"
mkdir -p "$(dirname "${APP_DIR}")"
if [[ ! -f "${APP_DIR}/artisan" ]]; then
  if [[ -z "${GIT_URL}" ]]; then
    echo "No Laravel app at ${APP_DIR} and RAGIL_GIT_URL is empty." >&2
    echo "Clone/rsync the project first, or set RAGIL_GIT_URL." >&2
    exit 1
  fi
  git clone "${GIT_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
chown -R "${APP_OWNER}:${APP_OWNER}" "${APP_DIR}"

echo "==> Composer + npm"
sudo -u "${APP_OWNER}" composer install --no-interaction --prefer-dist
if [[ -f package-lock.json ]]; then
  sudo -u "${APP_OWNER}" npm ci
else
  sudo -u "${APP_OWNER}" npm install
fi

if [[ ! -f .env ]]; then
  sudo -u "${APP_OWNER}" cp .env.example .env
fi

sudo -u "${APP_OWNER}" php artisan key:generate --force || true

set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    printf '%s=%s\n' "${key}" "${val}" >> .env
  fi
}

set_env APP_ENV local
set_env APP_DEBUG true
set_env APP_URL "${APP_URL}"
set_env DB_CONNECTION mysql
set_env DB_HOST 127.0.0.1
set_env DB_PORT 3306
set_env DB_DATABASE "${DB_NAME}"
set_env DB_USERNAME "${DB_USER}"
set_env DB_PASSWORD "${DB_PASS}"
set_env QUEUE_CONNECTION database
set_env SESSION_DRIVER database
set_env MEDIA_DISK local

chown "${APP_OWNER}:${APP_OWNER}" .env

sudo -u "${APP_OWNER}" php artisan migrate --force
sudo -u "${APP_OWNER}" npm run build
rm -f public/hot
sudo -u "${APP_OWNER}" php artisan storage:link || true
sudo -u "${APP_OWNER}" php artisan config:clear

echo ""
echo "======== DEV BOOTSTRAP OK ========"
echo "PHP=$(php -v | head -1)"
echo "NODE=$(node -v)"
echo "APP_DIR=${APP_DIR}"
echo "APP_URL=${APP_URL}"
echo "DB_DATABASE=${DB_NAME}"
echo "DB_USERNAME=${DB_USER}"
echo "DB_PASSWORD=${DB_PASS}"
echo ""
echo "Firewall: sudo bash scripts/dev-vps/ufw-allow.sh"
echo "Serve:    bash scripts/dev-vps/serve-dev.sh"
echo "Queue:    php artisan queue:work --tries=3"
echo "Cursor:   Remote-SSH → Open Folder ${APP_DIR}"
echo "=================================="
