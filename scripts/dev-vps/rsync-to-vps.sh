#!/usr/bin/env bash
# One-shot rsync from laptop/WSL/mac to VPS when Git remote is awkward.
# Run FROM the machine that has the full repo (not from empty VPS).
#
# Usage:
#   export RAGIL_SSH=ragil-dev
#   export RAGIL_REMOTE_DIR=/var/www/ragilaluminium
#   bash scripts/dev-vps/rsync-to-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="${RAGIL_SSH:-ragil-dev}"
REMOTE_DIR="${RAGIL_REMOTE_DIR:-/var/www/ragilaluminium}"

echo "Rsync ${ROOT}/ → ${SSH_HOST}:${REMOTE_DIR}/"
ssh "${SSH_HOST}" "mkdir -p '${REMOTE_DIR}'"

rsync -avz --delete \
  --exclude '.env' \
  --exclude 'node_modules' \
  --exclude 'vendor' \
  --exclude 'public/hot' \
  --exclude 'public/build' \
  --exclude 'storage/logs/*' \
  --exclude 'storage/framework/cache/*' \
  --exclude 'storage/framework/sessions/*' \
  --exclude 'storage/framework/views/*' \
  -e ssh \
  "${ROOT}/" "${SSH_HOST}:${REMOTE_DIR}/"

echo "Done. On VPS run: sudo -E bash ${REMOTE_DIR}/scripts/dev-vps/bootstrap.sh"
echo "(Omit RAGIL_GIT_URL if artisan already present.)"
