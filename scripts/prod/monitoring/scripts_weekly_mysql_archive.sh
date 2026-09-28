#!/usr/bin/env bash
# Arsip mingguan dari dump harian yang sudah lolos restore test; tidak dump ulang DB aktif.
set -euo pipefail
DIR=/root/backups/ragil
LOG=/root/backups/weekly-archive.log
STAMP=$(date -d 'yesterday' +%Y%m%d)
YEAR_WEEK=$(date -d 'yesterday' +%G-W%V)
SRC=$(find "$DIR" -maxdepth 1 -name "ragil_aluminium-${STAMP}-*.sql.gz" -type f | sort | tail -1)
if [ -z "$SRC" ]; then
  SRC=$(find "$DIR" -maxdepth 1 -name 'ragil_aluminium-*.sql.gz' -type f -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
  echo "$(date '+%F %T') WARN: daily dump $STAMP tidak ada — fallback ke dump terbaru: $(basename "${SRC:-<none>}")" >> "$LOG"
fi
if [ -z "$SRC" ]; then echo "$(date '+%F %T') ERROR: tidak ada dump sama sekali" >> "$LOG"; exit 1; fi
# Arsip mingguan sebelumnya DIBATALKAN bila belum ada bukti uji restore terbaru.
# Akibatnya dua minggu arsip hilang (W35 dan W38) karena uji restore gagal
# berturut-turut. Kebijakan baru (owner 2026-09-28): arsip TETAP dibuat, tetapi
# ditandai BELUM TERVERIFIKASI supaya tidak ada minggu yang hilang diam-diam.
MARK=/root/backups/last-restore-test-pass
UNVERIFIED=/root/backups/ALERT-archive-unverified
if [ ! -f "$MARK" ] || [ "$(find "$MARK" -mmin +10080 -print)" ]; then
  echo "$(date '+%F %T') WARN: belum ada restore test PASS terbaru — arsip tetap dibuat, ditandai BELUM TERVERIFIKASI" >> "$LOG"
  touch "$UNVERIFIED"
else
  rm -f "$UNVERIFIED"
fi
python3 /root/scripts_archive_mysql.py "$SRC" "weekly/ragil_aluminium-${YEAR_WEEK}.sql.gz" >> "$LOG" 2>&1
