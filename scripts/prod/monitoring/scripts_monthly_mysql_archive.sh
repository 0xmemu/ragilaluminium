#!/usr/bin/env bash
# Arsip bulanan dari dump harian yang sudah lolos restore test; tidak dump ulang DB aktif.
set -euo pipefail
DIR=/root/backups/ragil
LOG=/root/backups/monthly-archive.log
TARGET=$(date -d 'yesterday' +%Y-%m)
SRC=$(find "$DIR" -maxdepth 1 -name "ragil_aluminium-${TARGET}-*.sql.gz" -type f | sort | tail -1)
if [ -z "$SRC" ]; then
  SRC=$(find "$DIR" -maxdepth 1 -name 'ragil_aluminium-*.sql.gz' -type f -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
  echo "$(date '+%F %T') WARN: daily dump bulan $TARGET tidak ada — fallback ke dump terbaru: $(basename "${SRC:-<none>}")" >> "$LOG"
fi
if [ -z "$SRC" ]; then echo "$(date '+%F %T') ERROR: tidak ada dump sama sekali" >> "$LOG"; exit 1; fi
MARK=/root/backups/last-restore-test-pass
# Sama seperti arsip mingguan: arsip bulanan TETAP dibuat walau belum ada bukti
# uji restore terbaru, tetapi ditandai BELUM TERVERIFIKASI agar tidak hilang diam-diam.
UNVERIFIED=/root/backups/ALERT-archive-unverified
if [ ! -f "$MARK" ] || [ "$(find "$MARK" -mmin +44640 -print)" ]; then
  echo "$(date '+%F %T') WARN: belum ada restore test PASS terbaru — arsip bulanan tetap dibuat, ditandai BELUM TERVERIFIKASI" >> "$LOG"
  touch "$UNVERIFIED"
fi
python3 /root/scripts_archive_mysql.py "$SRC" "monthly/ragil_aluminium-${TARGET}.sql.gz" >> "$LOG" 2>&1
