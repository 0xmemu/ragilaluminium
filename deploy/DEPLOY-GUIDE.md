# Panduan Lengkap Deploy Production: Ragil Aluminium (Ubuntu 24.04 LTS)

Panduan ini dirancang agar proses deployment dari nol ke VPS baru berjalan dalam **sekali jalan** (estimasi 15-25 menit).

---

## TAHAP 1: Rebuild OS di Panel Cloud Provider
1. Buka dashboard hosting VPS Anda (DigitalOcean, Contabo, Linode, dll.).
2. Pilih instance VPS `202.74.74.87` (atau VPS baru).
3. Klik **Reinstall / Rebuild OS**.
4. Pilih **Ubuntu 24.04 LTS 64-bit**.
5. Masukkan SSH Key Anda (atau catat password root baru dari email provider).
6. Tunggu proses rebuild selesai (sekitar 2-3 menit).

---

## TAHAP 2: Jalankan Skrip Provisioning Otomatis
1. Login SSH ke VPS yang baru di-rebuild:
   ```bash
   ssh root@<IP_VPS>
   ```
2. Download dan jalankan skrip provisioning:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/.../setup-vps-prod.sh -o setup.sh || nano setup.sh
   chmod +x setup.sh
   ./setup.sh
   ```
   *Skrip ini otomatis memasang Nginx, PHP 8.3, MySQL 8.0, Redis, Node.js 20, Composer, dan menyetel UFW Firewall.*

---

## TAHAP 3: Pasang Kode Aplikasi & Database
1. Clone repo aplikasi ke `/root/ragilaluminium`:
   ```bash
   git clone <REPO_URL> /root/ragilaluminium
   cd /root/ragilaluminium
   ```
2. Restore database master (berisi 108 produk resmi & master alamat J&T):
   ```bash
   zcat ragil_prod_master.sql.gz | mysql -u ragil_app -p'RagilProd2026Secure!' ragil_aluminium
   ```
3. Pasang `.env` produksi (domain `ragilaluminium.com`, DB, R2, dan J&T).
4. Install dependensi & build frontend:
   ```bash
   composer install --no-dev --optimize-autoloader
   php artisan migrate --force
   npm ci
   npm run build
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```
5. Setel kepemilikan folder storage:
   ```bash
   chown -R www-data:www-data storage bootstrap/cache
   chmod -R 775 storage bootstrap/cache
   ```

---

## TAHAP 4: Pasang Nginx & Systemd Services
1. Pasang konfigurasi Nginx:
   ```bash
   cp deploy/nginx/ragilaluminium.com.conf /etc/nginx/sites-available/ragilaluminium.com
   ln -s /etc/nginx/sites-available/ragilaluminium.com /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   ```
2. Pasang background services (Queue Worker & WebSocket Reverb):
   ```bash
   cp deploy/systemd/*.service /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now ragil-queue.service
   systemctl enable --now laravel-reverb.service
   ```
3. Pasang cron Laravel:
   ```bash
   (crontab -l 2>/dev/null; echo "* * * * * cd /root/ragilaluminium && php artisan schedule:run >> /dev/null 2>&1") | crontab -
   ```

---

## TAHAP 5: Cutover DNS di Cloudflare
1. Buka dashboard Cloudflare ➔ Domain **`ragilaluminium.com`** ➔ menu **DNS Records**.
2. Perbarui / buat record berikut:
   * **`A`** `ragilaluminium.com` ➔ `<IP_VPS_BARU>` (Proxy: ON / Awan Oranye)
   * **`A`** `www` ➔ `<IP_VPS_BARU>` (Proxy: ON / Awan Oranye)
   * **`A`** `api` ➔ `<IP_VPS_BARU>` (Proxy: ON / Awan Oranye)
3. Website dan Webhook J&T Cargo (`api.ragilaluminium.com`) langsung aktif melayani pelanggan!
