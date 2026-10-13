# Cutover produksi awal, 13 Oktober 2026

**Status: LIVE terbatas, situs dapat diakses, katalog dan data transaksi sengaja kosong.** Domain `ragilaluminium.com` dilayani oleh VPS 202 dari source snapshot Git commit `6630f927` (`release/initial-production-cutover`), tanpa merge ke main atau tag formal. Kode ditempatkan pada `/var/www/ragilaluminium/releases/20261013-snapshot-6630f927`, dan `current` menunjuk ke direktori itu. Jalur web Nginx `/var/www/ragilaluminium/current/public` mengganti halaman standby. Tidak ada dump atau `.env` development yang dipakai.

## Bukti setelah switch

- Migrasi forward-only selesai: 61 tabel, 0 migrasi Pending. Pada awalnya migration bertanggal tanpa underscore mencoba mengubah tabel produk sebelum dibuat; migration pembuat tabel produk dijalankan secara eksplisit, lalu migrasi biasa dilanjutkan. **Tidak ada** migrasi reset, seeder default, atau pemindahan record dari VPS 209.
- Produk, varian, pesanan, pembayaran, pelanggan: masing-masing 0. Satu akun admin khusus username `ragil` berstatus aktif; password dikirim owner di percakapan dan disimpan sebagai hash pada database produksi, bukan pada Git atau dokumen. Pengguna wajib mengganti password karena kredensial pernah terpapar di percakapan. Dua migration menanam 3 kategori dan 30 sub-model sistem, bukan record development.
- HTTPS: `/`, `/up`, `/login`, `/products`, `/cart`, `/about`, `/faq`, `/cara-pemesanan`, `/policy/privacy`, `/policy/terms` masing-masing 200 di domain produksi. `/admin` tanpa login mengalihkan ke `/login`. Contoh berkas CSS dan JS hasil build masing-masing 200. Akses `/.env` dan `/.git/config` 403; file internal lain yang diuji 404.
- Panggilan POST tanpa autentikasi ke callback J&T pada host `api.ragilaluminium.com` mendapat 401, bukan 200 statis yang menipu. Konfigurasi J&T nonaktif; jangan menganggap integrasi pengiriman telah lolos uji transaksi nyata.
- Nginx, PHP-FPM, MySQL, Redis dan pekerja antrean systemd `ragil-queue.service` aktif. Scheduler Laravel dipasang pada cron pengguna `www-data`; satu putaran `schedule:run` berhasil. Cron cadangan database yang sudah ada tidak diubah. Sertifikat origin berlaku hingga 8 Desember 2026. Dump baru sesudah migrasi berhasil dan terunggah; uji pemulihan dari dump itu ke database uji terpisah menghasilkan 61 tabel dari 61 tabel dan satu akun admin pada kedua sisi, tanpa mengubah database aplikasi.
- `APP_DEBUG=false`, HTTPS wajib, kunci aplikasi dan password database baru khusus 202. Media memakai penyimpanan lokal kosong, bukan bucket development. Penyedia WhatsApp produksi **belum dikonfigurasi**; nilai `meta` tidak cukup untuk menyatakan pengiriman WhatsApp siap. Jangan menjalankan pesanan nyata atau pengujian pesan hingga provider dan rahasia production tersedia.

## Keterbatasan dan tindak lanjut operasional

- Uji penuh backend pada snapshot: 1.417 lulus, 1 dilewati; uji frontend 354 lulus; pemeriksaan TypeScript dan build lulus. Lint masih gagal karena 29 peringatan meski tidak ada error. Uji masuk admin melalui browser belum dilakukan, sehingga status login admin baru baru diverifikasi lewat model, route dan hash password di database.
- Konfigurasi Laravel tidak dapat di-cache karena Closure yang tidak bisa diserialisasi. `config:cache` gagal, tidak meninggalkan `bootstrap/cache/config.php`; route dan view cache berhasil. Runtime tetap berjalan tanpa config cache.
- Penyimpanan Laravel saat ini berada di direktori release, bukan pada `shared/storage`; ketika mengganti release kelak, storage harus dipertahankan dengan prosedur teruji. Tidak ada konten media ataupun produk produksi yang perlu dipindahkan saat cutover pertama.
- Kunci SSH deploy read-only untuk GitHub sudah dibuat tetapi belum didaftarkan di repository; oleh karena itu source commit diambil sebagai arsip Git dari 209, bukan menyalin working tree atau secret. Perbarui release code di 202 hanya dari commit terverifikasi.
- Vhost standby disalin ke `/root/ragil-backup/staged/default.before-initial-cutover-20261013` dan symlink lamanya disimpan di folder sama sebagai `default.symlink.before-initial-cutover-20261013`. Untuk rollback, kembalikan vhost `default` sebagai satu-satunya situs aktif, nonaktifkan vhost Laravel, verifikasi `nginx -t`, lalu reload. Jangan memakai skrip rollback lama tanpa meninjau karena nama cadangannya berbeda. **Jangan memulihkan database** hanya untuk rollback tampilan.
- Tidak ada order, barang, atau pelanggan development; pengunjung baru di database setelah situs live merupakan trafik produksi dan tidak boleh dihapus hanya demi angka nol. Tetap verifikasi hasil penyimpanan dan notifikasi sebelum membuka pesanan nyata.

