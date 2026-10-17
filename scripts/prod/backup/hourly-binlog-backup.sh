#!/usr/bin/env bash
# Arsip binlog MySQL ke R2 tiap jam untuk point-in-time recovery (PITR).
# Kegagalan apa pun menaikkan ALERT-r2-binlog, dan keberhasilan menghapusnya.
# Penanda ini HANYA milik skrip ini, supaya unggah dump yang berhasil tidak
# menghapus kegagalan unggah binlog.
set -uo pipefail
source /root/ragil-backup/ragil-backup.env

LOG="$ALERT_DIR/ragil-binlog.log"
echo "=== $(date '+%F %T') mulai ===" >> "$LOG"

if ! mysqladmin flush-logs >> "$LOG" 2>&1; then
  echo "flush-logs GAGAL" >> "$LOG"
  touch "$ALERT_DIR/ALERT-r2-binlog"
  exit 1
fi

GAGAL=0
for berkas in "$MYSQL_DATA_DIR"/binlog.*; do
  case "$berkas" in
    *.index) continue ;;
  esac
  [ -e "$berkas" ] || continue
  if ! python3 /root/ragil-backup/r2_put.py "$R2_BUCKET_BACKUP" \
        "${R2_PREFIX_BINLOG}$(basename "$berkas")" "$berkas" >> "$LOG" 2>&1; then
    echo "unggah GAGAL: $(basename "$berkas")" >> "$LOG"
    GAGAL=1
  fi
done

date +%FT%T > "$BACKUP_DIR/binlog-last-run"

if [ "$GAGAL" = "1" ]; then
  echo "--- selesai DENGAN KEGAGALAN ---" >> "$LOG"
  touch "$ALERT_DIR/ALERT-r2-binlog"
  exit 1
fi
rm -f "$ALERT_DIR/ALERT-r2-binlog"
echo "--- selesai ---" >> "$LOG"
