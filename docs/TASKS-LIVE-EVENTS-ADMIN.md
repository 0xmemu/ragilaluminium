# Task teruji: Admin Live Events dan penutup potensi masalah

Status: siap dieksekusi. Turunan dari `docs/RANCANGAN-LIVE-EVENTS-ADMIN.md`.
Basis bukti: investigasi 16 Okt 2026 (lihat `docs/operations/`).

## 0. Istilah (dibaca dulu)

| Istilah | Arti |
|---|---|
| **Event** | Catatan bahwa sesuatu baru terjadi, mis. pesanan baru masuk. |
| **Broadcast** | Event dikirim keluar ke peramban, bukan ditunggu peramban. |
| **Reverb** | Layanan server (port 8080) yang menjaga sambungan ke peramban. |
| **Queue worker** | Proses yang mengambil pekerjaan dari antrean. Event kita lewat antrean. |
| **Antrean (`queue`)** | Daftar tunggu pekerjaan. Worker memilih antrean secara berurutan, yang disebut lebih dulu diambil lebih dulu. |
| **Polling** | Peramban bertanya berkala "ada yang baru?". Sekarang tiap 8 detik. |
| **Heartbeat** | Denyut jarang sebagai jaring pengaman. |
| **Penanda versi** | Satu nilai kecil yang berubah bila data admin berubah. |
| **Kolam PHP** | Kumpulan proses yang menjalankan aplikasi. Batasnya `pm.max_children`. |
| **Colo** | Titik data center Cloudflare yang melayani pengunjung. |

---

## 1. Kondisi awal yang terverifikasi (16 Okt 2026)

| Hal | Keadaan |
|---|---|
| `laravel-reverb.service` | `Restart=on-failure` (mati bersih tidak dihidupkan ulang) |
| `ragil-queue.service` | `--queue=imports,media,default`, `Restart=always` |
| Event broadcast | 3 buah, semua `ShouldBroadcast` (lewat antrean), tanpa `broadcastQueue()` |
| Kolam PHP | `pm.max_children=12`, `start_servers=4`, `max_spare=6` |
| `fastcgi_read_timeout` | 300 detik |
| `limit_req` nginx | tidak ada sama sekali |
| Indeks `updated_at` | tidak ada di seluruh database |
| Log Reverb | ditulis ke `current/storage/logs/` (hilang tiap deploy) |
| Deploy | `deploy-202.sh` me-restart `ragil-queue laravel-reverb` tiap deploy |
| Repo ops di VPS | `deploy/systemd/`, `deploy/nginx/`, `scripts/prod/` |

---

## 2. Tahap 1: infrastruktur (tanpa mengubah perilaku UI)

### T1.1 Reverb selalu hidup ulang

**Berkas**: `deploy/systemd/laravel-reverb.service`
**Kenapa**: `Restart=on-failure` tidak menghidupkan proses yang berhenti bersih. Admin
bisa berhenti menerima pembaruan tanpa gejala apa pun.

Langkah:
1. Ubah unit: `Restart=always`, `RestartSec=3`, tambah `StartLimitIntervalSec=0` di
   `[Unit]`, `WorkingDirectory` dan `ExecStart` diarahkan ke `current`, dan log
   dipindah ke `shared/storage/logs/reverb.log`.
2. Pasang ke `/etc/systemd/system/laravel-reverb.service`, `daemon-reload`, `restart`.

Uji (wajib, semua harus lulus):
```bash
sudo systemctl stop laravel-reverb && sleep 5 && systemctl is-active laravel-reverb   # active
sudo systemctl kill -s KILL laravel-reverb && sleep 5 && systemctl is-active laravel-reverb  # active
sudo tail -3 /var/www/ragilaluminium/shared/storage/logs/reverb.log                    # ada jejak mulai
```

Balik: `git revert` pada berkas unit, pasang ulang, `daemon-reload`, `restart`.

### T1.2 Worker antrean dipisah per sifat pekerjaan

**Berkas**: `deploy/systemd/ragil-queue.service`, baru `deploy/systemd/ragil-queue-fast.service`
**Kenapa**: worker sekarang menjalankan `--queue=imports,media,default`, jadi `imports`
diambil LEBIH DULU. Satu impor katalog panjang (batas 1800 detik) menahan notifikasi
admin selama itu.

