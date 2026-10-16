#!/usr/bin/env bash
#
# deploy-202.sh - Deploy rilis ke VPS 202 (layout releases/ + symlink current).
#
# Menggantikan cara lama yang menyalin berkas manual dari 209. Cara lama itu
# melahirkan folder rilis baru setiap perbaikan kecil dan tidak pernah
# memangkasnya, sehingga disk tumbuh sekitar 520 MB per deploy. Skrip ini
# membuat rilis baru dari repository mirror, mengalihkan symlink secara
# atomik, memeriksa kesehatan, dan memangkas rilis lama otomatis.
#
# Pakai:
#   ./deploy-202.sh                          # deploy origin/main terbaru
#   ./deploy-202.sh --ref=v1.0.1             # deploy tag
#   ./deploy-202.sh --ref=<sha> --label=fix  # deploy commit tertentu
#   ./deploy-202.sh --rollback               # kembali ke rilis sebelumnya
#   ./deploy-202.sh --prune-only             # pangkas rilis lama saja
#   ./deploy-202.sh --dry-run                # latihan, tanpa mengubah apa pun
#
# Opsi lain:
#   --keep=N     jumlah rilis yang disimpan (default 2: aktif + 1 sebelumnya)
#   --branch=X   cabang sumber (default main)
#
set -euo pipefail

APP_ROOT=/var/www/ragilaluminium
REPO_DIR="$APP_ROOT/repository"
RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
SHARED="$APP_ROOT/shared"
LOG="$APP_ROOT/deploy.log"
LOCK="$APP_ROOT/.deploy.lock"

KEEP=2
REF=""
BRANCH="main"
LABEL=""
MODE="deploy"
DRY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --ref=*)      REF="${1#--ref=}" ;;
    --branch=*)   BRANCH="${1#--branch=}" ;;
    --label=*)    LABEL="${1#--label=}" ;;
    --keep=*)     KEEP="${1#--keep=}" ;;
    --rollback)   MODE="rollback" ;;
    --prune-only) MODE="prune" ;;
    --dry-run)    DRY=1 ;;
    -h|--help)    sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "Opsi tidak dikenal: $1" >&2; exit 2 ;;
  esac
  shift
done

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG"; }
die() { log "GAGAL: $*"; exit 1; }
run() { if [ "$DRY" = 1 ]; then log "[dry-run] $*"; else "$@"; fi; }

# Daftar rilis dari yang terbaru. Diurutkan berdasarkan waktu ubah folder, bukan
# nama, karena rilis lama punya pola nama berbeda (mis. 20261014-media-folder-menu)
# sehingga urutan nama tidak selalu sama dengan urutan pembuatan.
releases_newest_first() {
  find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' 2>/dev/null \
    | sort -rn | cut -d' ' -f2-
}

[ "$(id -u)" = 0 ] || SUDO="sudo"
SUDO="${SUDO:-}"

# --- Kunci: cegah dua deploy berjalan bersamaan -----------------------------
exec 9>"$LOCK"
flock -n 9 || die "deploy lain sedang berjalan (kunci $LOCK)"

log "=== deploy-202 mulai (mode=$MODE, dry_run=$DRY) ==="

# --- Pangkas rilis lama -----------------------------------------------------
# Menyimpan KEEP rilis terbaru. Rilis yang sedang ditunjuk current tidak pernah
# dihapus, apa pun urutannya, supaya situs tidak pernah kehilangan sumbernya.
prune_releases() {
  local active keepers target
  active="$(basename "$(readlink -f "$CURRENT")")"
  log "pangkas: rilis aktif=$active, simpan=$KEEP"

  # Urutan waktu ubah, terbaru lebih dulu.
  mapfile -t keepers < <(releases_newest_first | head -n "$KEEP")
  if ! printf '%s\n' "${keepers[@]}" | grep -qx "$active"; then
    keepers+=("$active")
  fi

  local removed=0 freed=0
  for target in $(releases_newest_first); do
    if printf '%s\n' "${keepers[@]}" | grep -qx "$target"; then
      continue
    fi
    local size
    size="$(du -sm "$RELEASES/$target" 2>/dev/null | cut -f1 || echo 0)"
    run $SUDO rm -rf "$RELEASES/$target"
    removed=$((removed + 1))
    freed=$((freed + size))
    log "  hapus rilis lama: $target (${size}MB)"
  done

  log "pangkas selesai: $removed rilis dihapus, sekitar ${freed}MB dibebaskan"
}

