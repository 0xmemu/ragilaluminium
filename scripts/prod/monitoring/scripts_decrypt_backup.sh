#!/usr/bin/env bash
# Membuka salinan cadangan terenkripsi dari R2 (owner 2026-09-28).
# Pakai: scripts_decrypt_backup.sh <berkas.enc> <keluaran.sql.gz>
set -euo pipefail

KEY=/root/backups/.backup-key
IN="${1:?berkas .enc wajib disebut}"
OUT="${2:?berkas keluaran wajib disebut}"

[ -f "$KEY" ] || {
  echo "ERROR: kunci $KEY tidak ada. Tanpa kunci ini salinan tidak bisa dibuka." >&2
  exit 1
}

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$KEY" -in "$IN" -out "$OUT"
gzip -t "$OUT"
echo "OK: $OUT (isi gzip sah)"
