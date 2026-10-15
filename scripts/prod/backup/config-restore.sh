#!/usr/bin/env bash
# Pulihkan konfigurasi dari arsip backup terenkripsi.
#
# SECARA BAWAAN TIDAK MENIMPA konfigurasi aktif: arsip dibuka ke direktori
# terpisah supaya bisa diperiksa dulu. Pemulihan sungguhan dilakukan dengan
# menyalin dari direktori itu secara sadar.
#
# Pakai:
#   config-restore.sh                          # pakai arsip lokal terbaru
#   config-restore.sh --file=<arsip.tar.gz.enc>
#   config-restore.sh --key=<berkas-kunci>     # kalau kunci dari salinan Telegram
#   config-restore.sh --tujuan=/root/pulih     # direktori tujuan (default)
#
# Dipakai pada lingkungan terisolasi: tar hanya membuka ke direktori tujuan,
# tidak ada berkas sistem yang tersentuh.
set -uo pipefail

KEY_DEFAULT=/root/backups/.config-backup-key
TUJUAN=/root/pulih-konfigurasi
ARSIP=""
KEY="$KEY_DEFAULT"

for a in "$@"; do
  case "$a" in
    --file=*)   ARSIP="${a#--file=}" ;;
    --key=*)    KEY="${a#--key=}" ;;
    --tujuan=*) TUJUAN="${a#--tujuan=}" ;;
    -h|--help)  sed -n '2,18p' "$0"; exit 0 ;;
  esac
done

if [ -z "$ARSIP" ]; then
  ARSIP=$(ls -1t /root/backups/config-202-*.tar.gz.enc 2>/dev/null | head -1)
fi
[ -n "$ARSIP" ] || { echo "GAGAL: arsip tidak ditemukan. Pakai --file=..." >&2; exit 1; }
[ -f "$ARSIP" ] || { echo "GAGAL: arsip tidak ada: $ARSIP" >&2; exit 1; }
[ -s "$KEY" ] || { echo "GAGAL: kunci tidak ada: $KEY" >&2; exit 1; }

echo "arsip : $ARSIP"
echo "kunci : $KEY"
echo "tujuan: $TUJUAN"

# Periksa sidik jari kalau berkasnya ada, supaya arsip yang rusak tertangkap
# sebelum dibuka. Berkas .sha256 memuat nama dasar arsip, jadi pemeriksaan
# dijalankan dari direktori arsip itu sendiri.
SHAFILE="${ARSIP}.sha256"
if [ -f "$SHAFILE" ]; then
  ARSIP_DIR=$(cd "$(dirname "$ARSIP")" && pwd)
  if ( cd "$ARSIP_DIR" && sha256sum -c "$(basename "$SHAFILE")" >/dev/null 2>&1 ); then
    echo "sidik jari: COCOK"
  else
    echo "GAGAL: sidik jari tidak cocok, arsip rusak atau berubah" >&2
    exit 1
  fi
fi

mkdir -p "$TUJUAN"
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
      -pass file:"$KEY" -in "$ARSIP" | tar -xzf - -C "$TUJUAN"; then
  echo "GAGAL: dekripsi atau ekstraksi" >&2
  exit 1
fi

echo
echo "=== isi yang dipulihkan (akar: $TUJUAN) ==="
find "$TUJUAN" -type f | sed "s#^$TUJUAN/##" | sort
echo
echo "Konfigurasi aktif TIDAK diubah. Untuk menerapkan, salin berkas yang perlu"
echo "dari $TUJUAN ke lokasinya masing-masing secara sadar."