Kesimpulan: etalase kosong live dan terlindung, bukan toko lengkap yang siap menerima pesanan, pengiriman J&T, atau WhatsApp. Persiapan provider, kunci deploy, uji login dan retensi storage masih terbuka.

## Aktivasi lanjutan 13 Okt 2026 (sesi lanjutan)

Rilis aktif tetap 20261013-v1.0.1 ditambah hotfix dua berkas dari commit e788b206 (config/jnt.php dan app/Console/Commands/JntJointDebug.php): perbaikan ini membuat nilai uji J&T dibaca lewat config sehingga tahan config:cache. Rilis penuh berikutnya memuat perbaikan ini lewat main.

- J&T aktif: kredensial di-merge, master alamat (jnt_address_masters) 81.320 baris tersinkron dari API, balikan webhook diverifikasi dengan kunci asli (unsigned 401, signed ACK). Validasi formal lewat jnt:joint-debug: tariff 3/3 OK dan address 3/3 OK (http 200), tiap panggilan dengan ID permintaan.
- Dataset referensi (bukan produk, media, data pelanggan) sudah di 202: tabel pemetaan kode pos 81.058 baris, empat berkas wilayah CSV di storage rilis dan shared/storage, sub model 51, template atribut sub model 107, template pesan WhatsApp 9, setelan operasional COD 4 persen dan subsidi ongkir 10 persen. Bukti hidup: /api/wilayah/provinces penuh dan cascade sampai kode pos desa.
- Media: MEDIA_DISK=s3 memakai bucket ra-media dengan kredensial yang sudah ada di server, URL publik media.333labs.tech; media:disk-check PASS (tulis, baca, hapus).
- WhatsApp: layanan baileys-bot aktif di port 3005 dengan program dan dependensi selaras dengan 209; menunggu pemindaian QR oleh owner di panel admin, satu-satunya langkah yang butuh pemilik.
- Sisa langkah owner: pemindaian QR WhatsApp, rotasi kata sandi admin (sandi lama pernah tampil di percakapan), dan verifikasi login browser.

## Sisir keselarasan 202 vs 209 (13 Okt 2026, lanjutan)

Hash isi kode rilis 202 selaras dengan repo 209 (selisih yang tersisa hanya akhir baris CRLF dan dua dokumen baru). Tabel referensi basis data selaras; master alamat J&T 202 lebih baru. Ditambal dalam sesi ini:

- Env bisnis disalin dari 209: BRAND_PHONE, SHIPPING_LOCAL_BASE_RATE 15000, SHIPPING_LOCAL_PER_KG 2000, SHIPPING_DEFAULT_ITEM_WEIGHT 1.0, STOREFRONT_PRODUCT_CARD_DISCOUNT_PERCENT 0, SESSION_LIFETIME 7200, WHATSAPP_LANGUAGE id. Sebelum ini beranda menampilkan nomor default 0851-9966-6810.
- Reverb dipasang (laravel-reverb.service, port 8080, autostart) dengan kunci baru; proxy /app sudah ada di vhost sejak persiapan; frontend dibangun ulang agar kunci masuk bundel; handshake WebSocket 101 lewat origin maupun Cloudflare.
- Aset media hasil uji unggah owner dipulihkan: tiga varian webp dinaikkan ke R2, URL publik 200, dan model media membangun ulang URL dari disk aktif sehingga tidak perlu ubah basis data.
- Belum diport (butuh keputusan owner): cron health-check 5 menit dan agregator alert milik 209; kanal notifikasi harus dipilih lebih dulu.
