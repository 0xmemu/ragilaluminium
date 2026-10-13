#!/usr/bin/env bash
# Tambah subscriber Telegram (chat_id) ke file persisten.
# Pakai: scripts_tg_add_subscriber.sh <chat_id>   (atau jalankan tanpa argumen utk lihat).
set -uo pipefail
SUB_FILE=/root/backups/.tg-subscribers
CID="${1:-}"
if [ -z "$CID" ]; then
  echo "Subscriber saat ini:"
  [ -f "$SUB_FILE" ] && cat "$SUB_FILE" || echo "(kosong)"
  echo ""
  echo "Gunakan: $0 <chat_id>"
  exit 0
fi
grep -q "^${CID}$" "$SUB_FILE" 2>/dev/null || echo "$CID" >> "$SUB_FILE"
echo "Subscriber terdaftar: $(grep -vE '^#|^$' "$SUB_FILE" 2>/dev/null | sort -u | tr '\n' ' ')"
exit 0