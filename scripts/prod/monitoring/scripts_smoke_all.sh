#!/usr/bin/env bash
# Smoke test konsistensi SEMUA halaman publik via https.
# Pass: 200 dengan data-page OR 301/302 redirect kanonik (bukan error).
# Fail: 500/403/404/timeout, atau body kosong, atau response bukan Inertia.
set -uo pipefail
BASE="https://ra.333labs.tech"
PAGES=(/ /about /cara-pemesanan /cart /faq /flash-sale /hasil-pemasangan /masalah-dan-solusi \
 /order/status /policy/privacy /policy/terms /products /products/all /products/jendela \
 /products/jendela/jungkit /products/jendela/jungkit/polos /promo /reviews /reviews/web \
 /search?q=aluminium /contact)
PASS=0; FAIL=0
echo "=== $(date '+%F %T') smoke test semua halaman publik ==="
for p in "${PAGES[@]}"; do
  CODE=$(curl -s -o /tmp/smoke_body -w '%{http_code}' --max-time 20 -A "RagilSmoke/1.0" "${BASE}${p}" 2>/dev/null)
  REDIR=$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 10 "${BASE}${p}" 2>/dev/null)
  SIZE=$(wc -c < /tmp/smoke_body 2>/dev/null)
  HAS_PAGE=$(grep -c 'data-page="app"' /tmp/smoke_body 2>/dev/null || echo 0)
  # 200+datar=pass; 301/302 (redirect kanonik)=pass
  if { [ "$CODE" = "200" ] && [ "${HAS_PAGE:-0}" -ge 1 ]; } || [ "$CODE" = "301" ] || [ "$CODE" = "302" ]; then
    if [ "$CODE" = "200" ]; then
      PASS=$((PASS+1)); printf "  ✓ %-32s 200 (%sb)\n" "$p" "$SIZE"
    else
      PASS=$((PASS+1)); printf "  ✓ %-32s %s -> %s (kanonik)\n" "$p" "$CODE" "${REDIR:0:40}"
    fi
  else
    FAIL=$((FAIL+1)); printf "  ✗ %-32s HTTP=%s size=%s page=%s\n" "$p" "$CODE" "$SIZE" "$HAS_PAGE"
  fi
done
rm -f /tmp/smoke_body
echo "=== hasil: PASS=$PASS FAIL=$FAIL ==="
[ "$FAIL" = "0" ]