Langkah:
1. `ragil-queue.service`: `--queue=imports,media` (pekerjaan panjang).
2. Buat `ragil-queue-fast.service`: `--queue=broadcast,default`, `Restart=always`,
   `RestartSec=3`, `Nice=5`, `--max-time=3600`.
3. `enable --now ragil-queue-fast`.

Uji:
```bash
systemctl is-active ragil-queue ragil-queue-fast      # active active
ps -eo cmd | grep -c "queue:work"                      # 2
sudo -u www-data php artisan queue:monitor broadcast,default   # tanpa pekerjaan macet
```

Balik: `systemctl disable --now ragil-queue-fast`, kembalikan `ragil-queue` ke
`imports,media,default`.

### T1.3 Event masuk antrean `broadcast`

**Berkas**: `app/Events/AdminOrderCreated.php`, `AdminWhatsAppReceived.php`,
`AdminOrderUpdated.php`
**Kenapa**: supaya event tidak ikut mengantre di belakang impor panjang.

Bentuk yang benar (sudah diverifikasi di Laravel terpasang: `BroadcastManager::queue()`
membaca `broadcastQueue()` lebih dulu, lalu properti `$broadcastQueue`, lalu `$queue`):

```php
public function broadcastQueue(): string
{
    return 'broadcast';
}
```

Uji (PHPUnit, wajib ada berkas tesnya):
```bash
su -s /bin/bash www-data -c 'cd /root/ragilaluminium && php artisan test --filter=AdminBroadcastQueueTest'
```
Tes memeriksa: ketiga event mengembalikan `broadcast`, dan ketiganya masih
mengimplementasikan `ShouldBroadcast`.

Balik: hapus method, event kembali ke antrean `default`.

### T1.4 Pembatas laju endpoint poll

**Berkas**: `deploy/nginx/ragilaluminium.com.conf`
**Kenapa**: pagar supaya bug atau lonjakan tab tidak bisa membanjiri server lagi.
Bukan jalur utama, hanya penambal.

Langkah:
1. Di luar blok `server`, tambah zona:
   `limit_req_zone $binary_remote_addr zone=adminpoll:10m rate=30r/m;`
2. Tambah blok lokasi khusus sebelum `location /`:
```nginx
location = /admin/notifications/poll {
    limit_req zone=adminpoll burst=10 nodelay;
    limit_req_status 429;
    try_files $uri $uri/ /index.php?$query_string;
}
```
3. `nginx -t` lalu `systemctl reload nginx`.

Uji:
```bash
for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code} " https://ragilaluminium.com/admin/notifications/poll; done
# harapan: sebagian 429, dan TIDAK ada 5xx
```
Catatan: uji ini harus memakai sesi admin agar tidak tertahan pengalihan login.
Kalau sulit, cukup pastikan tidak ada 5xx dan `nginx -t` lulus.

Balik: hapus dua blok itu, `nginx -t`, `reload`.

### T1.5 Kolam PHP dan batas tunggu

**Berkas**: `/etc/php/8.3/fpm/pool.d/www.conf` (catat nilai di `docs/operations/`)
**Kenapa**: cukup 12 permintaan lambat untuk membekukan seluruh toko sampai 5 menit
(`fastcgi_read_timeout 300`). Ini penjaga umum.

Langkah:
1. `pm.max_children = 24` (naikkan bertahap ke 32 bila RAM masih lega),
   `pm.start_servers = 6`, `pm.min_spare_servers = 4`, `pm.max_spare_servers = 12`.
2. `fastcgi_read_timeout 60;` di vhost nginx.
3. `php-fpm8.3 -t`, `systemctl reload php8.3-fpm`, `nginx -t`, `reload nginx`.

Uji:
```bash
php-fpm8.3 -t
systemctl reload php8.3-fpm && systemctl is-active php8.3-fpm
ps -eo cmd | grep -c "php-fpm: pool www"     # bertambah, tidak lebih dari max_children
free -m                                       # sisa RAM masih lega
curl -s -o /dev/null -w "%{http_code}\n" https://ragilaluminium.com/
```
Pemantauan setelahnya: peringatan `pm.max_children` di `/var/log/php8.3-fpm.log`
harus berhenti muncul.

Balik: kembalikan nilai, `reload`.

### T1.6 Geser cron tengah malam

