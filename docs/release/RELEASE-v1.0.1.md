# Release v1.0.1

Tanggal: 13 Oktober 2026. Tag: `v1.0.1` (menggantikan `v1.0.0` yang dibuat sebelum perbaikan config ikut terbawa). Commit: `2980cad6`, sama dengan `main`.

## Isi rilis

- Perbaikan gate integrasi agar `php artisan config:cache` dapat berjalan (sebelumnya gagal karena Closure tidak serializable).
- 29 warning lint React Hooks dibereskan dengan pola resmi React (penyesuaian state saat render, lazy initializer, fetch asinkron).
- Dokumentasi operasi: matriks dependency production, inventaris data production, laporan cutover, dan catatan kesiapan.

## Quality gate (dijalankan di 209 sebelum merge)

| Gate | Hasil |
|---|---|
| PHPUnit | 1.417 lulus, 1 dilewati |
| Vitest | 354 lulus |
| TypeScript | 0 error |
| ESLint | 0 warning |
| Vite build | sukses |
| Config cache | berhasil |

## Deployment ke VPS produksi (202.74.74.87)

- Rilis diekstrak dari tag `v1.0.1` ke `/var/www/ragilaluminium/releases/20261013-v1.0.1`.
- `composer install --no-dev --optimize-autoloader` dan `npm ci && npm run build` sukses.
- `.env` dari `shared/.env`; storage dan bootstrap cache milik www-data.
- Migrasi forward-only: tidak ada yang tertunda.
- `config:cache`, `route:cache`, `view:cache` berhasil (perbaikan utama rilis ini).
- Switch symlink `current` dilakukan atomik; rilis sebelumnya `20261013-snapshot-6630f927` tetap tersimpan untuk rollback.
- Nginx dan PHP-FPM dimuat ulang; pekerja antrean direstart.

## Smoke test pasca-deploy

Beranda, `/up`, login, katalog, keranjang, about, faq, cara-pemesanan, kebijakan privasi, dan ketentuan layanan semuanya 200. `/admin` tanpa login dialihkan 302. Akses `/.env` dan `/.git/config` ditolak 403; berkas internal lain 404. Callback J&T tanpa tanda tangan ditolak 401. Produk, pesanan, dan pelanggan tetap 0; satu akun admin production.

## Batasan yang tetap terbuka

Status komersial penuh belum tercapai dan tidak diklaim tercapai:

- Media production (bucket R2, kredensial, domain media) belum dikonfigurasi; katalog production memang kosong.
- WhatsApp production belum dikonfigurasi dan tidak boleh dianggap aktif.
- J&T dinonaktifkan; aktivasi menunggu kredensial dan uji callback bertanda tangan.
- Payment provider dan SMTP production belum dipilih.
- Reverb/live admin events belum diaktifkan.
- Deploy key GitHub read-only untuk 202 belum terdaftar; rilis ini dipasang dari arsip tag di 209, bukan fetch langsung di 202.
- Login admin melalui browser belum diuji; sandi admin production harus diganti (pernah tertulis di percakapan).

## Rollback

```bash
sudo ln -sfn /var/www/ragilaluminium/releases/20261013-snapshot-6630f927 /var/www/ragilaluminium/current
sudo systemctl reload php8.3-fpm && sudo systemctl reload nginx && sudo systemctl restart ragil-queue
```

Database tidak perlu diubah untuk rollback kode; tidak ada migrasi baru di rilis ini.