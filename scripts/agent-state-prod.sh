#!/usr/bin/env bash
# agent-state-prod.sh - briefing pra-deploy untuk produksi 202.
#
# Jalankan dari MESIN LOKAL (bukan dari dalam 209/202), karena butuh kunci SSH
# produksi. Tujuannya menjawab satu pertanyaan sebelum deploy dimulai: apakah
# ada kerja bersamaan yang bisa menggagalkan proses ini?
#
# Yang diperiksa:
#   1. Proses deploy yang masih hidup di produksi (rsync/scp/cp/npm/vite/composer/migrate)
#   2. Umur symlink current dan rilis terbaru di releases/
#   3. Apakah rilis live sudah memuat commit terkini (bandingkan berkas kunci)
#   4. Aktivitas tulis terakhir di storage/logs (tanda aplikasi sedang sibuk)
#
# Pakai: bash scripts/agent-state-prod.sh
# Override: PROD_HOST, PROD_USER, PROD_KEY, PROD_PATH, SRC_HOST, SRC_PATH
set -u

PROD_HOST="${PROD_HOST:-202.74.74.87}"
PROD_USER="${PROD_USER:-jendelaragilaluminium}"
PROD_KEY="${PROD_KEY:-$HOME/.ssh/ragil_prod_ed25519}"
PROD_PATH="${PROD_PATH:-/var/www/ragilaluminium}"
# Sumber kode pembanding (repo kerja) untuk memeriksa berkas kunci.
SRC_HOST="${SRC_HOST:-209.23.10.62}"
SRC_PATH="${SRC_PATH:-/root/ragilaluminium}"

SSH_PROD=(ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -i "$PROD_KEY" "$PROD_USER@$PROD_HOST")

echo "=============================================================="
echo "KONDISI PRODUKSI  ($(date -u "+%Y-%m-%d %H:%M UTC"))"
echo "  host: $PROD_USER@$PROD_HOST"
echo "=============================================================="

if ! "${SSH_PROD[@]}" "true" 2>/dev/null; then
  echo "  TIDAK BISA MENYAMBUNG ke produksi."
  echo "  Periksa kunci SSH: $PROD_KEY"
  echo "  Skrip ini harus dijalankan dari mesin lokal, bukan dari dalam server."
  exit 1
fi

echo
echo "--- 1. PROSES DEPLOY YANG SEDANG BERJALAN ---"
# Pola yang menandakan deploy sedang berjalan. php-fpm dan queue sengaja TIDAK
# dihitung: keduanya memang selalu hidup.
PROSES=$("${SSH_PROD[@]}" "sudo ps -eo pid,etimes,args --no-headers 2>/dev/null | grep -E 'rsync|scp |cp -a|npm run build|vite build|composer install|artisan migrate|artisan config:cache|artisan route:cache' | grep -v grep" 2>/dev/null)
if [ -n "$PROSES" ]; then
  echo "  ADA PROSES DEPLOY BERJALAN:"
  echo "$PROSES" | sed 's/^/    /'
  echo
  echo "  JANGAN MULAI DEPLOY. Tunggu sampai proses di atas selesai."
else
  echo "  (bersih: tidak ada proses deploy berjalan)"
fi

echo
echo "--- 2. RILIS DAN SYMLINK current ---"
"${SSH_PROD[@]}" "
  printf '  current -> '; readlink $PROD_PATH/current
  printf '  umur symlink current: '; stat -c '%y' $PROD_PATH/current 2>/dev/null | cut -d'.' -f1
  echo '  rilis yang ada (terbaru di bawah):'
  ls -1dt $PROD_PATH/releases/*/ 2>/dev/null | head -5 | sed 's/^/    /'
" 2>/dev/null

echo
echo "--- 3. APAKAH RILIS LIVE SUDAH MEMUAT COMMIT TERKINI ---"
# Bandingkan berkas kunci antara rilis live dan repo kerja. Kalau berbeda,
# rilis live tertinggal dari repo dan deploy perlu dilakukan.
KUNCI="app/Models/MediaProcessingLog.php app/Http/Controllers/Admin/ProductMediaController.php resources/js/pages/Admin/Media/History.tsx"
BEDA=0
for f in $KUNCI; do
  H_PROD=$("${SSH_PROD[@]}" "sudo md5sum $PROD_PATH/current/$f 2>/dev/null | cut -d' ' -f1" 2>/dev/null)
  H_SRC=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$SRC_HOST" "md5sum $SRC_PATH/$f 2>/dev/null | cut -d' ' -f1" 2>/dev/null)
  if [ -z "$H_PROD" ] || [ -z "$H_SRC" ]; then
    printf "  %-52s (tidak bisa dibandingkan)\n" "$(basename "$f")"
    continue
  fi
  if [ "$H_PROD" = "$H_SRC" ]; then
    printf "  %-52s SAMA\n" "$(basename "$f")"
  else
    printf "  %-52s BERBEDA (rilis live tertinggal)\n" "$(basename "$f")"
    BEDA=$((BEDA + 1))
  fi
done
if [ "$BEDA" -gt 0 ]; then
  echo
  echo "  $BEDA berkas kunci berbeda: rilis live TIDAK memuat kode terkini."
  echo "  Kalau Anda baru saja push, deploy memang perlu dijalankan."
  echo "  Kalau Anda TIDAK merasa melakukan perubahan, periksa dulu rilis terbaru di"
  echo "  releases/: mungkin agent lain sedang deploy atau baru saja deploy."
fi

echo
echo "--- 4. AKTIVITAS APLIKASI (log terakhir) ---"
"${SSH_PROD[@]}" "
  L=\$(ls -t $PROD_PATH/current/storage/logs/*.log 2>/dev/null | head -1)
  if [ -n \"\$L\" ]; then
    printf '  log terakhir diubah: '; stat -c '%y' \"\$L\" | cut -d'.' -f1
    printf '  error aplikasi terakhir: '; sudo grep -h 'production.ERROR' \"\$L\" 2>/dev/null | tail -1 | cut -c1-100 || echo '(tidak ada)'
  else
    echo '  (tidak ada berkas log)'
  fi
" 2>/dev/null

echo
echo "--- SEBELUM DEPLOY ---"
echo "  1. Gerbang 1-3 (repo) sudah lolos: berkas Anda saja yang di-commit, push bersih."
echo "  2. Tidak ada proses deploy lain yang berjalan (bagian 1)."
echo "  3. Deploy dari SATU commit lengkap, bukan potongan berkas dari working tree."
echo "  4. Buat rilis baru di samping rilis live; jangan menimpanya."
echo "  5. Ambil backup DB sebelum migrate."
echo "  6. Sesudah deploy, verifikasi chunk live dan kode di current."
echo "=============================================================="
