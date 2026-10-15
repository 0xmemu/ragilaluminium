#!/usr/bin/env bash
# Backup konfigurasi VPS produksi 202, terenkripsi, ke R2.
#
# Mengapa ada: .env, konfigurasi privat /root/.config/ragilaluminium/, konfigurasi
# nginx, PHP-FPM, systemd, cron, dan skrip operasional tidak punya salinan sama
# sekali. Kalau server hilang, seluruh kredensial (database, R2, J&T, WhatsApp,
# Telegram) harus disusun ulang manual dari ingatan, dan itu membuat pemulihan
# mustahil, bukan sekadar lama.
#
# KUNCI DIKELOLA SISTEM SEPENUHNYA. Tidak ada langkah manual berulang:
#   - kalau kunci belum ada, skrip ini membuatnya sendiri (openssl rand);
#   - kunci disimpan mode 600 milik root, hanya bisa dibaca skrip backup;
#   - tidak pernah dicetak ke log maupun ke layar.
# Salinan kunci untuk keadaan darurat dikirim SEKALI ke Telegram oleh
# kirim-kunci-backup.sh. Selama kunci belum pernah terkirim, skrip ini menandai
# keadaannya supaya tidak diam-diam tidak terlindungi.
#
# Isi arsip memuat RAHASIA, jadi WAJIB terenkripsi sebelum meninggalkan server.
# Arsip tidak pernah ditulis dalam bentuk terang ke disk.
#
# Dijalankan cron sebagai root.
set -uo pipefail
source /root/ragil-backup/ragil-backup.env

ALERT_DIR=/root/backups
LOG="$ALERT_DIR/config-backup.log"
KEY="$ALERT_DIR/.config-backup-key"
MARKER_TERKIRIM="$ALERT_DIR/.config-key-terkirim"
WORK=$(mktemp -d /tmp/cfgbackup.XXXXXX)
STAMP=$(date +%Y%m%d-%H%M%S)
NAME="config-202-${STAMP}.tar.gz.enc"

R2_BUCKET="ra-backup-prod"
R2_PREFIX="config/"
R2_PUT=/root/ragil-backup/r2_put.py
SIMPAN_LOKAL=14

catat() { printf '%s %s\n' "$(date '+%F %T')" "$1" >> "$LOG"; }
bersihkan() { rm -rf "$WORK"; }
trap bersihkan EXIT

catat "=== mulai ==="

# --- 1. Kunci: dibuat sistem kalau belum ada --------------------------------
if [ ! -s "$KEY" ]; then
  umask 077
  openssl rand -base64 48 > "$KEY"
  chmod 600 "$KEY"
  chown root:root "$KEY"
  catat "kunci baru dibuat oleh sistem (mode 600)"
fi
if [ ! -s "$KEY" ]; then
  catat "GAGAL: kunci tidak tersedia"
  exit 1
fi

# --- 2. Daftar berkas yang dicakup ------------------------------------------
# Jalur relatif terhadap akar, dipakai untuk tar -C / dan untuk restore.
DAFTAR="$WORK/daftar.txt"
cat > "$DAFTAR" <<'EOF'
var/www/ragilaluminium/shared/.env
root/.config/ragilaluminium/cloudflare.env
root/.config/ragilaluminium/db-app.env
root/.config/ragilaluminium/telegram.env
root/ragil-backup/ragil-backup.env
root/ragil-backup/daily-db-backup.sh
root/ragil-backup/hourly-binlog-backup.sh
root/ragil-backup/stale-check.sh
root/ragil-backup/weekly-restore-drill.sh
root/ragil-backup/ragil-health-alert.sh
root/ragil-backup/r2_put.py
root/ragil-backup/cutover-to-laravel.sh
root/ragil-backup/rollback-to-standby.sh
root/scripts_tg_alert.sh
root/backups/backup-alert.sh
root/backups/r2_freshness.py
root/backups/config-backup.sh
root/backups/config-restore.sh
root/backups/kirim-kunci-backup.sh
etc/nginx/nginx.conf
etc/nginx/sites-available/ragilaluminium.com
etc/nginx/sites-available/default
etc/systemd/system/ragil-queue.service
etc/systemd/system/laravel-reverb.service
etc/systemd/system/baileys-bot.service
etc/php/8.3/fpm/pool.d/www.conf
etc/php/8.3/fpm/php.ini
etc/logrotate.d/ragil-backups
var/spool/cron/crontabs/root
var/spool/cron/crontabs/www-data
root/.ssh/authorized_keys
home/jendelaragilaluminium/.ssh/authorized_keys
EOF