if [ "$MODE" = "prune" ]; then
  prune_releases
  log "=== selesai (prune) ==="
  exit 0
fi

# --- Rollback: alihkan current ke rilis sebelumnya --------------------------
if [ "$MODE" = "rollback" ]; then
  active="$(basename "$(readlink -f "$CURRENT")")"
  prev="$(releases_newest_first | grep -vx "$active" | head -n1 || true)"
  [ -n "$prev" ] || die "tidak ada rilis sebelumnya untuk rollback"
  log "rollback: $active -> $prev"
  run $SUDO ln -sfn "$RELEASES/$prev" "$APP_ROOT/current.new"
  run $SUDO mv -Tf "$APP_ROOT/current.new" "$CURRENT"
  run $SUDO systemctl reload php8.3-fpm
  run $SUDO systemctl restart ragil-queue laravel-reverb
  log "=== selesai (rollback ke $prev) ==="
  exit 0
fi

# --- 1. Ambil sumber dari repository mirror ---------------------------------
[ -d "$REPO_DIR" ] || die "repository mirror belum ada di $REPO_DIR (lihat catatan pemasangan)"

# Mirror dimiliki user deploy, sedangkan skrip ini berjalan sebagai root. Git
# menolak repo dengan pemilik berbeda (dubious ownership), jadi semua perintah
# git dijalankan sebagai deploy, bukan sebagai root.
if [ "$(id -u)" = 0 ]; then
  GIT=(sudo -u deploy git -C "$REPO_DIR")
else
  GIT=(git -C "$REPO_DIR")
fi

log "fetch dari origin..."
run "${GIT[@]}" remote update --prune

if [ -z "$REF" ]; then
  REF="origin/$BRANCH"
fi
if [ "$DRY" = 0 ]; then
  SHA="$("${GIT[@]}" rev-parse --verify "$REF^{commit}")" || die "ref tidak ditemukan: $REF"
  SHORT="$("${GIT[@]}" rev-parse --short "$SHA")"
else
  SHA="dryrun"; SHORT="dryrun"
fi
log "target: $REF -> $SHORT"

# --- 2. Siapkan folder rilis ------------------------------------------------
STAMP="$(date '+%Y%m%d%H%M%S')"
SLUG="${LABEL:-$SHORT}"
SLUG="$(printf '%s' "$SLUG" | tr -c 'A-Za-z0-9._-' '-')"
NEW_RELEASE="$RELEASES/${STAMP}-${SLUG}"

log "rilis baru: $(basename "$NEW_RELEASE")"
run $SUDO mkdir -p "$NEW_RELEASE"
if [ "$DRY" = 0 ]; then
  "${GIT[@]}" archive "$SHA" | $SUDO tar -x -C "$NEW_RELEASE"
fi

# --- 3. Sambungkan berkas bersama -------------------------------------------
run $SUDO ln -sfn "$SHARED/.env" "$NEW_RELEASE/.env"
run $SUDO mkdir -p "$NEW_RELEASE/storage/framework/cache/data" \
                    "$NEW_RELEASE/storage/framework/sessions" \
                    "$NEW_RELEASE/storage/framework/views" \
                    "$NEW_RELEASE/storage/logs" \
                    "$NEW_RELEASE/bootstrap/cache"
