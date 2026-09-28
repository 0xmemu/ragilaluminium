#!/usr/bin/env bash
# SYNC DARURAT: 209 -> 49
# Mengamankan seluruh commit (termasuk untracked file penting) dari 209 ke 49.
# Non-intrusif: TIDAK menyentuh working tree agent yang sedang bekerja di 209.
# Dipanggil oleh cron di 209 tiap 10 menit.
set -euo pipefail

REPO=/root/ragilaluminium
REMOTE=ubuntu@49.51.136.145
DEST=/home/ubuntu/ragil-sync
BUNDLE=/tmp/ragil-dev-sync.bundle
LOG=/root/backups/sync-49.log
KEEP_BUNDLES=3

cd "$REPO"

# 1. Buat bundle inkremental (aman dibaca berkali-kali oleh 49)
git bundle create "$BUNDLE" --all 2>/dev/null

# 2. Transfer ke 49
ssh -o StrictHostKeyChecking=no -o BatchMode=yes "$REMOTE" "mkdir -p $DEST"
rsync -a --timeout=60 -e "ssh -o StrictHostKeyChecking=no -o BatchMode=yes" "$BUNDLE" "$REMOTE:$DEST/ragil-dev-latest.bundle"

# 3. 49 menarik commit dari bundle ke remote-tracking 209backup/* (tidak mengubah working tree mereka)
ssh -o StrictHostKeyChecking=no -o BatchMode=yes "$REMOTE" "cd ~/ragilaluminium && git fetch sync-bundle 'refs/heads/*:refs/remotes/209backup/*' --prune >/dev/null 2>&1 || true"

# 4. Rotasi bundle lama di 49
ssh -o StrictHostKeyChecking=no -o BatchMode=yes "$REMOTE" "cd $DEST && ls -t ragil-dev-sync-*.bundle 2>/dev/null | tail -n +$((KEEP_BUNDLES+1)) | xargs -r rm -f"

echo "[$(date '+%F %T')] OK $(git rev-parse --short HEAD) -> 49" >> "$LOG"
