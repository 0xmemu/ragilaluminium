#!/usr/bin/env bash
# Dev VPS firewall: SSH + Laravel artisan serve (8200).
# Usage: sudo bash scripts/dev-vps/ufw-allow.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

apt-get update -y
apt-get install -y ufw

ufw allow OpenSSH
ufw allow 8200/tcp comment 'ragil-dev artisan serve'
ufw --force enable
ufw status verbose

echo "OK: UFW enabled (OpenSSH + 8200/tcp). Restrict 8200 to your home IP when possible."
