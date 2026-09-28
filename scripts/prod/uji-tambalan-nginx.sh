#!/usr/bin/env bash
# Uji tambalan IP asli TANPA menyentuh /etc: salin konfigurasi ke temp,
# terapkan sisipan yang sama, lalu uji sintaks dengan nginx -t.
set -uo pipefail

TMP=/tmp/ujinginx
SRC=/etc/nginx/sites-enabled/ragil
MAIN=/etc/nginx/nginx.conf

rm -rf "$TMP"; mkdir -p "$TMP/sites-enabled"

echo "=== 1. SALIN KONFIGURASI KE TEMP ==="
cp "$SRC" "$TMP/sites-enabled/ragil"
HOSTIP=$(hostname -I | awk '{print $1}')
echo "IP host (peer tunnel): ${HOSTIP:-TIDAK TERBACA}"

echo "=== 2. TERAPKAN SISIPAN YANG SAMA ==="
HOSTIP="$HOSTIP" python3 - "$TMP/sites-enabled/ragil" <<'PY'
import os, sys
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
a1 = "    client_max_body_size 64M;\n"
a2 = "        fastcgi_param REMOTE_ADDR 127.0.0.1;\n"
src = src.replace(a1, a1 + blok, 1)
src = src.replace(a2, a2 + line_xff, 1)
open(path, "w").write(src)
print("  ok: kedua sisipan diterapkan ke salinan temp")
PY

echo "=== 3. PERBEDAAN DENGAN ASLI ==="
diff "$SRC" "$TMP/sites-enabled/ragil" || true

echo "=== 4. UJI SINTAKS DENGAN KONFIGURASI TEMP ==="
# fastcgi_params disalin ke temp: file situs memuatnya dengan jalur relatif,
# dan jalur itu diukur dari prefix konfigurasi (-c), bukan dari /etc/nginx.
cp /etc/nginx/fastcgi_params "$TMP/fastcgi_params"
cp /etc/nginx/mime.types "$TMP/mime.types" 2>/dev/null || true
python3 - "$MAIN" "$TMP/nginx.conf" <<'PY'
import sys
src = open(sys.argv[1]).read()
src = src.replace("include /etc/nginx/sites-enabled/*;", "include /tmp/ujinginx/sites-enabled/*;")
open(sys.argv[2], "w").write(src)
PY
nginx -t -c "$TMP/nginx.conf" 2>&1 | tail -4
