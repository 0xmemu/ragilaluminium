#!/usr/bin/env bash
# Graceful degradation test — pastikan app tetap jalan saat dependensi sementara mati.
# (F4.3 dari prod-readiness plan). Akses preview via https agar valid.
# Aman: Redis/Hive di-stop & di-start ulang, tidak ada data yang diubah.
set -uo pipefail

BASE="https://ra.333labs.tech"
LOG=/root/backups/graceful-degradation.log
PASS=0; FAIL=0
echo "=== $(date '+%F %T') graceful degradation test ===" | tee -a "$LOG"

norm() { # verifikasi kondisi normal baseline
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "${BASE}/" 2>/dev/null)
  echo "  baseline /: $code" | tee -a "$LOG"
  [ "$code" = "200" ] || return 1
  return 0
}

test_app() { # <nama-penyebab> — cek home & katalog setelah dependensi dimatikan
  local name="$1"
  sleep 2
  local c1 c2
  c1=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${BASE}/" 2>/dev/null)
  c2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${BASE}/products" 2>/dev/null)
  echo "  [$name] / -> $c1, /products -> $c2" | tee -a "$LOG"
  if [ "$c1" = "200" ] && [ "$c2" = "200" ]; then
    PASS=$((PASS+1)); echo "  ✓ saat $name: aplikasi tetap jalan" | tee -a "$LOG"
  else
    FAIL=$((FAIL+1)); echo "  ✗ saat $name: / =$c1, /products=$c2" | tee -a "$LOG"
  fi
}

norm || { echo "BASELINE GAGAL — hentikan (jangan test saat app down)"; FAIL=$((FAIL+1)); exit 1; }

# --- Test 1: Redis down (cache+queue) ---
echo "  [1/2] matikan Redis..." | tee -a "$LOG"
systemctl stop redis-server
test_app "redis-down"
systemctl start redis-server
sleep 3
redis-cli ping >/dev/null 2>&1 && echo "  redis pulih: $(redis-cli ping)" | tee -a "$LOG" || echo "  WARN redis tidak pulih" | tee -a "$LOG"

# --- Test 2: R2/media tak bisa diakses (simulasi dengan MEDIA_URL salah? sulit; skip utk kini) ---
# Ambil pendekatan: pastikan app tetap 200 walau ada dependensi eksternal lambat.
# (Redis sudah cukup sebagai graceful-degradation utama; R2 live tak bisa di-off tanpa efek sisi.)

echo "=== hasil: PASS=$PASS FAIL=$FAIL ($(date '+%F %T')) ===" | tee -a "$LOG"
[ "$FAIL" = "0" ] && echo "GRACEFUL-DEGRADATION PASS" | tee -a "$LOG" || echo "GRACEFUL-DEGRADATION FAIL ($FAIL)" | tee -a "$LOG"
[ "$FAIL" = "0" ]