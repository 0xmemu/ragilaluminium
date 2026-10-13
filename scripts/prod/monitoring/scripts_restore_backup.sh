#!/usr/bin/env bash
# Restore backup MySQL (gzip) ke database target.
# Usage: scripts_restore_backup.sh [<file.sql.gz>] [<target_db>]
# Default: backup latest -> ragil (harus di-drop dulu jika ada).
set -euo pipefail

ENV_FILE=/root/ragilaluminium/.env
BACKUP_DIR=/root/backups/ragil

DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=$(awk -F= '/^DB_HOST=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=${DB_HOST:-127.0.0.1}

SRC="${1:-$BACKUP_DIR/ragil_aluminium-latest.sql.gz}"
TARGET="${2:-ragil}"
[ -f "$SRC" ] || { echo "file tidak ada: $SRC"; exit 1; }

echo "restore $SRC -> DB $TARGET"
gunzip -c "$SRC" | \
  MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" "$TARGET"
echo "restore selesai: $TARGET"