**Kenapa**: kejadian 16 Okt 00:00 (server diam 30 detik, nol trafik) berimpit dengan dua
`mysqladmin flush-logs` sekaligus (dari backup binlog per jam dan dari rotasi log MySQL),
plus `dpkg-db-backup` dan `logrotate`.

Langkah:
1. `hourly-binlog-backup.sh` dari menit 0 ke menit 10.
2. Jauhkan rotasi log nginx dari jam 00 (mis. 00:20) lewat `logrotate.timer` atau
   konfigurasi jadwal.

Uji:
```bash
crontab -l | grep binlog          # menit 10
sudo systemctl list-timers logrotate.timer --all
```
Bukti lanjut: pantau `health-alert.log` pada 00:00-00:15 selama 3 malam, tidak boleh ada
KRITIS.

Balik: kembalikan menit ke 0.

---

## 3. Tahap 2: biaya rendah

### T2.1 Penanda versi di Redis (mengganti 14 subquery)

**Berkas**: `app/Services/AdminDataVersion.php` (baru), `app/Providers/AppServiceProvider.php`,
`app/Http/Controllers/Admin/NotificationController.php`
**Kenapa**: `dataVersion()` sekarang menjalankan 14 subquery tiap polling, termasuk
`MAX(updated_at)` pada sekitar 10 tabel, dan kolom itu **tidak berindeks**. Begitu
pesanan bertambah, tiap polling jadi pemindaian tabel penuh.

Langkah:
1. Buat layanan penanda versi: kunci Redis `admin:data_version`, nilai penghitung
   (`INCR`), dengan fallback baca basis data bila Redis tidak tersedia.
2. Daftarkan pengamat model (`saved`, `deleted`) untuk tabel yang tampil di panel:
   `Order`, `Payment`, `WhatsAppMessage`, `MediaAsset`, `ImportJob`, `OrderReturnCase`,
   `CmsTestimonial`, `CmsBanner`, `Announcement`, `StoreVoucher`, `Promotion`, `Shipment`.
3. `NotificationController::poll()` membaca penanda versi dari layanan itu, bukan
   menjalankan query agregat.

Uji (PHPUnit):
```bash
su -s /bin/bash www-data -c 'cd /root/ragilaluminium && php artisan test --filter=AdminDataVersionTest'
```
Tes memeriksa: nilai berubah setelah model disimpan, tidak berubah saat tidak ada
perubahan, dan endpoint `poll` tetap mengembalikan `data_version` bertipe string.

Balik: `poll()` kembali memakai `dataVersion()` lama (simpan versi lamanya di git).

### T2.2 Indeks `updated_at`

Tambah migrasi indeks pada `updated_at` untuk tabel di T2.1.
**Peringatan**: `deploy-202.sh` TIDAK menjalankan migrasi. Migrasi harus dijalankan
manual sesudah deploy, dan bersifat forward-only (dilarang `migrate:fresh`).

Uji: `php artisan migrate --pretend` menampilkan indeks yang akan dibuat.

---

## 4. Tahap 3: klien (perlu build dan uji E2E)

### T3.1 Satu pemilik sambungan Echo
Dua berkas sekarang menyambung ke kanal `private-admin.operations` yang sama:
`components/admin/live-notification-manager.tsx` dan `lib/admin-live-events.ts`.
Jadikan satu modul pemilik; komponen lain berlangganan lewat modul itu.

### T3.2 Penyelarasan saat sambungan pulih
Saat status kembali `connected` (termasuk dari `reconnecting`), lakukan SATU
penyelarasan: ambil penanda versi terbaru dan notifikasi setelah `last_id` terakhir
yang dipegang klien. Ini menutup celah saat deploy memutus sambungan.

### T3.3 Deteksi data basi
Catat `lastMessageAt`. Bila tidak ada pesan lebih lama dari dua kali interval heartbeat,
paksa penyelarasan penuh dan tampilkan peringatan halus.

### T3.4 Heartbeat 120 detik dan berhenti saat tab tidak aktif
Ganti interval 8 detik jadi 120 detik. Hentikan saat `document.hidden`, selaraskan sekali
saat tab aktif kembali.

### T3.5 Satu sambungan per peramban
Pemilihan pemimpin antar tab lewat `BroadcastChannel`: hanya satu tab menjaga sambungan
dan heartbeat; tab lain menumpang. Kalau tidak didukung, tiap tab mandiri (perilaku lama).

