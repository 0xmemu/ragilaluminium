# Deployment — Ragil Aluminium

Runbook untuk men-deploy aplikasi ke server produksi dari repo bersih. Target yang
terverifikasi: **Ubuntu 24.04** (dan kompatibel Debian 12+), Nginx + PHP-FPM + MySQL 8 + Redis,
ingress Cloudflare Tunnel.

> Prinsip: repo ini harus bisa di-clone ke server baru dan langsung jalan **tanpa debugging**.
> Semua langkah di bawah sudah diverifikasi pada `ra.333labs.tech` (server 209.23.10.62).

---

## 1. Prasyarat server

- OS: Ubuntu 24.04 / Debian 12+ (4 vCPU / 4–8 GB RAM disarankan)
- Akses root via SSH
- Domain + zona Cloudflare (untuk tunnel & HTTPS)

Install paket dasar:

```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring \
    php8.3-xml php8.3-curl php8.3-zip php8.3-gd php8.3-intl php8.3-bcmath \
    mysql-server redis-server git curl unzip
```

Verifikasi:

```bash
php -v            # PHP 8.3+
php -m | grep pdo_mysql
mysql --version   # MySQL 8.x
redis-cli ping    # PONG
```

> PHP extension `pdo_mysql` **wajib** — tanpa ini koneksi MySQL gagal.
> `php8.3-fpm` default memakai `clear_env = no` (sudah benar untuk Laravel; jangan diubah ke `yes`).

---

## 2. Clone repo & install dependencies

```bash
mkdir -p /var/www && cd /var/www
git clone <repo-url> ragilaluminium
cd ragilaluminium

composer install --no-dev --optimize-autoloader
npm ci && npm run build          # build Vite -> public/build
```

> Jika `composer`/`npm` belum ada: `apt-get install composer nodejs npm` atau pakai versi
> yang sesuai (Node 20+, Composer 2).

---

## 3. Konfigurasi environment

```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` (nilai minimal yang harus diset):

| Key | Nilai produksi |
|---|---|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | `https://ragilaluminium.com` (domain final) |
| `APP_KEY` | hasil `key:generate` |
| `DB_CONNECTION` | `mysql` |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` |
| `DB_DATABASE` / `DB_USERNAME` / `DB_PASSWORD` | sesuai MySQL |
| `CACHE_STORE` | `redis` |
| `SESSION_DRIVER` | `redis` |
| `QUEUE_CONNECTION` | `redis` |
| `REDIS_HOST` / `REDIS_PORT` | `127.0.0.1` / `6379` |
| `FORCE_HTTPS` | `true` |
| `TRUSTED_PROXIES` | `127.0.0.1,::1` (tunnel lokal) |
| `MEDIA_DISK` | `s3` (jika R2) + isi `AWS_*` / `CLOUDFLARE_R2_*` |
| `MEDIA_ALLOW_SOURCE_FALLBACK` | `false` (produksi) |
| `WHATSAPP_ALLOW_UNSIGNED_WEBHOOKS` | `false` |

> `AppServiceProvider` memaksa guard production: APP_DEBUG=false, APP_URL HTTPS,
> FORCE_HTTPS=true, SESSION_SECURE_COOKIE=true. Kalau app menolak boot, cek 4 hal ini dulu.

---

## 4. Database

```bash
mysql -uroot << 'EOF'
CREATE DATABASE IF NOT EXISTS ragil_aluminium CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'ragil'@'localhost' IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES ON ragil_aluminium.* TO 'ragil'@'localhost';
FLUSH PRIVILEGES;
EOF

php artisan migrate --force
```

**Migrasi data dari SQLite lama** (jika perlu): lihat `scripts/migrate-sqlite-to-mysql.php` —
jalankan dari repo dengan `.env` lama (sqlite) di belakang, script menyalin semua tabel
parent→child ke MySQL. Atau seeder + import manual.

---

## 5. Direktori & permission

```bash
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rw storage bootstrap/cache
chown root:www-data .env && chmod 640 .env   # www-data harus bisa BACA .env
# Jika repo di /root/... : beri traverse
chmod o+x /root /root/ragilaluminium 2>/dev/null || true
```

> `www-data` harus bisa menulis `storage/` dan `bootstrap/cache`. Kalau app 500 dengan
> "Permission denied" di log — ini penyebabnya.

---

## 6. Nginx

Salin `/etc/nginx/sites-available/ragil` (template di bawah) ke server, lalu:

```bash
ln -sf /etc/nginx/sites-available/ragil /etc/nginx/sites-enabled/ragil
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Template vhost (listen di port yang sama dengan tunnel origin, mis. 8200):

