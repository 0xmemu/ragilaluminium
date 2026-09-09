#!/usr/bin/env bash
# ==============================================================================
# PROVISIONING SCRIPT: Ubuntu 24.04 LTS -> Ragil Aluminium Production Server
# Stack: Native Nginx + PHP 8.3-FPM + MySQL 8.0 + Redis + Node.js 20 + Composer
# ==============================================================================

set -euo pipefail

echo ">>> [1/8] Menyiapkan Swap Memory 2GB (Jaring Pengaman OOM)..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "Swap 2GB berhasil diaktifkan."
else
  echo "Swap sudah ada, lewati."
fi

echo ">>> [2/8] Memperbarui paket sistem Ubuntu 24.04 LTS..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  software-properties-common \
  curl \
  wget \
  git \
  unzip \
  zip \
  ufw \
  fail2ban \
  ca-certificates \
  gnupg \
  lsb-release \
  htop

echo ">>> [3/8] Memasang Nginx & Redis..."
apt-get install -y nginx redis-server
systemctl enable nginx redis-server
systemctl start nginx redis-server

echo ">>> [3/7] Memasang PHP 8.3-FPM beserta ekstensi yang dibutuhkan Laravel 11..."
apt-get install -y \
  php8.3-fpm \
  php8.3-cli \
  php8.3-mysql \
  php8.3-mbstring \
  php8.3-xml \
  php8.3-curl \
  php8.3-gd \
  php8.3-zip \
  php8.3-bcmath \
  php8.3-intl \
  php8.3-sqlite3 \
  php8.3-redis \
  php8.3-opcache

# Optimasi FPM dasar
sed -i 's/upload_max_filesize = .*/upload_max_filesize = 64M/' /etc/php/8.3/fpm/php.ini
sed -i 's/post_max_size = .*/post_max_size = 64M/' /etc/php/8.3/fpm/php.ini
sed -i 's/memory_limit = .*/memory_limit = 256M/' /etc/php/8.3/fpm/php.ini

systemctl enable php8.3-fpm
systemctl restart php8.3-fpm

echo ">>> [4/7] Memasang Composer & Node.js 20 LTS..."
if ! command -v composer &> /dev/null; then
  curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo ">>> [5/7] Memasang MySQL 8.0 Server..."
apt-get install -y mysql-server
systemctl enable mysql
systemctl start mysql

# Setup DB otomatis jika belum ada
DB_NAME="ragil_aluminium"
DB_USER="ragil_app"
DB_PASS="RagilProd2026Secure!"

mysql -u root <<MYSQL_EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF

echo "Database ${DB_NAME} & user ${DB_USER} siap."

echo ">>> [6/7] Menyiapkan Direktori & Izin www-data..."
mkdir -p /root/ragilaluminium
mkdir -p /root/ragilaluminium/storage/logs
chown -R www-data:www-data /root/ragilaluminium/storage 2>/dev/null || true

echo ">>> [7/7] Mengonfigurasi UFW Firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

echo "===================================================================="
echo "PROVISIONING SELESAI!"
echo "PHP: $(php -v | head -n 1)"
echo "Node: $(node -v)"
echo "Nginx: $(nginx -v 2>&1)"
echo "MySQL: active"
echo "Redis: active"
echo "===================================================================="
