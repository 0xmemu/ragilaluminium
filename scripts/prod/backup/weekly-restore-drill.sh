#!/usr/bin/env bash
# Drill restore mingguan: buktikan arsip dump benar-benar bisa dipulihkan.
# Restore ke DB terpisah (ragil_restore_test), bandingkan jumlah tabel, lalu laporkan.
# DB aplikasi tidak pernah disentuh. Tidak ada perintah hapus di skrip ini:
# keluaran mysqldump sudah membawa pembersihan tabel per tabel saat restore,
# sehingga pemulihan berulang ke DB uji tetap bersih.
set -uo pipefail
source /root/ragil-backup/ragil-backup.env

LOG="$ALERT_DIR/restore-drill.log"
TEST_DB=ragil_restore_test
LATEST="$BACKUP_DIR/${DB_NAME}-latest.sql.gz"

echo "=== $(date '+%F %T') drill mulai ===" >> "$LOG"

if [ ! -f "$LATEST" ]; then
  echo "arsip latest tidak ditemukan" >> "$LOG"
  exit 1
fi

if ! gzip -t "$LATEST"; then
  echo "arsip korup, restore dibatalkan" >> "$LOG"
  exit 1
fi

mysql -e "CREATE DATABASE IF NOT EXISTS $TEST_DB"

if ! gunzip -c "$LATEST" | mysql "$TEST_DB"; then
  echo "restore GAGAL" >> "$LOG"
  exit 1
fi

SRC=$(mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'")
DST=$(mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TEST_DB'")
echo "jumlah tabel: sumber=$SRC hasil_restore=$DST" >> "$LOG"

if [ "$SRC" != "$DST" ]; then
  echo "JUMLAH TABEL TIDAK COCOK" >> "$LOG"
  exit 1
fi

date +%FT%T > "$BACKUP_DIR/last-drill"
echo "drill OK" >> "$LOG"
