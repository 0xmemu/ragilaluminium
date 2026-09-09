#!/usr/bin/env bash
# ==============================================================================
# SCRIPT EKSPOR DATABASE MASTER DARI VPS DEV (209.23.10.62)
# Menghasilkan dump SQL bersih siap pakai untuk VPS Production baru.
# Termasuk: 108 Produk Resmi, 1.296 Varian, Master Alamat J&T, Kode Pos, CMS.
# ==============================================================================

set -euo pipefail

OUTPUT_FILE="/root/ragil_prod_master_$(date +%Y%m%d_%H%M%S).sql.gz"

echo ">>> Mengekspor database ragil_aluminium dari server dev..."
mysqldump ragil_aluminium \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --ignore-table=ragil_aluminium.sessions \
  --ignore-table=ragil_aluminium.failed_jobs \
  | gzip -9 > "${OUTPUT_FILE}"

echo "===================================================================="
echo "DUMP BERHASIL DIBUAT:"
ls -lh "${OUTPUT_FILE}"
echo "===================================================================="
echo "Gunakan file ini untuk restore di VPS prod baru dengan perintah:"
echo "zcat ${OUTPUT_FILE} | mysql -u ragil_app -p'RagilProd2026Secure!' ragil_aluminium"
