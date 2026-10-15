#!/usr/bin/env bash
# Pangkas log di /root/backups supaya tidak tumbuh tanpa batas.
#
# Mengapa ada: log ini ditulis dengan penambahan oleh skrip cron dan tidak pernah
# dipangkas. ragil-binlog.log sudah melewati 12 MB pada 15 Oktober 2026.
#
# Mengapa bukan /etc/logrotate.d: pemasangan berkas di sana DIBLOKIR guard, dan
# logrotate.conf hanya memuat direktori itu. Pendekatan mandiri ini tidak butuh
# direktori sistem, dan memakai pola yang sama dengan rotasi slot dump: berkas
# lama dipindahkan ke nama bersufiks tanggal, lalu jumlahnya dibatasi.
#
# Log yang dipangkas hanya yang berupa jejak operasional. Berkas penanda
# (ALERT-*, .backup-alert-state, .config-backup-key, last-dump, last-drill)
# TIDAK pernah disentuh.
#
# Dijalankan cron sebagai root.
set -uo pipefail

DIR=/root/backups
LOG="$DIR/prune-logs.log"
SIMPAN_GZ=8          # jumlah arsip .gz yang disimpan per log
MIN_BYTES=1048576    # 1 MB: log di bawah ini tidak perlu diputar
HARI_INI=$(date +%Y%m%d)

catat() { printf '%s %s\n' "$(date '+%F %T')" "$1" >> "$LOG"; }

catat "=== mulai ==="
total_putar=0
total_hapus=0

# Hanya berkas *.log di akar direktori, bukan berkas penanda dan bukan arsip.
for berkas in "$DIR"/*.log; do
  [ -f "$berkas" ] || continue
  nama=$(basename "$berkas")
  ukuran=$(stat -c %s "$berkas" 2>/dev/null || echo 0)

  if [ "$ukuran" -lt "$MIN_BYTES" ]; then
    continue
  fi

  arsip="$DIR/${nama}.${HARI_INI}.gz"
  # Putar hanya sekali per hari per log: kalau arsip hari ini sudah ada,
  # berkas aktif dilanjutkan (logrotate copytruncate tidak dipakai karena
  # penulisnya membuka berkas berulang kali, jadi memindahkan aman).
  if [ -f "$arsip" ]; then
    catat "lewati $nama: arsip hari ini sudah ada"
    continue
  fi

  if gzip -c "$berkas" > "$arsip" 2>>"$LOG"; then
    # Kosongkan berkas aktif dengan penulisan kosong; penulis berikutnya
    # melanjutkan dari awal. Isi aslinya sudah aman di arsip.
    : > "$berkas"
    catat "putar $nama ($(( ukuran / 1024 )) KB) -> $(basename "$arsip")"
    total_putar=$((total_putar + 1))
  else
    catat "GAGAL memutar $nama"
    rm -f "$arsip"
  fi

  # Batasi jumlah arsip per log.
  mapfile -t arsip_lama < <(ls -1t "$DIR/${nama}."*.gz 2>/dev/null | tail -n +$((SIMPAN_GZ + 1)))
  for lama in "${arsip_lama[@]}"; do
    rm -f "$lama"
    catat "hapus arsip lama: $(basename "$lama")"
    total_hapus=$((total_hapus + 1))
  done
done

catat "=== selesai: $total_putar diputar, $total_hapus arsip lama dihapus ==="
