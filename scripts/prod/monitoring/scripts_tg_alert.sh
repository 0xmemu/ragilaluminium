#!/usr/bin/env bash
# Kirim alert ke Telegram — ke subscriber TERSIMPAN (persisten).
# Token dari /root/.config/ragilaluminium/telegram.env (chmod 600).
# Subscriber: file /root/backups/.tg-subscribers (1 chat_id per baris), diisi manual
# atau via /root/scripts_tg_add_subscriber.sh <chat_id>.
set -uo pipefail

TG_ENV=/root/.config/ragilaluminium/telegram.env
LOG=/root/backups/tg-alert.log
SUB_FILE=/root/backups/.tg-subscribers

[ -f "$TG_ENV" ] || { echo "$(date) ERROR: $TG_ENV" >> "$LOG"; exit 1; }
TOKEN=$(awk -F= '/^BOT_TOKEN=/{gsub(/\r/,"",$2); print $2}' "$TG_ENV")
[ -z "$TOKEN" ] && { echo "$(date) ERROR: token" >> "$LOG"; exit 1; }
MESSAGE="${1:-}"
[ -z "$MESSAGE" ] && { echo "$(date) ERROR: pesan kosong" >> "$LOG"; exit 1; }

# Ambil subscriber dari file persisten
if [ ! -f "$SUB_FILE" ]; then
  echo "$(date '+%F %T') WARN: tidak ada subscriber ($SUB_FILE kosong)" >> "$LOG"
  exit 2
fi
CHATS=$(grep -vE '^[[:space:]]*#|^[[:space:]]*$' "$SUB_FILE" | sort -u)
[ -z "$CHATS" ] && { echo "$(date '+%F %T') WARN: tidak ada subscriber" >> "$LOG"; exit 2; }

SENT=0; FAIL=0
for CID in $CHATS; do
  PAYLOAD=$(python3 -c "import json,sys; print(json.dumps({'chat_id': int('$CID'), 'text': '''$MESSAGE''', 'disable_web_page_preview': True}))" 2>/dev/null)
  RESP=$(curl -s --max-time 20 -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" -H "Content-Type: application/json" -d "$PAYLOAD")
  if echo "$RESP" | grep -q '"ok":true'; then
    SENT=$((SENT+1))
  else
    FAIL=$((FAIL+1))
    echo "$(date '+%F %T') GAGAL ke chat $CID: $(echo "$RESP" | head -c 150)" >> "$LOG"
  fi
done
echo "$(date '+%F %T') kirim: $SENT ok, $FAIL gagal (subscribers: $(echo "$CHATS" | wc -l))" >> "$LOG"
[ "$FAIL" = "0" ]