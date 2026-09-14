#!/usr/bin/env bash
# Pulihkan kepemilikan path yang ditulis bersama php-fpm.
#
# Sebab: agent/operator menjalankan `php artisan ...` atau `php artisan test`
# sebagai root. Artisan menulis ke storage/ dan bootstrap/cache/ (log harian,
# view terkompilasi, cache), sehingga file itu menjadi milik root dengan mode
# 644. php-fpm berjalan sebagai www-data: ia bisa membaca file itu, tetapi
# TIDAK bisa menambah atau menimpanya. Begitu Laravel perlu menulis (mis. log
# harian berikutnya), penulisan gagal, Laravel melempar exception, dan SELURUH
# situs mengembalikan 500. Insiden: 2026-09-15.
#
# Jalankan setelah setiap perintah artisan/test sebagai root.
# Idempoten dan aman diulang.
set -euo pipefail

APP_DIR="${1:-/root/ragilaluminium}"
cd "$APP_DIR"

# .gitignore di dalam folder ini mode-nya dilacak git; chmod di bawah akan
# mengubahnya dan mengotori `git status`. Laravel tidak menulis file ini.
SKIP_GITIGNORE=(-not -name '.gitignore')

chown -R www-data:www-data storage bootstrap/cache
find storage bootstrap/cache -type d -exec chmod 775 {} +
find storage bootstrap/cache -type f "${SKIP_GITIGNORE[@]}" -exec chmod 664 {} +

sisa="$(find storage bootstrap/cache -user root | wc -l)"
if [ "$sisa" -ne 0 ]; then
  echo "PERINGATAN: masih ada $sisa file milik root" >&2
  find storage bootstrap/cache -user root | head -10 >&2
  exit 1
fi

# Buktikan www-data benar-benar bisa MENULIS, bukan hanya membaca.
if ! su -s /bin/bash www-data -c "test -w storage/logs" 2>/dev/null; then
  echo "PERINGATAN: www-data tidak bisa menulis storage/logs" >&2
  exit 1
fi

echo "OK: storage/ dan bootstrap/cache/ dimiliki www-data dan dapat ditulis"
