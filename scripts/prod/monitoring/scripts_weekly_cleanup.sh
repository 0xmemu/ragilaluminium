#!/usr/bin/env bash
# Cleanup mingguan: hanya sessions (keputusan 2026-08-21: retensi 14 hari).
# performance_visitor_events TIDAK dihapus — KPI "Semua waktu" (visitorsBetween)
# bergantung pada tabel event; menghapusnya merusak angka lifetime.
# Dipanggil cron setiap Senin 06:00 (setelah restore test 04:30 + archive 05:00).
set -euo pipefail

ENV_FILE=/root/ragilaluminium/.env
LOG=/root/backups/cleanup.log
DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=$(awk -F= '/^DB_HOST=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=${DB_HOST:-127.0.0.1}
DB_NAME=$(awk -F= '/^DB_DATABASE=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")

: "${DB_USER:?}" "${DB_PASS:?}" "${DB_NAME:?}"

echo "=== $(date '+%F %T') cleanup ===" >> "$LOG"

M() { env MYSQL_PWD="$DB_PASS" mysql -N --user="$DB_USER" --host="$DB_HOST" "$DB_NAME" -e "$1" 2>/dev/null; }

# Sessions: hapus last_activity > 14 hari (keputusan cart 14 hari).
OLD_SESS=$(M "SELECT COUNT(*) FROM sessions WHERE last_activity < UNIX_TIMESTAMP(NOW() - INTERVAL 14 DAY);" 2>/dev/null)
M "DELETE FROM sessions WHERE last_activity < UNIX_TIMESTAMP(NOW() - INTERVAL 14 DAY);" 2>/dev/null
echo "  sessions: ${OLD_SESS:-0} baris dihapus (last_activity > 14 hari)" >> "$LOG"

# Visitor events: TIDAK dihapus (KPI lifetime). Hanya dicatat ukurannya.
VIS=$(M "SELECT COUNT(*) FROM performance_visitor_events;" 2>/dev/null)
echo "  visitor_events: ${VIS:-?} baris (dipertahankan utuh — KPI lifetime)" >> "$LOG"

LEFT=$(M "SELECT COUNT(*) FROM sessions;" 2>/dev/null)
echo "  sisa sessions: ${LEFT:-?}" >> "$LOG"
echo "=== selesai ===" >> "$LOG"
