#!/usr/bin/env bash
# Deploy Ragil Aluminium ke VPS (aman, forward-only, reversible).
# Pakai: scripts_deploy.sh [--tag=vX.Y.Z] [--dry-run] [--ref=<sha>]
# Default: pull origin/<branch> terbaru, forward-only migrate, restart queue graceful.
set -euo pipefail

REPO=/root/ragilaluminium
LOG=/root/backups/deploy.log
BRANCH="feat/admin-ui-redesign"

TAG=""
REF=""
DRY=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --tag=*) TAG="${a#--tag=}" ;;
    --ref=*) REF="${a#--ref=}" ;;
    --branch=*) BRANCH="${a#--branch=}" ;;
  esac
done

echo "=== $(date '+%F %T') deploy ($([ "$DRY" = 1 ] && echo DRY-RUN || echo LIVE)) ===" >> "$LOG"

if [ "$DRY" = "1" ]; then
  echo "(dry-run: hanya verifikasi, tidak mengubah apa pun)" >> "$LOG"
fi

cd "$REPO"

# --- 1. Backup .env (jaga-jaga, reversible), hanya saat LIVE, bukan dry-run ---
if [ "$DRY" != "1" ] && [ -f .env ]; then
  cp .env /root/backups/.env.bak-deploy-$(date +%Y%m%d-%H%M%S)
  echo "  .env di-backup" >> "$LOG"
fi

# --- 2. Git: simulasi target ref tanpa checkout dulu ---
if [ -n "$TAG" ]; then
  echo "  target: tag $TAG" >> "$LOG"
  git fetch --tags origin 2>>"$LOG"
  git rev-parse --verify "$TAG" >/dev/null 2>&1 || { echo "ERROR: tag $TAG tidak ada" >> "$LOG"; exit 1; }
  REF_TARGET="$TAG"
elif [ -n "$REF" ]; then
  echo "  target: sha $REF" >> "$LOG"
  git fetch origin 2>>"$LOG"
  git rev-parse --verify "$REF" >/dev/null 2>&1 || { echo "ERROR: sha $REF tidak ada" >> "$LOG"; exit 1; }
  REF_TARGET="$REF"
else
  echo "  target: branch $BRANCH (HEAD)" >> "$LOG"
  git fetch origin "$BRANCH" 2>>"$LOG"
  REF_TARGET="origin/$BRANCH"
fi

NEW_SHA=$(git rev-parse --short "$REF_TARGET")
CUR_SHA=$(git rev-parse --short HEAD)
echo "  current=$CUR_SHA -> target=$NEW_SHA" >> "$LOG"

# --- 3. Pre-deploy backup DB (full dump sebelum migrate) ---
if [ "$DRY" != "1" ]; then
  echo "  pre-deploy backup DB..." >> "$LOG"
  /root/scripts_backup_mysql.sh >> "$LOG" 2>&1 || echo "  WARN: backup DB gagal" >> "$LOG"
fi

if [ "$DRY" = "1" ]; then
  echo "DEPLOY DRY-RUN PASS: target $NEW_SHA siap deploy" >> "$LOG"
  exit 0
fi

# --- 4. Checkout target + install prod deps ---
echo "  checkout $NEW_SHA..." >> "$LOG"
git checkout "$REF_TARGET" 2>>"$LOG"

echo "  composer install (--no-dev)..." >> "$LOG"
composer install --no-interaction --prefer-dist --no-dev --no-progress >> "$LOG" 2>&1

echo "  npm ci + build (aman, public/build tidak dikosongkan)..." >> "$LOG"
npm ci >> "$LOG" 2>&1
bash scripts/prod/build-assets.sh >> "$LOG" 2>&1

# --- 5. Bersihkan public/hot (Vite dev hot-file jangan sampai di prod) ---
rm -f public/hot
echo "  public/hot dihapus (guard)" >> "$LOG"

# --- 6. Forward-only migrasi (TIDAK PERNAH fresh/wipe) ---
echo "  migrate --force (forward-only)..." >> "$LOG"
php artisan migrate --force >> "$LOG" 2>&1
echo "  migrate OK" >> "$LOG"

# --- 7. Cache config/routes/views ---
echo "  cache config/route/view..." >> "$LOG"
php artisan config:cache >> "$LOG" 2>&1
php artisan route:cache >> "$LOG" 2>&1
php artisan view:cache >> "$LOG" 2>&1

# --- 8. Restart queue secara graceful + reload PHP-FPM ---
echo "  restart queue + reload fpm..." >> "$LOG"
php artisan queue:restart >> "$LOG" 2>&1
systemctl reload php8.3-fpm 2>/dev/null || echo "  WARN: reload fpm (non-fatal)"

# --- 9. Verifikasi kesehatan ---
echo "  verifikasi..." >> "$LOG"
sleep 3
curl -s -o /dev/null -w '  app home: %{http_code}\n' --max-time 15 http://127.0.0.1:8200/ | tee -a "$LOG"
php artisan --version >> "$LOG" 2>&1

echo "DEPLOY COMPLETE: $CUR_SHA -> $NEW_SHA (manifest: $NEW_SHA on $BRANCH)" >> "$LOG"