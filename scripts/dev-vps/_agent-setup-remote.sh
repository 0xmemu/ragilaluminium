#!/usr/bin/env bash
# One-shot agent helper: probe → rsync → bootstrap → ufw → serve
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="${RAGIL_SSH:-ragil-dev}"
REMOTE_DIR="${RAGIL_REMOTE_DIR:-/var/www/website.4.0}"
APP_URL="${RAGIL_APP_URL:-http://49.51.136.145:8200}"

ssh_run() {
  ssh -o BatchMode=yes -o ConnectTimeout=20 "${SSH_HOST}" "$@"
}

echo "==> Probe"
ssh_run 'whoami; hostname; id'
if ssh_run 'sudo -n true' 2>/dev/null; then
  echo "SUDO_NOPASS=yes"
else
  echo "SUDO_NOPASS=no"
  echo "Need passwordless sudo for bootstrap. Aborting." >&2
  exit 2
fi

echo "==> Ensure remote app dir owned by ubuntu"
ssh_run "sudo mkdir -p '${REMOTE_DIR}' && sudo chown -R ubuntu:ubuntu '$(dirname "${REMOTE_DIR}")' '${REMOTE_DIR}' 2>/dev/null || sudo chown -R ubuntu:ubuntu '${REMOTE_DIR}'"

echo "==> Rsync"
bash "${ROOT}/scripts/dev-vps/rsync-to-vps.sh"

echo "==> Bootstrap (long)"
ssh_run "sudo RAGIL_APP_URL='${APP_URL}' RAGIL_APP_DIR='${REMOTE_DIR}' bash '${REMOTE_DIR}/scripts/dev-vps/bootstrap.sh'"

echo "==> UFW"
ssh_run "sudo bash '${REMOTE_DIR}/scripts/dev-vps/ufw-allow.sh'"

echo "==> Start Nginx + php-fpm on :8200"
ssh_run "sudo bash '${REMOTE_DIR}/scripts/dev-vps/serve-dev.sh'"

sleep 2
echo "==> Verify"
ssh_run "curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8200/ || true"
curl -sS -o /dev/null -w "external:%{http_code}\n" --connect-timeout 10 "http://49.51.136.145:8200/" || true

echo "DONE"
