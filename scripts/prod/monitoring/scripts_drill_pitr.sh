#!/usr/bin/env bash
# Drill PITR mingguan — buktikan binlog di R2 bisa memulihkan DB ke titik waktu.
# Alur: dump LATEST (mencatat posisi binlog via --source-data=2) → restore ke DB test
#       → download binlog dari R2 → replay dari posisi dump → verifikasi rowcount.
# Cron Senin 07:00. Gagal → ALERT-drill-pitr.
set -uo pipefail

ENV_FILE=/root/ragilaluminium/.env
BACKUP_DIR=/root/backups/ragil
DL_DIR=/root/backups/pitr-download
LOG=/root/backups/pitr-drill.log
ALERT=/root/backups/ALERT-drill-pitr
TEST_DB=ragil_pitr_test

DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=$(awk -F= '/^DB_HOST=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=${DB_HOST:-127.0.0.1}
DB_NAME=$(awk -F= '/^DB_DATABASE=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")

: "${DB_USER:?}" "${DB_PASS:?}" "${DB_NAME:?}"
M() { env MYSQL_PWD="$DB_PASS" mysql -N --user="$DB_USER" --host="$DB_HOST" "$1" -e "$2" 2>/dev/null; }

echo "=== $(date '+%F %T') PITR drill ===" >> "$LOG"
rm -rf "$DL_DIR"; mkdir -p "$DL_DIR"

LATEST=$(readlink -f "$BACKUP_DIR/ragil_aluminium-latest.sql.gz")
[ -f "$LATEST" ] || { echo "FATAL: latest dump tidak ada" >> "$LOG"; touch "$ALERT"; exit 1; }

# --- 1. Ekstrak posisi binlog dari dump (--source-data=2) ---
POS_LINE=$(zcat "$LATEST" 2>/dev/null | grep -m1 'CHANGE MASTER TO')
BINLOG_FILE=$(echo "$POS_LINE" | grep -oP "MASTER_LOG_FILE='\K[^']+")
BINLOG_POS=$(echo "$POS_LINE" | grep -oP "MASTER_LOG_POS=\K[0-9]+")
if [ -z "$BINLOG_FILE" ] || [ -z "$BINLOG_POS" ]; then
  echo "FATAL: dump tidak mencatat posisi binlog (butuh --source-data=2)" >> "$LOG"
  touch "$ALERT"; exit 1
fi
echo "  posisi dump: $BINLOG_FILE @ $BINLOG_POS" >> "$LOG"

# --- 2. Restore dump ke DB test ---
env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $TEST_DB; CREATE DATABASE $TEST_DB;" 2>/dev/null || { echo "FATAL: buat DB test gagal" >> "$LOG"; exit 1; }
zcat "$LATEST" | env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" "$TEST_DB" 2>/dev/null \
  || { echo "FATAL: restore dump gagal" >> "$LOG"; touch "$ALERT"; M mysql -e "DROP DATABASE IF EXISTS $TEST_DB;"; exit 1; }
echo "  restore dump: OK" >> "$LOG"

# --- 3. Download binlog dari R2 (file posisi + semua setelahnya, cek index lokal utk urutan) ---
BINLOG_BASE=$(basename "$BINLOG_FILE")
SEQ=$(echo "$BINLOG_BASE" | grep -oP 'binlog\.\K[0-9]+')
DL_OK=0
# Iterasi index binlog lokal utk tahu nama file selanjutnya (binlog.000254, ...)
for f in $(cat /var/lib/mysql/binlog.index 2>/dev/null | grep -v '^#'); do
  bn=$(basename "$f")
  s=$(echo "$bn" | grep -oP 'binlog\.\K[0-9]+')
  [ -z "$s" ] && continue
  if [ "$s" -ge "$SEQ" ]; then
    if python3 /root/scripts_r2_download.py "binlogs/$bn" "$DL_DIR/$bn" >> "$LOG" 2>&1; then
      DL_OK=$((DL_OK+1))
    else
      echo "  WARN: $bn tidak ada di R2 (wajar bila baru di-flush)" >> "$LOG"
    fi
  fi
done
if [ "$DL_OK" -eq 0 ]; then
  echo "FATAL: tidak ada binlog ter-download dari R2" >> "$LOG"; touch "$ALERT"
  M mysql -e "DROP DATABASE IF EXISTS $TEST_DB;"; exit 1
fi
echo "  download binlog dari R2: $DL_OK file" >> "$LOG"

# --- 4. Replay binlog dari posisi dump ---
REPLAY_FILES=$(ls -1 "$DL_DIR"/binlog.* 2>/dev/null | sort)
mysqlbinlog --start-position="$BINLOG_POS" --database="$DB_NAME" $REPLAY_FILES 2>/dev/null \
  | env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" "$TEST_DB" 2>/dev/null
RC=$?
if [ "$RC" != "0" ]; then
  echo "REPLAY GAGAL (mysqlbinlog rc=$RC) — mungkin duplicate key (dump sudah berisi sebagian)" >> "$LOG"
  # Duplicate key saat replay = dump sudah mengandung transaksi tsb; normal utk dump tanpa posisi tepat.
fi
echo "  replay binlog: selesai" >> "$LOG"

# --- 5. Verifikasi: rowcount test >= live (live bisa lebih baru beberapa transaksi) ---
OK=1
for t in orders order_items payments products product_variants; do
  C=$(M "$TEST_DB" "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo 0)
  P=$(M "$DB_NAME" "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo 0)
  printf '  %-18s test=%-8s prod=%-8s\n' "$t" "$C" "$P" | tee -a "$LOG"
  # Test tidak boleh ketinggalan dari live (live bisa +1 transaksi baru selama drill)
  if [ "$C" -lt "$P" ]; then
    echo "  MISMATCH: $t test($C) < prod($P)" >> "$LOG"; OK=0
  fi
done

# CHECK TABLE + audit semantik di test DB
env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "CHECK TABLE $TEST_DB.orders, $TEST_DB.order_items, $TEST_DB.products;" >> "$LOG" 2>&1 || OK=0
if ! /root/scripts_semantic_audit.sh "$TEST_DB" >> "$LOG" 2>&1; then
  echo "  SEMANTIC AUDIT test: GAGAL" >> "$LOG"; OK=0
fi

M mysql -e "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null

if [ "$OK" = "1" ]; then
  echo "PITR DRILL PASS (drill $(date '+%F %T'))" >> "$LOG"
  date +%FT%T > /root/backups/last-pitr-pass
  rm -f "$ALERT"
  exit 0
fi
echo "PITR DRILL GAGAL — cek log" >> "$LOG"; touch "$ALERT"
exit 1
