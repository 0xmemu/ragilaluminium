#!/usr/bin/env bash
# ============================================================================
# Terapkan pembacaan IP ASLI pengunjung di nginx.
# Dibuat 2026-09-28 atas permintaan owner, dijalankan manual sebagai root.
#
# MASALAH YANG DIPERBAIKI
#   Seluruh trafik masuk lewat tunnel cloudflared yang berjalan di host ini.
#   Tanpa patch ini nginx melihat SEMUA pengunjung sebagai satu IP, dan
#   aplikasi menerima REMOTE_ADDR 127.0.0.1 untuk setiap permintaan. Akibatnya:
#     1. limit_req 20 permintaan/detik dan limit_conn 30 berlaku GLOBAL untuk
#        seluruh pengunjung, bukan per pengunjung. Lonjakan trafik wajar pun
#        bisa membuat pelanggan menerima 503.
#     2. Pembatas di Laravel (throttle) juga global, karena semua permintaan
#        tampak berasal dari 127.0.0.1.
#     3. Log akses tidak menunjukkan IP asli, sehingga analisa trafik hanya
#        perkiraan.
#
# YANG DILAKUKAN
#   1. Percayai HANYA peer tunnel (plus loopback), lalu baca CF-Connecting-IP.
#      Port 8200 tidak terbuka ke publik (firewall hanya 22 dan 443), jadi
#      header itu tidak bisa dipalsukan dari luar.
#   2. Teruskan IP asli ke aplikasi lewat X-Forwarded-For, diambil dari
#      $remote_addr hasil real_ip dan BUKAN dari header kiriman klien.
#      REMOTE_ADDR sengaja tetap 127.0.0.1 karena Laravel mempercayai alamat
#      itu sebagai proxy (TRUSTED_PROXIES), sehingga IP asli dibaca dari header.
#
# AMAN
#   Bila CF-Connecting-IP tidak ada, $remote_addr kembali ke IP peer alias
#   perilaku sekarang: tidak ada yang rusak. Skrip ini juga menyimpan cadangan,
#   menguji konfigurasi (nginx -t), dan mengembalikan cadangan bila uji gagal.
#   Idempoten: dijalankan dua kali tidak mengubah apa pun.
#
# CARA PAKAI (root, di server, satu kali)
#   bash /root/ragilaluminium/scripts/prod/nginx-real-ip.sh
#
# CARA MEMBUKTIKAN BERHASIL
#   Buka situs dari HP atau perangkat lain, lalu lihat log akses:
#     tail -5 /var/log/nginx/access.log
#   IP pada kolom pertama harus IP publik perangkat itu, bukan IP server.
# ============================================================================
set -euo pipefail

SITE=/etc/nginx/sites-enabled/ragil
BAK_DIR=/root/backups
TS=$(date +%Y%m%d-%H%M%S)
BAK="$BAK_DIR/nginx-ragil-$TS.conf"

[ "$(id -u)" = "0" ] || { echo "ERROR: jalankan sebagai root."; exit 1; }
[ -f "$SITE" ] || { echo "ERROR: $SITE tidak ditemukan."; exit 1; }

if grep -q 'real_ip_header CF-Connecting-IP' "$SITE"; then
  echo "Sudah diterapkan sebelumnya. Tidak ada perubahan."
  exit 0
fi

# IP host dipakai sebagai peer tunnel yang dipercaya.
HOSTIP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -n "${HOSTIP:-}" ] || { echo "ERROR: IP host tidak terbaca, batalkan."; exit 1; }

mkdir -p "$BAK_DIR"
cp "$SITE" "$BAK"
echo "Cadangan dibuat: $BAK"

HOSTIP="$HOSTIP" python3 - "$SITE" <<'PY'
import os
import sys

path = sys.argv[1]
hostip = os.environ["HOSTIP"]
src = open(path).read()

blok = (
    "\n"
    "    # IP asli pengunjung (2026-09-28). Trafik masuk lewat tunnel cloudflared\n"
    "    # di host ini, jadi tanpa ini SEMUA pengunjung terlihat sebagai satu IP\n"
    "    # dan pembatas di bawah menjadi batas bersama seluruh situs.\n"
    "    # Hanya peer tunnel yang dipercaya; port 8200 tidak terbuka ke publik\n"
    "    # (firewall hanya 22 dan 443), sehingga header tidak bisa dipalsukan.\n"
    f"    set_real_ip_from {hostip};\n"
    "    set_real_ip_from 127.0.0.1;\n"
    "    set_real_ip_from ::1;\n"
    "    real_ip_header CF-Connecting-IP;\n"
    "    real_ip_recursive on;\n"
)

line_xff = (
    "        # IP asli diteruskan ke aplikasi lewat header ini. Nilainya dari\n"
    "        # $remote_addr hasil real_ip di atas, BUKAN header kiriman klien,\n"
    "        # sehingga tidak bisa dipalsukan. REMOTE_ADDR tetap 127.0.0.1 karena\n"
    "        # Laravel mempercayai alamat itu sebagai proxy.\n"
    "        fastcgi_param HTTP_X_FORWARDED_FOR $remote_addr;\n"
)

anchor_realip = "    client_max_body_size 64M;\n"
anchor_xff = "        fastcgi_param REMOTE_ADDR 127.0.0.1;\n"

if "real_ip_header CF-Connecting-IP" in src:
    print("  skip: blok real_ip sudah ada")
elif anchor_realip in src:
    src = src.replace(anchor_realip, anchor_realip + blok, 1)
    print("  ok: blok real_ip disisipkan")
else:
    print("  ERROR: jangkar client_max_body_size tidak ditemukan", file=sys.stderr)
    sys.exit(1)

if "HTTP_X_FORWARDED_FOR $remote_addr" in src:
    print("  skip: penerusan IP ke aplikasi sudah ada")
elif anchor_xff in src:
    src = src.replace(anchor_xff, anchor_xff + line_xff, 1)
    print("  ok: penerusan IP ke aplikasi disisipkan")
else:
    print("  ERROR: jangkar fastcgi_param REMOTE_ADDR tidak ditemukan", file=sys.stderr)
    sys.exit(1)

open(path, "w").write(src)
PY

echo "Menguji konfigurasi..."
if ! nginx -t; then
  echo "UJI GAGAL — mengembalikan konfigurasi semula."
  cp "$BAK" "$SITE"
  exit 1
fi

systemctl reload nginx
echo "Selesai. nginx dimuat ulang tanpa memutus koneksi."
echo "Bandingkan dengan cadangan bila perlu: diff $BAK $SITE"
