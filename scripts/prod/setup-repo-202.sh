#!/usr/bin/env bash
#
# setup-repo-202.sh - Pasang repository mirror di VPS 202.
#
# Sekali jalan. Setelah ini deploy-202.sh bisa menarik kode dari GitHub
# sendiri, sehingga perbaikan kecil tidak lagi perlu menyalin berkas manual
# dari 209 (cara lama itu yang melahirkan folder rilis menumpuk).
#
# Token TIDAK boleh ditaruh di argumen baris perintah, karena argumen bisa
# terbaca pengguna lain lewat daftar proses. Pakai variabel lingkungan:
#
#   GITHUB_TOKEN=xxx sudo -E bash setup-repo-202.sh
#
# Atau lewat berkas yang dibaca skrip ini:
#
#   sudo bash setup-repo-202.sh --token-file=/root/.github-token
#
set -euo pipefail

APP_ROOT=/var/www/ragilaluminium
REPO_DIR="$APP_ROOT/repository"
REPO_SLUG="0xmemu/ragilaluminium"
CRED_FILE="$APP_ROOT/shared/.git-credentials"
BRANCH="main"

TOKEN="${GITHUB_TOKEN:-}"
TOKEN_FILE=""
for a in "$@"; do
  case "$a" in
    --token-file=*) TOKEN_FILE="${a#--token-file=}" ;;
    --branch=*)     BRANCH="${a#--branch=}" ;;
    -h|--help)      sed -n '2,20p' "$0"; exit 0 ;;
  esac
done

if [ -z "$TOKEN" ] && [ -n "$TOKEN_FILE" ]; then
  [ -r "$TOKEN_FILE" ] || { echo "GAGAL: berkas token tidak terbaca: $TOKEN_FILE" >&2; exit 1; }
  TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
fi

if [ -z "$TOKEN" ]; then
  echo "GAGAL: token kosong. Pakai GITHUB_TOKEN=xxx atau --token-file=..." >&2
  exit 1
fi

[ "$(id -u)" = 0 ] || { echo "GAGAL: jalankan sebagai root (sudo)." >&2; exit 1; }

echo "== 1. Simpan kredensial (mode 600, hanya deploy) =="
umask 077
printf 'https://x-access-token:%s@github.com\n' "$TOKEN" > "$CRED_FILE"
chown deploy:www-data "$CRED_FILE"
chmod 600 "$CRED_FILE"
echo "   tersimpan di $CRED_FILE"

echo "== 2. Bersihkan repository lama bila ada =="
rm -rf "$REPO_DIR"
mkdir -p "$REPO_DIR"
chown deploy:www-data "$REPO_DIR"

echo "== 3. Clone mirror =="
sudo -u deploy git -c credential.helper="store --file=$CRED_FILE" \
  clone --quiet "https://github.com/$REPO_SLUG.git" "$REPO_DIR"
sudo -u deploy git -C "$REPO_DIR" config credential.helper "store --file=$CRED_FILE"
sudo -u deploy git -C "$REPO_DIR" remote set-url origin "https://github.com/$REPO_SLUG.git"
echo "   HEAD: $(sudo -u deploy git -C "$REPO_DIR" rev-parse --short HEAD)"

echo "== 4. Uji fetch (memastikan kredensial bekerja) =="
sudo -u deploy git -C "$REPO_DIR" fetch --quiet origin "$BRANCH"
echo "   fetch OK: $(sudo -u deploy git -C "$REPO_DIR" rev-parse --short "origin/$BRANCH")"

echo "== 5. Token tidak muncul di konfigurasi git =="
if sudo -u deploy git -C "$REPO_DIR" config --get remote.origin.url | grep -q '@'; then
  echo "   remote masih memuat token, dibersihkan"
  sudo -u deploy git -C "$REPO_DIR" remote set-url origin "https://github.com/$REPO_SLUG.git"
fi
echo "   remote: $(sudo -u deploy git -C "$REPO_DIR" config --get remote.origin.url)"

echo
echo "SELESAI. Lanjutkan dengan:"
echo "  sudo bash $APP_ROOT/deploy-202.sh --dry-run"
