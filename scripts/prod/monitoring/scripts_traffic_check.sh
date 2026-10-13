#!/usr/bin/env bash
# ============================================================================
# Pencatat trafik dan bandwidth — 2026-09-28 (permintaan owner)
#
# Mengapa ada: pemakaian bandwidth sama sekali tidak dipantau sebelumnya, dan
# anomali kunjungan tidak diawasi (kunjungan turun ke nol padahal server sehat,
# atau lonjakan mendadak yang bisa berarti bot).
#
# Sumber: log akses nginx (bawaan gabungan, kolom 10 = jumlah byte).
# Dipanggil cron tiap jam sebagai root. Hanya membaca log dan menulis ke
# /root/backups; tidak menyentuh data aplikasi.
#
# CATATAN PENTING (temuan 2026-09-28): seluruh pengunjung tercatat sebagai SATU
# alamat IP (209.23.10.62) karena trafik masuk lewat tunnel Cloudflare, dan
# nginx belum membaca header CF-Connecting-IP. Karena itu jumlah pengunjung
# hanya bisa didekati: permintaan internal (curl/urllib/axios/browser otomasi)
# dan jalur /admin dikecualikan. Perbaikan yang benar ada di konfigurasi nginx
# (real_ip_header CF-Connecting-IP), dicatat sebagai tindakan terpisah.
# ============================================================================
set -uo pipefail

LOG=/root/backups/traffic-check.log
CSV=/root/backups/traffic-daily.csv
ACCESS=/var/log/nginx/access.log
AMBANG_GB_NOTE=20     # catatan teknis bila pemakaian harian melewati ini

[ -f "$ACCESS" ] || { echo "$(date '+%F %T') ERROR: $ACCESS tidak ada" >> "$LOG"; exit 1; }

# 1. Total permintaan dan byte hari ini (semua trafik, termasuk internal).
TOTAL_REQ=$(wc -l < "$ACCESS" 2>/dev/null || echo 0)
TOTAL_BYTES=$(awk '{s+=$10} END {printf "%d", s+0}' "$ACCESS" 2>/dev/null || echo 0)

# 2. Perkiraan permintaan pengunjung: buang internal dan jalur panel admin.
VISITOR_REQ=$(awk '
  {
    ua = ""
    for (i = 7; i <= NF; i++) ua = ua " " $i
    if (ua ~ /curl|python-urllib|axios|Hermes|Electron|HeadlessChrome|Playwright/) next
    if ($7 ~ /^"GET \/admin/ || $7 ~ /^"POST \/admin/) next
    if ($7 ~ /\/up("| )/) next
    count++
  }
  END { print count+0 }
' "$ACCESS" 2>/dev/null || echo 0)

MB=$(( TOTAL_BYTES / 1048576 ))
GB=$(( TOTAL_BYTES / 1073741824 ))

# 3. Catat baris tren (satu baris per jam) supaya pertumbuhan terlihat.
STAMP=$(date '+%F %H:00')
if ! grep -q "^${STAMP}," "$CSV" 2>/dev/null; then
  printf '%s,%s,%s,%s\n' "$STAMP" "$TOTAL_REQ" "$VISITOR_REQ" "$TOTAL_BYTES" >> "$CSV"
fi

echo "$(date '+%F %T') permintaan=${TOTAL_REQ} pengunjung~${VISITOR_REQ} bandwidth=${MB}MB" >> "$LOG"

if [ "$GB" -ge "$AMBANG_GB_NOTE" ]; then
  echo "$(date '+%F %T') CATATAN TEKNIS: pemakaian bandwidth harian ${GB} GB (ambang catatan ${AMBANG_GB_NOTE} GB)" >> "$LOG"
fi
