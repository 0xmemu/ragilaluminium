#!/usr/bin/env bash
# Drill restore mingguan: restore backup latest ke DB test, verifikasi CHECK TABLE +
# rowcount tabel utama vs produksi, hapus DB test. Cron Senin 04:30. Log + alert.
set -euo pipefail

ENV_FILE=/root/ragilaluminium/.env
BACKUP_DIR=/root/backups/ragil
TEST_DB=ragil_restore_test
LOG=/root/backups/restore-test.log
ALERT=/root/backups/ALERT-stale-or-restore

DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_NAME=$(awk -F= '/^DB_DATABASE=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=$(awk -F= '/^DB_HOST=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=${DB_HOST:-127.0.0.1}

# Termasuk identitas pelanggan (customers, users) dan pembayaran (payments):
# sebelumnya hanya produk dan pesanan yang dibuktikan bisa dipulihkan, sehingga
# data pelanggan belum pernah diuji walau selalu ikut tercadangkan.
TABLES="products product_variants product_media orders order_items customers users payments"

echo "=== $(date '+%F %T') ===" >> "$LOG"
LATEST=$(readlink -f "$BACKUP_DIR/ragil_aluminium-latest.sql.gz")
[ -f "$LATEST" ] || { echo "FATAL: latest backup tidak ada" >> "$LOG"; touch "$ALERT"; exit 1; }

# Stale check: backup terakhir harus < 26 jam (backup harian).
# Stale check (fixed): HARUS ada minimal satu backup yang lebih BARU dari 26 jam.
# Predikat lama (+1560 = lebih tua dari 26 jam) selalu benar karena rotasi 7 hari
# menyisakan file lama -> false-positive STALE setiap saat.
if ! find "$BACKUP_DIR" -maxdepth 1 -name "ragil_aluminium-*.sql.gz" -mmin -1560 -print -quit | grep -q .; then
  echo "STALE: tidak ada backup < 26 jam" >> "$LOG"; touch "$ALERT"
fi

# Stale check binlog (F4): run arsip binlog harus < 27 jam (cron tiap jam + toleransi).
if [ -f /root/backups/binlog-last-run ]; then
  LAST_TS=$(stat -c %Y /root/backups/binlog-last-run 2>/dev/null || echo 0)
  NOW_TS=$(date +%s)
  AGE_SEC=$(( NOW_TS - LAST_TS ))
  if [ "$AGE_SEC" -gt 97200 ]; then
    echo "STALE: arsip binlog tidak berjalan $((AGE_SEC / 3600)) jam" >> "$LOG"
    touch "$ALERT"
   
  fi
fi

env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $TEST_DB; CREATE DATABASE $TEST_DB;" || { echo "FATAL: buat DB test gagal" >> "$LOG"; exit 1; }

gunzip -c "$LATEST" | \
  env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" "$TEST_DB" \
  || { echo "FATAL: restore ke DB test gagal" >> "$LOG"; touch "$ALERT"; env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $TEST_DB;"; exit 1; }

OK=1
for t in $TABLES; do
  C=$(env MYSQL_PWD="$DB_PASS" mysql -N --user="$DB_USER" --host="$DB_HOST" -e "SELECT COUNT(*) FROM $TEST_DB.$t;" 2>/dev/null || echo "ERR")
  P=$(env MYSQL_PWD="$DB_PASS" mysql -N --user="$DB_USER" --host="$DB_HOST" -e "SELECT COUNT(*) FROM $DB_NAME.$t;" 2>/dev/null || echo "ERR")
  printf "%-18s test=%-8s prod=%-8s %s\n" "$t" "$C" "$P" "$([ "$C" = "$P" ] && echo OK || echo MISMATCH)" | tee -a "$LOG"
  [ "$C" = "$P" ] || OK=0
done

env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "CHECK TABLE $TEST_DB.products, $TEST_DB.product_variants, $TEST_DB.product_media, $TEST_DB.orders, $TEST_DB.order_items, $TEST_DB.customers, $TEST_DB.users, $TEST_DB.payments;" >> "$LOG" 2>&1 || OK=0

# Audit semantik bisnis (F10.R4, formula OrderService) terhadap DB test.
# Gagal audit -> OK=0 -> marker PASS tidak ditulis -> arsip mingguan/bulanan berhenti.
if ! /root/scripts_semantic_audit.sh "$TEST_DB" >> "$LOG" 2>&1; then
  echo "SEMANTIC AUDIT GAGAL di DB test" >> "$LOG"
  OK=0
fi
env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE $TEST_DB;" || true

if [ "$OK" = "1" ]; then
  echo "RESTORE TEST PASS (drill $(date '+%F %T'))" >> "$LOG"
  date +%FT%T > /root/backups/last-restore-test-pass
  rm -f "$ALERT"
else
  echo "RESTORE TEST GAGAL — cek log" >> "$LOG"; touch "$ALERT"
fi