ADA="$WORK/ada.txt"
HILANG="$WORK/hilang.txt"
: > "$ADA"
: > "$HILANG"
while IFS= read -r jalur; do
  [ -n "$jalur" ] || continue
  if [ -e "/$jalur" ]; then
    echo "$jalur" >> "$ADA"
  else
    echo "$jalur" >> "$HILANG"
  fi
done < "$DAFTAR"

JUMLAH=$(wc -l < "$ADA" | tr -d ' ')
catat "berkas dicakup: $JUMLAH"
if [ -s "$HILANG" ]; then
  catat "catatan: belum ada di server: $(tr '\n' ' ' < "$HILANG")"
fi
if [ "$JUMLAH" -lt 10 ]; then
  catat "GAGAL: hanya $JUMLAH berkas ditemukan, arsip dibatalkan"
  exit 1
fi

# --- 3. Bangun arsip, enkripsi, tanpa menyentuh disk dalam bentuk terang ----
TERANG="$WORK/isi.tar.gz"
ENKRIP="$WORK/$NAME"
if ! tar -czf "$TERANG" -C / -T "$ADA" 2>>"$LOG"; then
  catat "GAGAL: pembuatan arsip"
  exit 1
fi
if ! gzip -t "$TERANG"; then
  catat "GAGAL: verifikasi gzip"
  exit 1
fi

if ! openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
      -pass file:"$KEY" -in "$TERANG" -out "$ENKRIP" 2>>"$LOG"; then
  catat "GAGAL: enkripsi"
  exit 1
fi

# --- 4. Verifikasi integritas: arsip harus bisa dibuka lagi -----------------
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
      -pass file:"$KEY" -in "$ENKRIP" 2>/dev/null | tar -tzf - >/dev/null 2>>"$LOG"; then
  catat "GAGAL: verifikasi dekripsi, arsip tidak diunggah"
  exit 1
fi

SHA=$(sha256sum "$ENKRIP" | cut -d' ' -f1)
printf '%s  %s\n' "$SHA" "$NAME" > "$WORK/$NAME.sha256"
UKURAN=$(du -h "$ENKRIP" | cut -f1)
catat "arsip siap: $NAME ($UKURAN) sha256=${SHA:0:16}..."

# --- 5. Simpan lokal (retensi) ----------------------------------------------
cp "$ENKRIP" "$ALERT_DIR/$NAME"
cp "$WORK/$NAME.sha256" "$ALERT_DIR/$NAME.sha256"
ls -1t "$ALERT_DIR"/config-202-*.tar.gz.enc 2>/dev/null | tail -n +$((SIMPAN_LOKAL + 1)) | while read -r lama; do
  rm -f "$lama" "$lama.sha256"
  catat "hapus salinan lokal lama: $(basename "$lama")"
done

# --- 6. Unggah off-site -----------------------------------------------------
if python3 "$R2_PUT" "$R2_BUCKET" "${R2_PREFIX}${NAME}" "$ENKRIP" >> "$LOG" 2>&1; then
  catat "[r2] unggah OK"
else
  catat "[r2] unggah GAGAL, salinan lokal tetap ada"
fi

# --- 7. Keadaan kunci: jangan diam kalau belum pernah dikirim ---------------
if [ -f "$MARKER_TERKIRIM" ]; then
  catat "kunci sudah pernah dikirim ke Telegram (keadaan darurat siap)"
else
  catat "PERHATIAN: kunci belum pernah dikirim ke Telegram. Jalankan kirim-kunci-backup.sh sekali supaya arsip ini bisa dibuka kalau server hilang."
fi

catat "=== selesai ==="
