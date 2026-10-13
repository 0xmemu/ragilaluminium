#!/usr/bin/env bash
# Backup harian MySQL ragil_aluminium — rotasi 7 hari lokal + upload off-site ke R2 (ra-backup, lifecycle 30 hari).
# Dipanggil dari cron root. Aman: tidak pernah menimpa backup lama sebelum yang baru sukses.
set -euo pipefail

ENV_FILE=/root/ragilaluminium/.env
BACKUP_DIR=/root/backups/ragil
KEEP_DAYS=7
LOG=/root/backups/ragil-backup.log

DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_NAME=$(awk -F= '/^DB_DATABASE=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=$(awk -F= '/^DB_HOST=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PORT=$(awk -F= '/^DB_PORT=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")

: "${DB_USER:?DB_USERNAME kosong di .env}"
: "${DB_PASS:?DB_PASSWORD kosong di .env}"
: "${DB_NAME:?DB_DATABASE kosong di .env}"
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}

mkdir -p "$BACKUP_DIR"
echo "=== $(date '+%F %T') ===" >> "$LOG"

STAMP=$(date +%Y%m%d-%H%M%S)
DUMP="$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"
LATEST="$BACKUP_DIR/${DB_NAME}-latest.sql.gz"

# 1) Dump -> gzip -> verify -> rename. Kalau gagal, backup lama tetap utuh.
TMP="${DUMP}.tmp"
mysqldump \
  --user="$DB_USER" --password="$DB_PASS" \
  --host="$DB_HOST" --port="$DB_PORT" \
  --single-transaction --routines --triggers --events \
  --no-tablespaces --set-gtid-purged=OFF \
  --source-data=2 \
  "$DB_NAME" | gzip -9 > "$TMP" || { echo "dump GAGAL" >> "$LOG"; rm -f "$TMP"; exit 1; }
gzip -t "$TMP" || { echo "gzip verify GAGAL" >> "$LOG"; rm -f "$TMP"; exit 1; }
mv "$TMP" "$DUMP"
ln -sf "$(basename "$DUMP")" "$LATEST"
echo "backup ok: $(basename "$DUMP") ($(du -h "$DUMP" | cut -f1))" >> "$LOG"

# 2) Rotasi lokal (hanya setelah yang baru verified).
find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-*.sql.gz" -mtime +"$KEEP_DAYS" -delete

# 3) Upload off-site ke R2 — data aman walau VPS mati total (retensi 30 hari lifecycle R2).
if python3 /root/scripts_r2_upload_backup.py >> "$BACKUP_DIR/r2-upload.log" 2>&1; then
  echo "[r2] upload OK" >> "$LOG"
else
  echo "[r2] GAGAL upload (lihat $BACKUP_DIR/r2-upload.log)" >> "$LOG"
  touch /root/backups/ALERT-r2-upload
 
fi
