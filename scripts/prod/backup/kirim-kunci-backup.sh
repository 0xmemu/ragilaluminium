#!/usr/bin/env bash
# Kirim SALINAN kunci enkripsi backup konfigurasi ke Telegram, SEKALI saja.
#
# Mengapa ada: kunci disimpan di server supaya backup berjalan tanpa campur tangan
# manusia. Tetapi kalau server hilang, arsip di R2 tidak bisa dibuka. Karena itu
# satu salinan kunci dikirim ke Telegram sebagai jalur pemulihan darurat, lalu
# sistem berjalan sendiri tanpa perlu diurus lagi.
#
# Sifat: hanya berjalan sekali. Setelah terkirim, penanda dibuat dan skrip ini
# menolak mengirim ulang, supaya kunci tidak berulang kali tersebar.
#
# Menghapus penanda berikut ini akan membuat kunci terkirim lagi:
#   /root/backups/.config-key-terkirim
#
# Kunci tidak pernah dicetak ke layar maupun ke log.
set -uo pipefail

KEY=/root/backups/.config-backup-key
MARKER=/root/backups/.config-key-terkirim
TG=/root/scripts_tg_alert.sh
LOG=/root/backups/config-backup.log

catat() { printf '%s %s\n' "$(date '+%F %T')" "$1" >> "$LOG"; }

if [ -f "$MARKER" ]; then
  echo "Kunci sudah pernah dikirim ($(cat "$MARKER")). Tidak dikirim ulang."
  echo "Hapus $MARKER kalau memang ingin mengirim ulang."
  exit 0
fi

[ -s "$KEY" ] || { echo "GAGAL: kunci belum ada di $KEY. Jalankan config-backup.sh dulu." >&2; exit 1; }
[ -x "$TG" ] || { echo "GAGAL: pengirim alarm tidak ada: $TG" >&2; exit 1; }

KUNCI=$(cat "$KEY")

PESAN="KUNCI BACKUP KONFIGURASI PRODUKSI 202

Simpan pesan ini. Kunci ini membuka arsip konfigurasi terenkripsi di bucket
ra-backup-prod pada awalan config/.

Kunci:
${KUNCI}

Cara membuka (di server mana pun yang punya openssl dan arsipnya):
1. simpan kunci di atas ke berkas, misal kunci.txt
2. jalankan:
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:kunci.txt \\
     -in config-202-XXXX.tar.gz.enc | tar -xzf - -C /tujuan

Catatan: kunci ini hanya untuk arsip konfigurasi. Kredensial layanan di dalamnya
tetap yang berlaku saat arsip dibuat, jadi simpan pesan ini di tempat aman dan
jangan diteruskan ke orang lain."

if bash "$TG" "$PESAN" >> "$LOG" 2>&1; then
  date +%FT%T > "$MARKER"
  chmod 600 "$MARKER"
  catat "kunci dikirim ke Telegram SEKALI, penanda dibuat"
  echo "TERKIRIM. Kunci sudah ada di Telegram dan tidak akan dikirim ulang."
else
  catat "GAGAL mengirim kunci ke Telegram, penanda TIDAK dibuat (bisa dicoba lagi)"
  echo "GAGAL mengirim. Coba lagi nanti." >&2
  exit 1
fi
