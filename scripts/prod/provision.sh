#!/usr/bin/env bash
# Provision VPS produksi Ragil Aluminium — setup otomatis semua service.
# Jalankan SEKALI sebagai root di VPS baru Ubuntu 24.04. Idempotent (aman dijalankan ulang).
# Pakai: bash provision.sh
# Setelah itu: isi .env (cp .env.example .env), lalu php artisan key:generate, deploy.sh
set -euo pipefail

echo "=== [$PROVISION $(date '+%F %T')] Ragil Aluminium VPS provision ==="

# ---------- 1. Detect platform ----------
if ! grep -qiE 'ubuntu' /etc/os-release 2>/dev/null; then
  echo "ERROR: script ini ditujukan untuk Ubuntu (24.04 LTS). Deteksi: $(cat /etc/os-release | head -1)"
  exit 1
fi

# ---------- 2. Update & base packages ----------
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y software-properties-common curl wget git unzip gnupg nginx mysql-server \
  redis-server ca-certificates lsb-release ufw fail2ban python3 python3-pip

# ---------- 3. PHP 8.3 ----------
add-apt-repository -y ppa:ondrej/php
apt-get update -y
apt-get install -y php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl \
  php8.3-zip php8.3-gd php8.3-intl php8.3-bcmath php8.3-sqlite3 php8.3-bz2 php8.3-readline

# ---------- 4. Composer ----------
if ! command -v composer >/dev/null 2>&1; then
  php -r "copy('https://getcomposer.org/installer', '/tmp/composer-setup.php');"
  php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer
  rm -f /tmp/composer-setup.php
fi

# ---------- 5. Node 22 (LTS) ----------
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g npm@latest

# ---------- 6. Services: enable & start ----------
systemctl enable nginx php8.3-fpm mysql redis-server
systemctl start nginx php8.3-fpm mysql redis-server

# ---------- 7. UFW firewall (deny + SSH/HTTPS) ----------
# PASTIKAN SSH anda sedang via key, bukan password, sebelum enable.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# ---------- 8. fail2ban (sshd) ----------
if [ ! -f /etc/fail2ban/jail.local ]; then
  cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
[sshd]
enabled = true
port = ssh
EOF
  systemctl restart fail2ban
fi

# ---------- 9. MySQL: timezone UTC (wajib) ----------
cat > /etc/mysql/mysql.conf.d/zz-ragil-timezone.cnf <<EOF
[mysqld]
default-time-zone = +00:00
EOF
systemctl restart mysql

# ---------- 10. Redis: harden (localhost + maxmemory) ----------
cat >> /etc/redis/redis.conf <<EOF

# Ragil provision
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF
systemctl restart redis-server

# ---------- 11. Nginx: server_tokens off ----------
if grep -q 'server_tokens' /etc/nginx/nginx.conf; then
  sed -i 's/# server_tokens off;/server_tokens off;/' /etc/nginx/nginx.conf
else
  echo 'server_tokens off;' >> /etc/nginx/nginx.conf
fi
nginx -t && systemctl reload nginx

# ---------- 12. Sudo/blast disk cache ----------
mkdir -p /var/log/php8.3-fpm-slow.log && chown www-data:www-data /var/log/php8.3-fpm-slow.log 2>/dev/null || true

echo "=== [$PROVISION $(date '+%F %T')] SELESAI — service siap ==="
echo ""
echo "LANGKAH BERIKUTNYA (lihat PRODUCTION.md):"
echo "  1. cp /root/ragilaluminium/.env.example /root/ragilaluminium/.env"
echo "  2. Isi APP_KEY, APP_URL(domain), DB_*, R2, WA, JNT, SOCIAL, BANK"
echo "  3. php artisan key:generate ; config:cache"
echo "  4. scripts/prod/deploy.sh --branch=main (dari repo)"
echo "  5. Setup Cloudflare tunnel / DNS -> HTTPS"
echo ""
echo "Catatan keamanan: pastikan SSH pakai key (bukan password) sebelum enable ufw."