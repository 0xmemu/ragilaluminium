#!/usr/bin/env bash
# Build aset frontend secara aman untuk situs yang sedang melayani pengunjung.
#
# Masalah yang dicegah: perintah vite build menulis langsung ke public/build dan
# mengosongkan folder itu lebih dulu. Selama jendela build berjalan, berkas
# public/build/manifest.json (daftar nama berkas hasil build yang dipakai Laravel
# untuk memanggil CSS dan JS) tidak ada, sehingga setiap halaman dijawab HTTP 500.
#
# Cara kerja: build ditulis ke salah satu dari dua slot di dalam public/, jadi
# masih satu filesystem dengan public/build dan pemindahannya hanya operasi
# rename, bukan salin. public/build diganti hanya setelah manifest hasil build
# terverifikasi, sehingga tidak pernah ada jendela waktu tanpa manifest. Dua slot
# dipakai bergantian supaya tidak diperlukan perintah hapus: slot yang menyimpan
# build lama menjadi tujuan build berikutnya, dan Vite mengosongkannya sendiri.
#
# Kedua slot harus diabaikan git, lihat /public/build-slot-* di .gitignore.
#
# Pakai: bash scripts/prod/build-assets.sh
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO"

if [ ! -d node_modules ]; then
  echo "build-assets: node_modules tidak ditemukan, jalankan npm ci dulu." >&2
  exit 1
fi

# Jaring pengaman: kalau proses mati tepat di antara dua perpindahan, pasang
# kembali build yang masih utuh supaya situs tidak ditinggalkan tanpa public/build.
restore_previous() {
  if [ -e public/build ]; then
    return 0
  fi
  if [ -e public/build-slot-a ]; then
    mv public/build-slot-a public/build
  elif [ -e public/build-slot-b ]; then
    mv public/build-slot-b public/build
  fi
  if [ -e public/build ]; then
    echo "build-assets: swap tidak selesai, public/build dipulihkan dari slot." >&2
  fi
}
trap restore_previous EXIT

# Dua slot tidak boleh terisi bersamaan, kalau itu terjadi ada sisa run yang gagal
# dan tujuan parkir tidak jelas. Lebih baik berhenti daripada menimpa salah satu.
if [ -e public/build-slot-a ] && [ -e public/build-slot-b ]; then
  echo "build-assets: public/build-slot-a dan public/build-slot-b sama-sama ada, build dibatalkan." >&2
  exit 1
fi

if [ -e public/build-slot-a ]; then
  # Slot a menyimpan build lama. Vite mengosongkannya, jadi slot a jadi tujuan
  # build, dan slot b yang sudah kosong jadi tempat parkir build lama.
  echo "build-assets: build ke public/build-slot-a (situs tetap melayani public/build lama)..."
  npm run build -- --outDir public/build-slot-a --emptyOutDir
  if [ ! -f public/build-slot-a/manifest.json ]; then
    echo "build-assets: manifest.json tidak dihasilkan. public/build tidak disentuh." >&2
    exit 1
  fi
  mv public/build public/build-slot-b
  mv public/build-slot-a public/build
else
  # Kebalikannya: slot b menyimpan build lama, slot a jadi tempat parkir.
  echo "build-assets: build ke public/build-slot-b (situs tetap melayani public/build lama)..."
  npm run build -- --outDir public/build-slot-b --emptyOutDir
  if [ ! -f public/build-slot-b/manifest.json ]; then
    echo "build-assets: manifest.json tidak dihasilkan. public/build tidak disentuh." >&2
    exit 1
  fi
  mv public/build public/build-slot-a
  mv public/build-slot-b public/build
fi

trap - EXIT

echo "build-assets: selesai. public/build sudah memakai hasil build baru."
