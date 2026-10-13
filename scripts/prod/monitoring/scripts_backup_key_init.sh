#!/usr/bin/env bash
# Membuat kunci enkripsi cadangan sekali, lalu mengirimkannya ke Telegram pemilik
# sebagai simpanan bila server ini hilang (owner 2026-09-28 "proses").
#
# Mengapa dikirim ke Telegram: kunci HARUS bisa diambil kembali walau server mati
# total, karena tanpa kunci salinan terenkripsi di R2 tidak bisa dibuka. Telegram
# sudah dipakai sistem ini untuk notifikasi, dan pesan itu milik akun pemilik.
set -euo pipefail

KEY=/root/backups/.backup-key
LOG=/root/backups/backup-key.log

if [ -s "$KEY" ]; then
  echo "$(date '+%F %T') kunci sudah ada, tidak diubah" >> "$LOG"
  echo "kunci sudah ada (tidak diubah): $KEY"
  exit 0
fi

umask 077
head -c 48 /dev/urandom | base64 | tr -d '\n' > "$KEY"
chmod 400 "$KEY"

MSG="🔑 KUNCI ENKRIPSI CADANGAN\n\nCadangan off-site kini terenkripsi. TANPA kunci ini, cadangan TIDAK BISA dibuka.\n\nSimpan di pengelola kata sandi Anda, lalu pesan ini boleh dihapus.\n\n$(cat "$KEY")"

if /root/scripts_tg_alert.sh "$(printf '%b' "$MSG")" >> "$LOG" 2>&1; then
  echo "$(date '+%F %T') kunci dibuat dan dikirim ke Telegram" >> "$LOG"
  echo "kunci dibuat: $KEY (sudah dikirim ke Telegram)"
else
  echo "$(date '+%F %T') kunci dibuat tetapi gagal dikirim ke Telegram" >> "$LOG"
  echo "kunci dibuat: $KEY — PERINGATAN: gagal kirim ke Telegram, salin manual!"
fi
