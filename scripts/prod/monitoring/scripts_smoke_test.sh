#!/usr/bin/env bash
# Smoke test produksi — verifikasi route publik utama + admin login + DB + queue.
# Pakai: scripts_smoke_test.sh [--url=http://127.0.0.1:8200]
# Exit 0 = semua hijau; 1 = ada yang gagal (output per-item).
set -uo pipefail

BASE="${1:-http://127.0.0.1:8200}"
LOG=/root/backups/smoke-test.log
FAILS=0

ALERT=/root/backups/ALERT-smoke-test
echo "=== $(date '+%F %T') smoke test ($BASE) ===" >> "$LOG"

check_http() { # <nama> <path> <kode_harapan>
  local name="$1" path="$2" expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "${BASE}${path}" 2>/dev/null)
  if [ "$code" = "$expect" ]; then
    printf '  ✓ %-28s %s → %s\n' "$name" "$path" "$code" | tee -a "$LOG"
  else
    printf '  ✗ %-28s %s → %s (harap %s)\n' "$name" "$path" "$code" "$expect" | tee -a "$LOG"
    FAILS=$((FAILS+1))
  fi
}

# --- Route publik inti ---
check_http "Home" "/"
check_http "Katalog model" "/products"
check_http "Katalog SKU" "/products/all"
check_http "Promo" "/promo"
check_http "Keranjang" "/cart"
check_http "Checkout" "/checkout" 302
check_http "Cara pemesanan" "/cara-pemesanan"
check_http "FAQ" "/faq"
check_http "Masalah & solusi" "/masalah-dan-solusi"
check_http "Hasil pemasangan" "/hasil-pemasangan"
check_http "Info toko" "/about"
check_http "Reviews" "/reviews/web"
check_http "Privacy" "/policy/privacy"
check_http "Terms" "/policy/terms"
check_http "Status order" "/order/status"
check_http "Health" "/up"

# --- Error handling ---
check_http "404 page" "/halaman-tidak-ada" 404

# --- Admin login page ---
check_http "Login admin" "/login"

# --- DB (via artisan) ---
if cd /root/ragilaluminium 2>/dev/null && php artisan about --only=environment 2>/dev/null | grep -q 'production\|local'; then
  printf '  ✓ %-28s artisan berjalan\n' "Artisan" | tee -a "$LOG"
else
  printf '  ✗ %-28s artisan gagal\n' "Artisan" | tee -a "$LOG"
  FAILS=$((FAILS+1))
fi

# --- Queue worker ---
if systemctl is-active --quiet ragil-queue 2>/dev/null; then
  printf '  ✓ %-28s aktif\n' "Queue worker" | tee -a "$LOG"
else
  printf '  ✗ %-28s tidak aktif\n' "Queue worker" | tee -a "$LOG"
  FAILS=$((FAILS+1))
fi

# --- Security headers ---
HDRS=$(curl -s -D - -o /dev/null --max-time 10 "${BASE}/" 2>/dev/null)
for h in "X-Frame-Options" "X-Content-Type-Options" "Content-Security-Policy-Report-Only" "X-Request-ID"; do
  if echo "$HDRS" | grep -qi "$h"; then
    printf '  ✓ %-28s ada\n' "Header $h" | tee -a "$LOG"
  else
    printf '  ✗ %-28s tidak ada\n' "Header $h" | tee -a "$LOG"
    FAILS=$((FAILS+1))
  fi
done

echo "=== hasil: $([ "$FAILS" = 0 ] && echo PASS || echo "GAGAL ($FAILS)") ===" >> "$LOG"
if [ "$FAILS" = "0" ]; then rm -f "$ALERT"; fi
[ "$FAILS" = "0" ]
