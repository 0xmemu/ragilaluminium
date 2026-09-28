#!/usr/bin/env bash
# AUTO-CLEANUP disk saat menuju penuh (>=80% & sisa <10G).
# Hanya hapus file yang SUDAH aman di-archive (backup lokal >7 hari ada di R2 weekly/monthly;
# log .gz >14 hari; metric CSV >30 hari). Non-destruktif utk data bisnis (orders dsb & .env).
# Dipanggil oleh aggregator ketika disk tinggi. Idempotent; jalankan manual juga aman.
set -uo pipefail
BACKUP_DIR=/root/backups
LOG=/root/backups/resource-anticipation.log

DISK_PCT=$(df -h / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
DISK_AVAIL_GB=$(df -h / | awk 'NR==2 {gsub(/G/,"",$4); print $4+0}')

echo "=== $(date '+%F %T') auto-cleanup disk=${DISK_PCT}% avail=${DISK_AVAIL_GB}G ===" >> "$LOG"
if [ "${DISK_PCT:-0}" -lt 80 ] || [ "${DISK_AVAIL_GB:-0}" -ge 10 ]; then
  echo "  (tidak perlu — di bawah ambang)" >> "$LOG"
  exit 0
fi

BEFORE=$(df -h / | awk 'NR==2 {print $4}')
# Backup lokal dump > 7 hari (validen di R2 weekly/monthly — aman dihapus dr lokal)
find "$BACKUP_DIR/ragil" -maxdepth 1 -type f \( -name "*.sql.gz" -o -name "*.sql" \) -mtime +7 -delete 2>/dev/null
# Log terkompresi basi > 14 hari
find /var/log -maxdepth 2 -type f -name "*.gz" -mtime +14 -delete 2>/dev/null
# Metrics CSV > 30 hari
find "$BACKUP_DIR/metrics" -maxdepth 1 -type f -name "*.csv" -mtime +30 -delete 2>/dev/null
# .env.backup-deploy lama > 14 hari (jangan sentuh .env asli)
find "$BACKUP_DIR" -maxdepth 1 -type f -name ".env.bak-deploy-*" -mtime +14 -delete 2>/dev/null
AFTER=$(df -h / | awk 'NR==2 {print $4}')

if [ "$BEFORE" != "$AFTER" ]; then
  echo "  ✅ dibersihkan: ${BEFORE} -> ${AFTER}" >> "$LOG"
  touch /root/backups/ALERT-resource-cleanup 2>/dev/null
else
  echo "  ⚠️ tidak ada yg bisa dibersihkan (disk tetap ${BEFORE}) — perlu audit manual!" >> "$LOG"
  touch /root/backups/ALERT-resource-cleanup-full 2>/dev/null
fi