# storage/app disimpan bersama antar rilis supaya data seperti berkas wilayah
# tidak hilang setiap deploy. Subfolder yang dibutuhkan aplikasi dipastikan ada
# di shared lebih dulu, karena setelah symlink dipasang, isi storage/app rilis
# mengikuti shared dan folder yang tidak ada di sana ikut hilang.
run $SUDO mkdir -p "$SHARED/storage/app/public" \
                    "$SHARED/storage/app/private" \
                    "$SHARED/storage/app/imports" \n                    "$SHARED/storage/logs"
# Folder log bersama wajib ada: layanan systemd laravel-reverb menulis log
# ke $SHARED/storage/logs. systemd menolak start (status 209/STDOUT) bila
# berkas tujuannya tidak bisa dibuka, sehingga tanpa folder ini WebSocket
# admin mati setelah deploy.
run $SUDO chown www-data:www-data "$SHARED/storage/logs"
run $SUDO chmod 2775 "$SHARED/storage/logs"
run $SUDO rm -rf "$NEW_RELEASE/storage/app"
run $SUDO ln -sfn "$SHARED/storage/app" "$NEW_RELEASE/storage/app"
run $SUDO ln -sfn "$SHARED/storage/app/public" "$NEW_RELEASE/public/storage"

# --- 4. Bangun dependensi dan aset -----------------------------------------
log "composer install..."
if [ "$DRY" = 0 ]; then
  ( cd "$NEW_RELEASE" && composer install --no-interaction --prefer-dist --no-dev --no-progress --optimize-autoloader ) >>"$LOG" 2>&1
fi

log "npm ci + build..."
if [ "$DRY" = 0 ]; then
  ( cd "$NEW_RELEASE" && npm ci --no-audit --no-fund && npm run build ) >>"$LOG" 2>&1
fi

# --- 5. Kepemilikan dan izin ------------------------------------------------
run $SUDO chown -R deploy:www-data "$NEW_RELEASE"
run $SUDO chown -R www-data:www-data "$NEW_RELEASE/storage" "$NEW_RELEASE/bootstrap/cache"
run $SUDO chmod -R g+ws "$NEW_RELEASE/storage" "$NEW_RELEASE/bootstrap/cache"

# --- 6. Panaskan cache dalam konteks rilis baru -----------------------------
log "cache config/route/view..."
if [ "$DRY" = 0 ]; then
  ( cd "$NEW_RELEASE" && php artisan config:cache && php artisan route:cache && php artisan view:cache ) >>"$LOG" 2>&1
fi

# --- 7. Alihkan symlink secara atomik ---------------------------------------
PREV="$(basename "$(readlink -f "$CURRENT")")"
log "alihkan current: $PREV -> $(basename "$NEW_RELEASE")"
run $SUDO ln -sfn "$NEW_RELEASE" "$APP_ROOT/current.new"
run $SUDO mv -Tf "$APP_ROOT/current.new" "$CURRENT"

# --- 8. Muat ulang layanan --------------------------------------------------
run $SUDO systemctl reload php8.3-fpm
run $SUDO systemctl restart ragil-queue laravel-reverb

# --- 9. Periksa kesehatan, batalkan otomatis kalau gagal --------------------
health_check() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://ragilaluminium.com/ || echo 000)"
  [ "$code" = "200" ]
}

if [ "$DRY" = 0 ]; then
  log "periksa kesehatan..."
  ok=0
  for i in 1 2 3 4 5; do
    if health_check; then ok=1; break; fi
    log "  percobaan $i gagal, tunggu 5 detik"
    sleep 5
  done

  if [ "$ok" = 0 ]; then
    log "KESEHATAN GAGAL, rollback ke $PREV"
    $SUDO ln -sfn "$RELEASES/$PREV" "$APP_ROOT/current.new"
    $SUDO mv -Tf "$APP_ROOT/current.new" "$CURRENT"
    $SUDO systemctl reload php8.3-fpm
    $SUDO systemctl restart ragil-queue laravel-reverb
    die "deploy dibatalkan, sudah kembali ke $PREV"
  fi
  log "kesehatan OK"
fi

# --- 10. Pangkas rilis lama -------------------------------------------------
prune_releases

log "=== deploy-202 selesai: $SHORT aktif ==="