```nginx
server {
    listen 8200;
    listen [::]:8200;
    server_name ragilaluminium.com _;

    root /var/www/ragilaluminium/public;
    index index.php;

    charset utf-8;
    client_max_body_size 64M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1024;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location /storage/ {
        try_files $uri $uri/ =404;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /build/ {
        try_files $uri =404;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
        fastcgi_read_timeout 300;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

> **Jangan** pakai `php artisan serve` di produksi — itu dev server, single-process dan jauh
> lebih lambat. Nginx + PHP-FPM adalah syarat performa.

---

## 7. Redis, queue & cache

```bash
# Aktifkan Redis untuk cache/session/queue
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Worker queue (jalankan sebagai service systemd)
php artisan queue:work --queue=imports,media,default --tries=3
```

Contoh unit systemd `ragil-queue.service`:

```ini
[Unit]
Description=Ragil Aluminium queue worker
After=network-online.target mysql.service redis-server.service

[Service]
User=www-data
WorkingDirectory=/var/www/ragilaluminium
ExecStart=/usr/bin/php /var/www/ragilaluminium/artisan queue:work --queue=imports,media,default --tries=3 --timeout=1800 --max-time=3600
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now ragil-queue.service
```

> Setelah mengubah `.env` atau `config/*.php`: `php artisan config:clear && php artisan config:cache`
> (jangan lupa, config cache menyimpan nilai lama).


---

## 8a. Backup & Disaster Recovery

### Arsitektur backup (3 lapis)

1. **Lokal** — `/root/backups/ragil/`: dump `mysqldump` + gzip setiap hari
   (cron `17 3 * * *`), rotasi 7 hari, symlink `ragil_aluminium-latest.sql.gz`.
2. **Off-site R2 — bucket terpisah `ra-backup`**: setiap backup lokal otomatis
   di-upload (prefix `mysql/`), retensi 30 hari via **lifecycle rule Cloudflare**
   di bucket (bukan delete di script). Bucket backup **terisolasi** dari media —
   kalau kredensial media bocor, backup tetap aman.
3. **Media** — bucket `ra-media` (produk/gambar) terpisah dari backup, sudah di
   R2 sejak awal (bukan di VPS). Tidak ikut hilang saat VPS mati.

Script: `/root/scripts_backup_mysql.sh` (dump + upload), diikuti
`/root/scripts_r2_upload_backup.py` (SigV4 R2, stdlib Python, tanpa aws cli).

Cron root:
```
17 3 * * * /root/scripts_backup_mysql.sh >> /root/backups/ragil-backup.log 2>&1
```

Bucket: `ra-backup` (backup, lifecycle 30 hari) & `ra-media` (media).
Kredensial R2 di `.env` (CLOUDFLARE_R2_*), sama untuk kedua bucket.

### Uji restore (wajib berkala)

```bash
mysql -uroot -e 'CREATE DATABASE ragil_restore_test;'
zcat /root/backups/ragil/ragil_aluminium-latest.sql.gz | mysql -uroot ragil_restore_test
# bandingkan TABLE_ROWS per tabel (information_schema) antara ragil_aluminium dan ragil_restore_test
mysql -uroot -e 'DROP DATABASE ragil_restore_test;'
```

Catatan: jangan menjalankan restore bersamaan dengan backup (bisa baca dump
yang sedang ditulis). Verifikasi row count per tabel harus identik semua.

### Recovery — VPS mati total / error

Media (R2) tidak hilang — tinggal arahkan app ke bucket yang sama.
Data MySQL diambil dari backup R2 (`ra-backup`):

```bash
# 1. Siapkan VPS baru (ikuti runbook dari awal: Nginx, PHP-FPM, MySQL, Redis)
# 2. Buat DB + user, lalu restore dari backup off-site:
mysql -uragil -p<pass> -e 'CREATE DATABASE ragil_aluminium CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
# download backup dari R2 (dashboard R2 / aws cli / script SigV4 GET)
zcat ragil_aluminium-YYYYMMDD-HHMMSS.sql.gz | mysql -uragil -p<pass> ragil_aluminium
# 3. Verifikasi count: SELECT COUNT(*) FROM products; -- harus 50+
# 4. Jalankan migrate hanya untuk migration yang BELUM ada (backup sudah berisi tabel)
php artisan migrate --force
# 5. config:cache, route:cache, view:cache; start queue worker + tunnel
```

Data performa toko (KPI) dihitung langsung dari tabel `orders`, `customers`,
`products` oleh `StorePerformanceService` — ikut ter-restore bersama dump.
`performance_metrics` hanya agregat view/click produk, tidak pernah menjadi
sumber tunggal.

---

## 8. Ingress Cloudflare

Dua opsi:

**A. Cloudflare Tunnel (disarankan, tidak buka port publik):**

```bash
# Install cloudflared, daftarkan tunnel, simpan token
docker run -d --name ragil-cloudflared --restart unless-stopped \
  -v /etc/cloudflared/ragil-preview-token:/etc/cloudflared/token:ro \
  cloudflare/cloudflared:latest tunnel --no-autoupdate run --token-file /etc/cloudflared/token
```

Di dashboard Cloudflare: tambahkan public hostname `ragilaluminium.com` → service
`http://localhost:8200` (port sesuai vhost). DNS record otomatis.

**B. DNS proxy langsung:** A record proxied ke IP server + Nginx listen 80/443 dengan
sertifikat (Cloudflare Origin CA atau Let's Encrypt). Wajib `TRUSTED_PROXIES` berisi IP
Cloudflare + `FORCE_HTTPS=true`.

### Cache Rules Cloudflare (dashboard)

- `http.host eq "ragilaluminium.com" and starts_with(http.request.uri.path, "/build/")` → Cache Everything, TTL 30 hari
- Sama untuk `/storage/`
- Jangan cache `/admin/*`, `/checkout*`, `/cart*`, `/api/*`, `/webhook/*` (Inertia dinamis)

---

## 9. Smoke test

```bash
# Origin lokal
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8200/          # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8200/products   # 200

# Via Cloudflare
curl -s -o /dev/null -w '%{http_code}\n' https://ragilaluminium.com/      # 200

# DB
mysql -uragil -p<pass> ragil_aluminium -e 'SELECT COUNT(*) FROM products;'

# Cache & queue
php artisan about
redis-cli dbsize
```

---

## 10. Rollback

- **App**: git checkout commit sebelumnya + `php artisan migrate:rollback --step=1` (hati-hati data)
- **DB**: restore dari backup MySQL (`mysqldump`) atau balik `.env` ke SQLite
  (backup `.env` disimpan: `.env.bak-sqlite-*`)
- **DNS**: kembalikan record di Cloudflare / matikan tunnel

---

## Catatan penting (dipelajari dari operasional nyata)

1. **Jangan pernah** menaruh `cloudflare.env` / `.env` di git — sudah di `.gitignore`.
2. `php artisan serve` **bukan** untuk produksi.
3. FPM `clear_env` harus `no` — kalau tidak, `APP_ENV` terbaca NULL → Laravel fallback ke
   `production` + guard error.
4. Storage & bootstrap/cache harus milik `www-data` — kalau 500 "Permission denied", ini dia.
5. `.env` harus **terbaca** www-data (`chown root:www-data .env; chmod 640 .env`) — kalau 500
   "APP_URL wajib HTTPS" saat config cache bersih, ini penyebabnya (www-data tak bisa baca .env → fallback production).
6. Ganti `APP_URL` → pastikan `config:cache` ikut diperbarui.
7. Server produksi sebaiknya di **Indonesia/Singapura** (RTT ~10–50ms). Server di US membuat
   TTFB dinamis 0.5–1.0s meski render origin sudah 60–160ms.
8. WhatsApp: engine (Baileys/BAILEYS) dipanggil internal (`WHATSAPP_ENGINE_URL=http://localhost:PORT`),
   jangan dipublikasikan. Webhook masuk lewat `https://domain/webhook/whatsapp/baileys`.

---

## 11. Cloudflare & CDN — status

### Sudah aktif (ra.333labs.tech)

| Item | Detail |
|---|---|
| Tunnel | Container docker  (token ) — jangan start systemd  (token beda, bisa tabrakan) |
| Cache Rules |  &  → Cache Everything (HIT di edge, tidak menyentuh origin) |
| Rate Limit | POST  &  → 10 req/10s/IP, block 10 detik (batas plan free: period & timeout hanya boleh 10) |
| Trusted proxies |  (tunnel lokal) — sudah benar, jangan tambah IP Cloudflare |

### Terblokir / menunggu cutover ke ragilaluminium.com

| Item | Kenapa terblokir | Yang dibutuhkan |
|---|---|---|
| R2 custom domain () | Token CF sekarang **tidak punya akses zona ragilaluminium.com** (hanya 333labs.tech, natauma.me, oddityspace.studio) | Token dengan akses zona final + setup custom domain di R2 |
| Subdomain final (apex, www→redirect, admin, cdn, wa) | Menunggu keputusan domain & cutover | Rancangan DNS sudah ada; terapkan saat cutover |
| Image pipeline Worker (resize/WebP) | Layak hanya setelah custom domain CDN aktif | Worker di edge CF untuk R2 |
| Rate limit lebih ketat (period >10s) | Batas plan free | Upgrade plan (Pro) atau terima batas 10s |
| WAF khusus /admin | Token tidak punya izin rulesets | Token dengan scope Zone → WAF/Cache Rules, atau manual di dashboard |

Catatan:  (nginx → R2) sudah siap sebagai fallback kalau r2.dev diblokir, tapi
 sengaja **tidak diaktifkan** — merutekan semua gambar lewat origin Dallas
justru memperlambat. Biarkan delivery utama lewat r2.dev (CDN edge).
