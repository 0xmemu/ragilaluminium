#!/usr/bin/env bash
# Audit semantik read-only database MySQL — membuktikan data BISNIS konsisten,
# bukan hanya terbaca secara teknis (melengkapi CHECK TABLE / rowcount restore test).
# Pakai: scripts_semantic_audit.sh <db_name>   (default: ragil_restore_test)
# Exit 0 = semua invariant bersih; 1 = ada anomali -> alert.
#
# Formula otoritatif (app/Services/OrderService.php baris 176 dan 705):
#   total_amount = subtotal_amount + shipping_amount + shipping_insurance_amount
#                  - voucher_discount_amount + cod_fee_amount
# (asuransi pengiriman ikut masuk total; discount_amount informatif dan TIDAK
#  dikurangkan, shipping_subsidy_amount kolom terpisah.)
# Catatan: discount_amount = diskon banding harga (informatif, TIDAK dikurangkan);
# shipping_subsidy_amount = kolom terpisah, TIDAK mengubah total.
set -uo pipefail

ENV_FILE=/root/ragilaluminium/.env
LOG=/root/backups/semantic-audit.log
ALERT=/root/backups/ALERT-semantic-audit
DB_NAME=${1:-ragil_restore_test}

DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=$(awk -F= '/^DB_HOST=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=${DB_HOST:-127.0.0.1}

: "${DB_USER:?DB_USERNAME kosong}"
: "${DB_PASS:?DB_PASSWORD kosong}"

M() { env MYSQL_PWD="$DB_PASS" mysql -N --user="$DB_USER" --host="$DB_HOST" "$DB_NAME" -e "$1" 2>/dev/null; }

echo "=== $(date '+%F %T') audit $DB_NAME ===" >> "$LOG"
FAILS=0

check() { # check <nama> <query_yang_menghasilkan_0_saat_benar>
  local name="$1" q="$2" n
  n=$(M "$q" | head -1)
  n=${n:-0}
  if [ "$n" = "0" ]; then
    printf '  PASS  %-38s\n' "$name" | tee -a "$LOG"
  else
    printf '  FAIL  %-38s (%s temuan)\n' "$name" "$n" | tee -a "$LOG"
    FAILS=$((FAILS+1))
  fi
}

# --- Invariant relasi & kelengkapan ---
check "order_items yatim (tanpa order)" "SELECT COUNT(*) FROM order_items oi LEFT JOIN orders o ON o.id=oi.order_id WHERE o.id IS NULL;"
check "payments yatim (tanpa order)"  "SELECT COUNT(*) FROM payments p LEFT JOIN orders o ON o.id=p.order_id WHERE o.id IS NULL;"
check "order tanpa order_items"        "SELECT COUNT(*) FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id WHERE oi.id IS NULL;"
check "order_number duplikat"          "SELECT COUNT(*) FROM (SELECT order_number FROM orders GROUP BY order_number HAVING COUNT(*)>1) d;"
check "order tanpa nama pelanggan"     "SELECT COUNT(*) FROM orders WHERE customer_name IS NULL OR customer_name='';"
check "order tanpa telepon pelanggan"  "SELECT COUNT(*) FROM orders WHERE customer_phone IS NULL OR customer_phone='';"

# --- Invariant nilai (formula OrderService di atas; toleransi Rp 1) ---
check "total_amount != subtotal+ongkir+asuransi-voucher+codfee" "
SELECT COUNT(*) FROM orders
WHERE ABS(total_amount - (subtotal_amount + shipping_amount + COALESCE(shipping_insurance_amount,0) - COALESCE(voucher_discount_amount,0) + COALESCE(cod_fee_amount,0))) > 1;"
check "subtotal_amount negatif"  "SELECT COUNT(*) FROM orders WHERE subtotal_amount < 0;"
check "shipping_amount negatif"  "SELECT COUNT(*) FROM orders WHERE shipping_amount < 0;"
check "discount_amount negatif"  "SELECT COUNT(*) FROM orders WHERE discount_amount < 0;"
check "total_amount negatif"     "SELECT COUNT(*) FROM orders WHERE total_amount < 0;"
check "payment amount negatif"   "SELECT COUNT(*) FROM payments WHERE amount < 0;"
check "cod_fee_amount negatif"   "SELECT COUNT(*) FROM orders WHERE COALESCE(cod_fee_amount,0) < 0;"

# --- Invariant status (sesuai ROLE-AND-STATUS-CONTRACT) ---
check "order_status di luar enum" "
SELECT COUNT(*) FROM orders
WHERE order_status NOT IN ('awaiting_confirmation','processing','shipped','delivered','completed','issue','return_in_process','return_completed','cancelled');"
check "payment_status di luar enum" "
SELECT COUNT(*) FROM orders
WHERE payment_status NOT IN ('pending','paid','refunded');"
check "shipping_status di luar enum" "
SELECT COUNT(*) FROM orders
WHERE shipping_status NOT IN ('pending_pickup','in_process','picked_up','in_transit','delivered','returned','cancelled','exception','tracking_pending','unknown');"
check "payment_method di luar enum" "
SELECT COUNT(*) FROM orders
WHERE payment_method NOT IN ('cod','transfer','other');"
check "payment.status di luar enum" "
SELECT COUNT(*) FROM payments
WHERE status NOT IN ('pending','completed','failed','refunded');"
check "cod_flag=1 tapi payment_method!=cod"  "SELECT COUNT(*) FROM orders WHERE cod_flag=1 AND payment_method<>'cod';"
check "cod_flag=0 tapi payment_method=cod"   "SELECT COUNT(*) FROM orders WHERE cod_flag=0 AND payment_method='cod';"

# --- Invariant pembayaran vs order ---
check "total payment completed > total_amount order" "
SELECT COUNT(*) FROM (
  SELECT p.order_id, SUM(p.amount) AS paid, o.total_amount
  FROM payments p JOIN orders o ON o.id=p.order_id
  WHERE p.status IN ('completed','refunded')
  GROUP BY p.order_id, o.total_amount
  HAVING paid > o.total_amount + 1
) x;"
check "payment_status=paid tanpa payment completed" "
SELECT COUNT(*) FROM orders o
WHERE o.payment_status='paid'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.status IN ('completed','refunded'));"

if [ "$FAILS" = "0" ]; then
  echo "SEMANTIC AUDIT PASS (drill $(date '+%F %T'))" >> "$LOG"
  date +%FT%T > /root/backups/last-semantic-audit-pass
  rm -f "$ALERT"
  exit 0
else
  echo "SEMANTIC AUDIT GAGAL — $FAILS invariant dilanggar" >> "$LOG"
  touch "$ALERT"
  exit 1
fi
