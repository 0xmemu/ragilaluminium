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
# Hanya arsipkan sumber yang lolos uji restore terakhir; script restore test menulis marker ini.
MARK=/root/backups/last-restore-test-pass
if [ ! -f "$MARK" ] || [ "$(find "$MARK" -mmin +10080 -print)" ]; then echo "$(date '+%F %T') ERROR: tidak ada restore test PASS terbaru" >> "$LOG"; exit 1; fi
python3 /root/scripts_archive_mysql.py "$SRC" "weekly/ragil_aluminium-${YEAR_WEEK}.sql.gz" >> "$LOG" 2>&1
