#!/bin/bash
# Arsip binlog MySQL ke R2 (ra-backup/binlogs/) — PITR. Dipanggil tiap jam dari cron.
# F1/F2: status upload diverifikasi per file; kegagalan -> alert + notify. F4: timestamp run.
set -uo pipefail
ENV_FILE=/root/ragilaluminium/.env
LOG=/root/backups/ragil-binlog.log
ALERT=/root/backups/ALERT-r2-upload
DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
BINLOG_DIR=/var/lib/mysql

echo "=== $(date '+%F %T') ===" >> "$LOG"
if ! MYSQL_PWD="$DB_PASS" mysqladmin -u"$DB_USER" flush-logs >> "$LOG" 2>&1; then
  echo "flush-logs GAGAL" >> "$LOG"
 
  exit 1
fi

GAGAL=0
for f in "$BINLOG_DIR"/binlog.*; do
  case "$f" in *.index) continue;; esac
  echo "binlog: $(basename "$f") $(stat -c%s "$f") bytes" >> "$LOG"
  if ! python3 /root/scripts_r2_upload_binlog.py "$f" >> "$LOG" 2>&1; then
    echo "UPLOAD GAGAL: $(basename "$f")" >> "$LOG"
    GAGAL=1
  fi
done

date +%FT%T > /root/backups/binlog-last-run

if [ "$GAGAL" = "1" ]; then
  echo "--- selesai DENGAN KEGAGALAN ---" >> "$LOG"
  touch "$ALERT"
 
  exit 1
fi
rm -f "$ALERT"
echo "--- selesai ---" >> "$LOG"
