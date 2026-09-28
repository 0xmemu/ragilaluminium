#!/usr/bin/env bash
# Live DB health check (G1+G4) — deteksi dini korupsi & penghapusan data di DB LIVE.
# - CHECK TABLE tabel utama (live)
# - Audit semantik 22 invariant terhadap LIVE DB (read-only: SELECT/CHECK saja)
# - Rowcount drift vs run sebelumnya (penurunan >10% / >=1 baris di tabel kecil → alert)
# Cron harian 06:30. Kegagalan → ALERT-db-live-health → aggregator → Telegram.
set -uo pipefail

ENV_FILE=/root/ragilaluminium/.env
LOG=/root/backups/db-live-health.log
ALERT=/root/backups/ALERT-db-live-health
STATE=/root/backups/rowcount-last.txt

DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=$(awk -F= '/^DB_HOST=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=${DB_HOST:-127.0.0.1}
DB_NAME=$(awk -F= '/^DB_DATABASE=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")

: "${DB_USER:?}" "${DB_PASS:?}" "${DB_NAME:?}"
M() { env MYSQL_PWD="$DB_PASS" mysql -N --user="$DB_USER" --host="$DB_HOST" "$DB_NAME" -e "$1" 2>/dev/null; }

echo "=== $(date '+%F %T') db-live-health ===" >> "$LOG"
PROBLEMS=""

# --- 1. CHECK TABLE live (tabel inti) ---
CHK=$(env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" "$DB_NAME" \
  -e "CHECK TABLE orders, order_items, payments, products, product_variants, customers, users;" 2>/dev/null)
if echo "$CHK" | grep -qiE 'error|corrupt'; then
  PROBLEMS="${PROBLEMS}🔬 CHECK TABLE live: $(echo "$CHK" | grep -iE 'error|corrupt' | head -2 | tr '\n' ' ')\n"
  echo "  CHECK TABLE: GAGAL" >> "$LOG"
else
  echo "  CHECK TABLE: OK ($(echo "$CHK" | grep -c 'status' ) tabel)" >> "$LOG"
fi

# --- 2. Audit semantik terhadap LIVE DB (read-only) ---
if ! /root/scripts_semantic_audit.sh "$DB_NAME" >> "$LOG" 2>&1; then
  PROBLEMS="${PROBLEMS}🔬 Audit semantik LIVE GAGAL — lihat /root/backups/semantic-audit.log\n"
  echo "  audit live: GAGAL" >> "$LOG"
else
  echo "  audit live: PASS" >> "$LOG"
fi

# --- 3. Rowcount drift (kecuali sessions — fluktuasi normal) ---
TABLES="orders order_items payments customers products product_variants users event_logs whatsapp_messages"
CUR=""
for t in $TABLES; do
  C=$(M "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo "?")
  CUR="${CUR}${t}=${C}\n"
done

if [ -f "$STATE" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    t=${line%%=*}
    prev=${line#*=}
    cur=$(printf '%b' "$CUR" | grep "^${t}=" | cut -d= -f2)
    [ "$cur" = "?" ] && continue
    # Alert hanya jika penurunan (data hilang), bukan kenaikan.
    drop=$(( prev - cur ))
    if [ "$drop" -gt 0 ]; then
      threshold=$(( prev / 10 ))
      [ "$threshold" -lt 1 ] && threshold=1
      if [ "$drop" -ge "$threshold" ]; then
        PROBLEMS="${PROBLEMS}📉 ROWCOUNT ${t}: ${prev} → ${cur} (${drop} baris hilang)\n"
        echo "  drift: ${t} ${prev}→${cur} (ALERT)" >> "$LOG"
      fi
    fi
  done < "$STATE"
else
  echo "  drift: baseline baru dibuat" >> "$LOG"
fi
printf '%b' "$CUR" > "$STATE"

# --- Kirim alert ---
if [ -n "$PROBLEMS" ]; then
  printf '🚨 DB LIVE HEALTH %s\n%b' "$(date '+%F %T')" "$PROBLEMS" > /root/backups/alert-live-health.txt
  touch "$ALERT"
  echo "  RESULT: GAGAL → ALERT dibuat" >> "$LOG"
  exit 1
fi
rm -f "$ALERT"
echo "  RESULT: sehat" >> "$LOG"
exit 0
