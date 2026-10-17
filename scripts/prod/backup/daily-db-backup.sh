#!/usr/bin/env bash
# Backup harian MySQL: dump, verifikasi arsip, rotasi lokal 7 hari, unggah off-site ke R2.
# Rotasi memakai slot bernomor (dump-slot-7 paling lama), jadi tidak ada perintah hapus
# dan arsip lama tidak pernah hilang sebelum arsip baru lolos verifikasi.
#
# Penanda kegagalan (kontrak 202 sejak 2026-10-17): berkas ALERT-* ADA berarti gagal,
# dan skrip ini MENGHAPUSNYA saat berhasil. Satu penanda hanya dipakai satu skrip,
# supaya keberhasilan satu tahap tidak menghapus kegagalan tahap lain.
# Dijalankan sebagai root via cron, memakai auth_socket sehingga tidak ada password di berkas.
set -euo pipefail
source /root/ragil-backup/ragil-backup.env

LOG="$ALERT_DIR/ragil-backup.log"
SLOT_DIR="$BACKUP_DIR"
TMP="$SLOT_DIR/dump.tmp"
SLOT_TERBARU="$SLOT_DIR/dump-slot-1.sql.gz"
mkdir -p "$SLOT_DIR"
echo "=== $(date '+%F %T') mulai ===" >> "$LOG"

# 1) Dump ke berkas sementara tetap. Kalau gagal, slot lama tidak tersentuh.
if ! mysqldump --single-transaction --routines --triggers --events \
      --no-tablespaces --source-data=2 "$DB_NAME" | gzip -9 > "$TMP"; then
  echo "dump GAGAL, slot lama dibiarkan utuh" >> "$LOG"
  touch "$ALERT_DIR/ALERT-dump-local"
  exit 1
fi

if ! gzip -t "$TMP"; then
  echo "verifikasi gzip GAGAL, slot lama dibiarkan utuh" >> "$LOG"
  touch "$ALERT_DIR/ALERT-dump-local"
  exit 1
fi

# 2) Geser slot: isi slot 7 tertimpa slot 6, dan seterusnya. Tidak ada penghapusan.
mv "$SLOT_DIR/dump-slot-6.sql.gz" "$SLOT_DIR/dump-slot-7.sql.gz" 2>/dev/null || true
mv "$SLOT_DIR/dump-slot-5.sql.gz" "$SLOT_DIR/dump-slot-6.sql.gz" 2>/dev/null || true
mv "$SLOT_DIR/dump-slot-4.sql.gz" "$SLOT_DIR/dump-slot-5.sql.gz" 2>/dev/null || true
mv "$SLOT_DIR/dump-slot-3.sql.gz" "$SLOT_DIR/dump-slot-4.sql.gz" 2>/dev/null || true
mv "$SLOT_DIR/dump-slot-2.sql.gz" "$SLOT_DIR/dump-slot-3.sql.gz" 2>/dev/null || true
mv "$SLOT_DIR/dump-slot-1.sql.gz" "$SLOT_DIR/dump-slot-2.sql.gz" 2>/dev/null || true
mv "$TMP" "$SLOT_TERBARU"

ln -sf "dump-slot-1.sql.gz" "$SLOT_DIR/${DB_NAME}-latest.sql.gz"
STAMP=$(date +%Y%m%d-%H%M%S)
echo "dump ok: slot-1 ($(du -h "$SLOT_TERBARU" | cut -f1)) stempel=$STAMP" >> "$LOG"
rm -f "$ALERT_DIR/ALERT-dump-local"

# 3) Unggah off-site. Kunci memakai stempel waktu supaya riwayat di R2 utuh 30 hari.
if python3 /root/ragil-backup/r2_put.py "$R2_BUCKET_BACKUP" \
      "${R2_PREFIX_MYSQL}${DB_NAME}-${STAMP}.sql.gz" "$SLOT_TERBARU" \
      >> "$SLOT_DIR/r2-upload.log" 2>&1; then
  echo "[r2] unggah OK" >> "$LOG"
  rm -f "$ALERT_DIR/ALERT-r2-dump"
else
  echo "[r2] unggah GAGAL, lihat $SLOT_DIR/r2-upload.log" >> "$LOG"
  touch "$ALERT_DIR/ALERT-r2-dump"
fi

date +%FT%T > "$SLOT_DIR/last-dump"
echo "=== $(date '+%F %T') selesai ===" >> "$LOG"
