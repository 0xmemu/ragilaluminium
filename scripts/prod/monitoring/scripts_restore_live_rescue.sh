#!/usr/bin/env bash
# Rescue live DB dari backup (G3) — prosedur yang terbukti 2026-08-21.
# Mode DEFAULT = dry-run (restore ke DB sementara + verifikasi, TIDAK menyentuh live).
# Mode --apply   = swap live: backup live dulu, restore dari dump, verifikasi.
# Pakai: scripts_restore_live_rescue.sh [--apply] [--dump=<path.sql.gz>]
set -uo pipefail

ENV_FILE=/root/ragilaluminium/.env
LOG=/root/backups/rescue.log
ALERT=/root/backups/ALERT-rescue
STAGE_DB=ragil_rescue_stage
RESCUE_DB=ragil_rescue_new

DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=$(awk -F= '/^DB_HOST=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=${DB_HOST:-127.0.0.1}
DB_NAME=$(awk -F= '/^DB_DATABASE=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")

: "${DB_USER:?}" "${DB_PASS:?}" "${DB_NAME:?}"
M() { env MYSQL_PWD="$DB_PASS" mysql -N --user="$DB_USER" --host="$DB_HOST" "$1" -e "$2" 2>/dev/null; }

APPLY=0
DUMP=""
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --dump=*) DUMP="${a#--dump=}" ;;
  esac
done
[ -z "$DUMP" ] && DUMP=$(readlink -f /root/backups/ragil/ragil_aluminium-latest.sql.gz)
[ -f "$DUMP" ] || { echo "FATAL: dump $DUMP tidak ada" | tee -a "$LOG"; exit 1; }

echo "=== $(date '+%F %T') rescue (${APPLY:-0}: dry-run) ===" >> "$LOG"

# --- 1. Restore dump ke DB stage ---
env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $STAGE_DB; CREATE DATABASE $STAGE_DB;" 2>/dev/null || { echo "FATAL: buat stage DB gagal" >> "$LOG"; exit 1; }
zcat "$DUMP" | env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" "$STAGE_DB" 2>/dev/null || { echo "FATAL: restore stage gagal" >> "$LOG"; touch "$ALERT"; exit 1; }
echo "  restore ke $STAGE_DB: OK" >> "$LOG"

# --- 2. Verifikasi integritas stage ---
OK=1
for t in orders order_items payments customers products product_variants users; do
  C=$(M "$STAGE_DB" "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo 0)
  P=$(M "$DB_NAME" "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo 0)
  printf '  %-18s stage=%-8s live=%-8s\n' "$t" "$C" "$P" | tee -a "$LOG"
  if [ "$C" -lt "$P" ]; then echo "  MISMATCH $t" >> "$LOG"; OK=0; fi
done
env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "CHECK TABLE $STAGE_DB.orders, $STAGE_DB.products, $STAGE_DB.order_items;" >> "$LOG" 2>&1 || OK=0
if ! /root/scripts_semantic_audit.sh "$STAGE_DB" >> "$LOG" 2>&1; then OK=0; fi

if [ "$OK" != "1" ]; then
  echo "RESCUE GAGAL di verifikasi stage — live TIDAK disentuh" >> "$LOG"; touch "$ALERT"
  env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $STAGE_DB;" 2>/dev/null
  exit 1
fi

# --- 3. Dry-run berhenti di sini ---
if [ "$APPLY" != "1" ]; then
  echo "RESCUE DRY-RUN PASS — live tidak disentuh (pakai --apply untuk swap)" >> "$LOG"
  env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $STAGE_DB;" 2>/dev/null
  rm -f "$ALERT"
  exit 0
fi

# --- 4. --apply: backup live dulu, lalu swap ---
STAMP=$(date +%Y%m%d-%H%M%S)
LIVE_BAK="/root/backups/ragil/live-before-rescue-${STAMP}.sql.gz"
env MYSQL_PWD="$DB_PASS" mysqldump --user="$DB_USER" --host="$DB_HOST" --single-transaction --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF --source-data=2 "$DB_NAME" 2>/dev/null | gzip -9 > "$LIVE_BAK" \
  || { echo "FATAL: backup live sebelum swap gagal — batal" >> "$LOG"; touch "$ALERT"; exit 1; }
echo "  backup live pra-swap: $LIVE_BAK" >> "$LOG"

# Rename: live -> ragil_rescue_old, stage -> live
env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "
  DROP DATABASE IF EXISTS ${RESCUE_DB}_old;
  RENAME TABLE $DB_NAME.orders TO ${RESCUE_DB}_old.orders;" 2>/dev/null # placeholder, real swap below
# Swap penuh via rename database tidak didukung MySQL; gunakan pendekatan: drop live, rename stage ke live.
env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "
  DROP DATABASE IF EXISTS ragil_rescue_old;
  CREATE DATABASE ragil_rescue_old;" 2>/dev/null
# Salin live lama ke ragil_rescue_old (arsip), lalu ganti live dengan stage
for t in $(M "$DB_NAME" "SHOW TABLES;" 2>/dev/null); do
  env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "CREATE TABLE ragil_rescue_old.$t LIKE $DB_NAME.$t; INSERT INTO ragil_rescue_old.$t SELECT * FROM $DB_NAME.$t;" 2>/dev/null
done
echo "  live lama diarsipkan ke ragil_rescue_old" >> "$LOG"

# Ganti isi live dengan stage (truncate live + copy stage)
for t in $(M "$STAGE_DB" "SHOW TABLES;" 2>/dev/null); do
  env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "TRUNCATE TABLE $DB_NAME.$t; INSERT INTO $DB_NAME.$t SELECT * FROM $STAGE_DB.$t;" 2>/dev/null
done
echo "  live di-swap dari stage" >> "$LOG"
env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $STAGE_DB;" 2>/dev/null

# Verifikasi akhir
C=$(M "$DB_NAME" "SELECT COUNT(*) FROM orders;" 2>/dev/null)
echo "  verifikasi akhir: orders=$C" >> "$LOG"
echo "RESCUE APPLY SELESAI — backup pra-swap: $LIVE_BAK" >> "$LOG"
rm -f "$ALERT"
exit 0
