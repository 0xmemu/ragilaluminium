#!/usr/bin/env bash
#
# apply-live-events-202.sh - Terapkan perubahan infrastruktur live events ke VPS 202.
#
# Kenapa ada berkas ini: perubahan menyentuh /etc (systemd unit, nginx, php-fpm pool)
# yang tidak ikut deploy aplikasi. Tanpa skrip ini, perubahan itu harus disalin
# manual dan tidak tercatat. Skrip ini idempoten: aman dijalankan berulang.
#
# Isi: Tahap 1 rancangan docs/RANCANGAN-LIVE-EVENTS-ADMIN.md
#   1. laravel-reverb: Restart=always + StartLimitIntervalSec=0 + log ke shared
#   2. ragil-queue: hanya pekerjaan panjang (imports, media, default)
#   3. ragil-queue-fast: pekerjaan pendek (broadcast) - BARU
#   4. nginx: limit_req endpoint poll + fastcgi_read_timeout 300 -> 60
#   5. php-fpm: pm.max_children 12 -> 24
#
# Pakai:
#   sudo bash apply-live-events-202.sh --dry-run   # lihat rencana
#   sudo bash apply-live-events-202.sh             # terapkan
#
set -euo pipefail

APP=/var/www/ragilaluminium
SRC="$APP/repository"
BAK="$APP/_backup-pre-liveevents"
NGX_HTTP=/etc/nginx/conf.d/00-ragil-http.conf
NGX_SITE=/etc/nginx/sites-available/ragilaluminium.com
POOL=/etc/php/8.3/fpm/pool.d/www.conf
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

log() { printf '%s %s\n' "$(date '+%F %T')" "$*"; }
run() { if [ "$DRY" = 1 ]; then log "[dry-run] $*"; else "$@"; fi; }

[ "$(id -u)" = 0 ] || { echo "jalankan sebagai root" >&2; exit 1; }

log "=== apply-live-events-202 mulai (dry_run=$DRY) ==="

# --- 0. Pastikan sumber ada di repo ----------------------------------------
for f in deploy/systemd/laravel-reverb.service \
         deploy/systemd/ragil-queue.service \
         deploy/systemd/ragil-queue-fast.service \
         deploy/nginx/00-ragil-http.conf \
         deploy/nginx/sites-available-ragilaluminium.com.conf; do
  [ -f "$SRC/$f" ] || { log "GAGAL: sumber tidak ada: $SRC/$f"; exit 1; }
done
log "sumber di repo lengkap"

# --- 0b. Cadangan konfigurasi sekarang (bila belum ada) --------------------
if [ "$DRY" = 0 ]; then
  mkdir -p "$BAK"
  cp -a /etc/systemd/system/laravel-reverb.service "$BAK/" 2>/dev/null || true
  cp -a /etc/systemd/system/ragil-queue.service     "$BAK/" 2>/dev/null || true
  cp -a "$NGX_HTTP" "$BAK/00-ragil-http.conf"       2>/dev/null || true
  cp -a "$NGX_SITE" "$BAK/sites-available-ragilaluminium.com" 2>/dev/null || true
  cp -a "$POOL"     "$BAK/www.conf"                 2>/dev/null || true
  log "cadangan ada di $BAK"
fi

# --- 1. systemd unit -------------------------------------------------------
log "pasang unit systemd..."
run install -m 0644 -o root -g root "$SRC/deploy/systemd/laravel-reverb.service"   /etc/systemd/system/laravel-reverb.service
run install -m 0644 -o root -g root "$SRC/deploy/systemd/ragil-queue.service"     /etc/systemd/system/ragil-queue.service
run install -m 0644 -o root -g root "$SRC/deploy/systemd/ragil-queue-fast.service" /etc/systemd/system/ragil-queue-fast.service
run systemctl daemon-reload
run systemctl enable ragil-queue-fast

# --- 2. nginx --------------------------------------------------------------
# Uji konfigurasi lebih dulu. Kalau gagal, konfigurasi lama dikembalikan dan
# skrip berhenti, sehingga situs tidak pernah mati karena salah ketik.
log "pasang konfigurasi nginx..."
if [ "$DRY" = 0 ]; then
  cp "$SRC/deploy/nginx/00-ragil-http.conf" "$NGX_HTTP"
  cp "$SRC/deploy/nginx/sites-available-ragilaluminium.com.conf" "$NGX_SITE"
  if ! nginx -t; then
    log "nginx -t GAGAL, kembalikan konfigurasi sebelumnya"
    cp "$BAK/00-ragil-http.conf" "$NGX_HTTP" 2>/dev/null || true
    cp "$BAK/sites-available-ragilaluminium.com" "$NGX_SITE" 2>/dev/null || true
    nginx -t || true
    exit 1
  fi
  log "nginx -t OK"
else
  log "[dry-run] cp 00-ragil-http.conf -> $NGX_HTTP"
  log "[dry-run] cp sites-available -> $NGX_SITE"
fi

# --- 3. php-fpm pool -------------------------------------------------------
log "naikkan kolam php-fpm..."
if [ "$DRY" = 0 ]; then
  sed -i 's/^pm.max_children = .*/pm.max_children = 24/' "$POOL"
  sed -i 's/^pm.start_servers = .*/pm.start_servers = 6/' "$POOL"
  sed -i 's/^pm.min_spare_servers = .*/pm.min_spare_servers = 4/' "$POOL"
  sed -i 's/^pm.max_spare_servers = .*/pm.max_spare_servers = 12/' "$POOL"
  php-fpm8.3 -t
else
  log "[dry-run] pm.max_children 12 -> 24, start_servers 6, min_spare 4, max_spare 12"
fi

# --- 4. Muat ulang layanan -------------------------------------------------
log "muat ulang layanan..."
run systemctl restart laravel-reverb
run systemctl restart ragil-queue
run systemctl reload php8.3-fpm
run systemctl reload nginx

# --- 5. Verifikasi --------------------------------------------------------
log "verifikasi..."
if [ "$DRY" = 0 ]; then
  sleep 3
  for svc in laravel-reverb ragil-queue ragil-queue-fast php8.3-fpm nginx; do
    printf '  %-20s %s\n' "$svc" "$(systemctl is-active "$svc")"
  done
  printf '  %-20s %s\n' "kolam php" "$(grep -E '^pm.max_children' "$POOL")"
  printf '  %-20s %s\n' "limit_req" "$(grep -c limit_req "$NGX_SITE") blok di vhost"
  printf '  %-20s %s\n' "situs" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://ragilaluminium.com/ || echo 000)"
fi

log "=== apply-live-events-202 selesai ==="
log "Balik: cp $BAK/* ke lokasi asal, daemon-reload, muat ulang layanan."