### T3.6 Status sambungan tampil
Tampilkan status halus di header panel, dan tombol muat ulang manual saat terputus
lebih dari 60 detik.

### T3.7 Siarkan `ShippingStatusUpdated`
Event ini ada tetapi tidak mengimplementasikan `ShouldBroadcast`, jadi perubahan resi
J&T tidak pernah sampai lewat WebSocket. Itu salah satu alasan polling dianggap perlu.

Uji Tahap 3: `npm run typecheck`, `npm run lint`, `npm run build`, lalu E2E
(`npm run test:e2e`) plus uji manual banyak tab.

---

## 5. Tahap 4: di luar aplikasi (perlu keputusan pemilik)

### T4.1 Pengawas produksi dari luar
Sekarang produksi hanya diawasi oleh dirinya sendiri. Agregator di 209 hanya menguji
`ra.333labs.tech` dan loopback, tidak pernah `ragilaluminium.com`. Tambahkan pengawas
dari luar (dari 209) yang menembus Cloudflare ke `https://ragilaluminium.com/up`.

### T4.2 Perbaiki skrip pengawas
`ragil-health-alert.sh` memakai `curl -ks` tanpa membedakan kode, sehingga 000 dan 522
tercatat sama. Catat kode HTTP apa adanya dan catat durasinya, lalu alarm juga pada
latensi, bukan hanya gagal total.

### T4.3 Hubungi penyedia
Tanyakan Biznet Gio soal pembatasan atau penyaringan koneksi ke `202.74.74.87` pada
16 Okt 2026 pukul 02:00-02:45 UTC.

### T4.4 Perbaiki DNS
`mail.ragilaluminium.com` di-proxy dengan origin berupa IP Cloudflare sendiri (melingkar).
`admin.ragilaluminium.com` tidak ada di SAN sertifikat origin, jadi gagal pada SSL Full
strict. MX `_dc-mx.27972c228184.ragilaluminium.com` tidak punya rekaman A, sehingga
email ke domain ini tidak terkirim.

---

## 6. Ambang keberhasilan

| Ukuran | Sebelum | Sasaran | Cara ukur |
|---|---|---|---|
| Permintaan `/admin/notifications/poll` per jam | sekitar 1.000 | di bawah 100 | analitik Cloudflare |
| Kode 5xx pada path itu | 194+106+84+63 | 0 | analitik Cloudflare |
| Peringatan `pm.max_children` | muncul | 0 | `/var/log/php8.3-fpm.log` |
| Sambungan WebSocket per peramban | tidak terukur | 1 | `ss -tn \| grep :8080` |
| Pembacaan `dataVersion` ke basis data | 14 subquery tiap polling | 0 | `SHOW GLOBAL STATUS LIKE 'Questions'` sebelum/sesudah |

Kalau permintaan per jam **tidak** turun, berarti Echo tidak tersambung dan heartbeat
yang jalan. Itu temuan, bukan kegagalan senyap.

Kalau kode 522 **tetap** muncul walau permintaan sudah sedikit, itu bukti tegas bahwa
akarnya di jalur Cloudflare ke server, dan langkahnya di luar aplikasi (T4.3).

---

## 7. Yang TIDAK ditutup (dinyatakan ulang)

1. **Jalur Cloudflare ke server.** Kejadian 16 Okt 09:00 terbukti bukan beban aplikasi:
   nginx mencatat 1.071 permintaan dijawab 200 dan **nol 5xx** pada jam itu, sementara
   Cloudflare mencatat 522/524/525/520. Task di sini menurunkan permintaan sekitar
   15 sampai 30 kali, sehingga jumlah yang terkena jauh lebih sedikit, tetapi jalurnya
   tetap bisa terdegradasi.
2. **Beban trafik dari banyak tab admin.** Ditutup di T3.5, tetapi tetap bergantung
   pada `BroadcastChannel` yang didukung peramban.
3. **Ketersediaan Reverb dan worker queue sebagai jalur kritis baru.** Ditutup dengan
   `Restart=always` (T1.1, T1.2), pengawas (T4.1), dan heartbeat (T3.4), tetapi tetap ada
   jendela sampai 3 detik (systemd) dan sampai 120 detik (heartbeat).
