# Rancangan: Admin Live Events (menutup jalur kritis)

Status: rancangan, belum diimplementasikan.
Konteks: tindak lanjut investigasi Error 522 pada `ragilaluminium.com`
(lihat `docs/DOMAIN/` dan catatan investigasi 16 Okt 2026).

---

## 0. Penjelasan istilah

Dibaca dulu supaya sisa dokumen ini tidak menebak.

| Istilah | Arti di sistem ini |
|---|---|
| **Event (kejadian)** | Catatan bahwa sesuatu baru terjadi, mis. "pesanan baru masuk". Dibuat oleh aplikasi saat data berubah. |
| **Broadcast** | Event yang dikirim keluar dari server ke peramban, bukan ditunggu peramban. |
| **Reverb** | Layanan di server (port 8080) yang menjaga sambungan terbuka ke peramban dan menyalurkan event. Sudah berjalan. |
| **WebSocket** | Sambungan dua arah yang tetap terbuka. Lewat inilah event sampai ke peramban tanpa peramban bertanya. |
| **Queue worker** | Proses di server yang mengambil pekerjaan dari antrean dan menjalankannya. Event kita lewat antrean, jadi worker ini ikut di jalur kritis. |
| **Polling** | Peramban bertanya berkala "ada yang baru?". Sekarang tiap 8 detik. Inilah yang membebani server. |
| **Heartbeat** | Denyut jarang sebagai jaring pengaman: satu pertanyaan murah tiap beberapa menit, untuk menangkap hal yang terlewat. |
| **Reconciliation (penyelarasan)** | Setelah sambungan pulih, mengambil sekali keadaan terkini untuk menutup celah event yang hilang saat sambungan putus. |
| **Version token (penanda versi)** | Satu nilai kecil yang berubah bila data admin berubah. Peramban cukup membandingkan nilai ini, tanpa query berat. |
| **BroadcastChannel** | Jalur komunikasi antar tab di peramban yang sama, supaya tab tidak perlu masing-masing bertanya ke server. |
| **Leader election (pemilihan pemimpin)** | Kesepakatan antar tab bahwa hanya SATU tab yang menjaga sambungan dan bertanya; tab lain menumpang. |

---

## 1. Prinsip rancangan

1. **Event adalah jalur utama**, bukan polling. Peramban tidak menanyakan data yang belum berubah.
2. **Tidak boleh ada mode gagal yang diam.** Setiap kemungkinan rusak punya penutup, dan setiap penutup punya pengawas.
3. **Jaring pengaman tetap ada, tetapi murah dan terkendali.** Polling tidak dihapus total, hanya turun frekuensi dan turun biaya.
4. **Yang tidak bisa ditutup aplikasi dinyatakan terpisah.** Jangan mengklaim selesai untuk hal yang bukan wewenang aplikasi.

---

## 2. Arsitektur berlapis

```
[ DB ]
  |
  | (1) penanda versi murah di Redis, dinaikkan saat model berubah
  v
[ Redis ] ----------------------------+
  |                                   |
  | (2) event masuk antrean "broadcast"|
  v                                   |
[ ragil-queue-fast ]  (worker pendek) |
  |                                   |
  | (3) POST ke Reverb                |
  v                                   |
[ Reverb :8080 ] ---- WebSocket -----> [ Peramban admin ]
  ^                                       |
  | (4) heartbeat 120s + penyelarasan saat pulih
  +---------------------------------------+
```

Lapisan:

- **Lapisan 0, sumber kebenaran**: basis data. Tidak berubah.
- **Lapisan 1, penanda versi**: pengganti `dataVersion()` yang sekarang menjalankan 14 subquery. Nilainya disimpan di Redis, dinaikkan saat model berubah. Biaya baca hampir nol.
- **Lapisan 2, broadcast**: event dibuat saat data berubah, masuk antrean `broadcast`, dikirim Reverb.
- **Lapisan 3, klien**: satu pemilik sambungan Echo, penyaring duplikat, penyelarasan saat sambungan pulih.
- **Lapisan 4, jaring pengaman**: heartbeat 120 detik plus deteksi data basi.
- **Lapisan 5, visibilitas**: status sambungan tampil di panel.
- **Lapisan 6, infrastruktur**: systemd, worker terpisah, pengawas.

---

## 3. Perubahan per komponen

### 3.1 Antrean broadcast terpisah (menutup penyumbatan impor)

**Masalah nyata**: event memakai `ShouldBroadcast`, jadi masuk antrean `default`. Worker
sekarang menjalankan `--queue=imports,media,default`, artinya `imports` diambil LEBIH
DULU. Satu impor katalog panjang (batas waktu 1800 detik) menahan notifikasi admin
selama itu.

**Rancangan**:

- Event menetapkan antreannya sendiri lewat method `broadcastQueue()` yang mengembalikan
  `'broadcast'`. Ini bentuk yang idiomatik dan sudah diverifikasi di versi Laravel yang
  terpasang: `BroadcastManager::queue()` membaca `broadcastQueue()` lebih dulu, lalu
  properti `$broadcastQueue`, lalu `$queue`. Jadi menulis properti `$queue` juga bekerja,
  tetapi method lebih jelas maksudnya.
- Dua worker dipisah per sifat pekerjaan:
  - `ragil-queue` (pekerjaan panjang): `--queue=imports,media`
  - `ragil-queue-fast` (pekerjaan pendek): `--queue=broadcast,default`
- Keduanya `Restart=always`.

**Hasil**: impor panjang tidak lagi menahan notifikasi. Notifikasi tidak lagi menahan impor.

### 3.2 Reverb sebagai jalur kritis (menutup mati diam)

**Masalah nyata**: `laravel-reverb` disetel `Restart=on-failure`. Proses yang berhenti
bersih (kode keluar 0) **tidak** dihidupkan ulang, sehingga admin berhenti menerima
pembaruan tanpa gejala.

**Rancangan**:

- `Restart=always` (menyamai `ragil-queue`), `RestartSec=3`.
- `StartLimitIntervalSec=0` supaya tidak menyerah setelah beberapa kali gagal berturut.
- Pengawas 5 menit di `ragil-health-alert.sh` tetap sebagai lapis kedua (sudah ada,
  sudah memantau `laravel-reverb`).
- Log Reverb dipindah ke `shared/storage/logs/reverb.log`. Sekarang tertulis di
  `current/storage/logs/` yang sifatnya per rilis, sehingga hilang tiap deploy.

**Hasil**: Reverb mati apa pun sebabnya, hidup lagi dalam 3 detik. Kalau gagal hidup,
pengawas mengabari.

### 3.3 Penyelarasan saat sambungan pulih (menutup celah deploy)

**Masalah nyata**: setiap deploy menjalankan `systemctl restart ragil-queue laravel-reverb`.
Semua sambungan admin putus seketika, dan event yang terjadi di sela itu tidak sampai.

**Rancangan**: saat klien mendeteksi sambungan kembali `connected` (termasuk transisi
`reconnecting` ke `connected`), klien langsung melakukan SATU penyelarasan:

- ambil penanda versi terbaru,
- ambil notifikasi setelah `last_id` terakhir yang dipegang klien,
- kalau ada yang berubah, muat ulang halaman.

Klien mengingat `last_id` di penyimpanan peramban, jadi celah saat putus tertutup.

**Hasil**: putus sambungan berapa pun lamanya tidak lagi berarti kehilangan pembaruan.

### 3.4 Penanda versi murah di Redis (menutup beban query)

**Masalah nyata**: `dataVersion()` menjalankan satu query agregat berisi 14 subquery
(termasuk `MAX(updated_at)` pada sekitar 10 tabel) pada SETIAP polling. Kolom
`updated_at` **tidak punya indeks sama sekali**, jadi begitu pesanan bertambah,
setiap polling berubah menjadi pemindaian tabel penuh.

**Rancangan**:

- Satu nilai penanda di Redis, mis. kunci `admin:data_version`, bertipe penghitung.
- Dinaikkan oleh pengamat model (`saved`, `deleted`) hanya untuk tabel yang tampil di
  panel: pesanan, pembayaran, pesan WhatsApp, media, riwayat impor, retur, ulasan,
  banner, pengumuman, voucher, promo, resi.
- Endpoint heartbeat hanya MEMBACA nilai ini. Tidak menyentuh basis data.
- Kalau Redis tidak tersedia, endpoint jatuh ke pembacaan murah dari basis data
  (mis. `MAX(id)` gabungan), supaya tidak mati total.

**Hasil**: biaya pengecekan "ada yang berubah?" turun dari 14 subquery menjadi satu
pembacaan kunci.

### 3.5 Heartbeat sebagai jaring pengaman (bukan polling)

**Rancangan**:

- Interval 120 detik (bisa disetel), menggantikan 8 detik. Turun 15 kali.
- Perilaku:
  - Saat sambungan sehat: heartbeat tetap jalan, tetapi hanya membaca penanda versi
    dari Redis. Hampir tanpa biaya, dan berfungsi sebagai uji hidup.
  - Saat sambungan putus atau tidak tersedia: heartbeat naik ke mode penuh, mengambil
    keadaan terkini dari basis data.
  - Saat Redis tidak tersedia: heartbeat memakai pembacaan murah dari basis data.
- Heartbeat berhenti saat tab tidak aktif (`document.hidden`), dan menyelaraskan sekali
  saat tab aktif kembali.

**Alasan tetap ada heartbeat walau sambungan sehat**: sambungan WebSocket yang
"tersambung" bisa saja tidak mengalirkan apa pun kalau worker queue mati. Heartbeat
adalah satu-satunya cara mendeteksi kegagalan diam itu.

### 3.6 Deteksi data basi (menutup kegagalan diam)

**Masalah nyata**: kalau event hilang (mis. pekerjaan gagal 3 kali lalu dibuang), panel
tetap terlihat normal padahal isinya ketinggalan.

**Rancangan**: klien mencatat `lastMessageAt`. Bila tidak ada pesan apa pun lebih lama
dari dua kali interval heartbeat, klien:

- memaksa penyelarasan penuh,
- menampilkan peringatan halus bahwa pembaruan langsung sedang terganggu.

### 3.7 Satu pemilik sambungan Echo (menutup koneksi ganda)

**Masalah nyata**: dua berkas membuat sambungan Echo dan berlangganan kanal
`private-admin.operations` yang sama: `live-notification-manager.tsx` dan
`admin-live-events.ts`. Keduanya memeriksa `window.Echo`, jadi berbagi, tetapi
menghasilkan dua penangan untuk kanal yang sama dan berpotensi memicu muat ulang dua kali.

**Rancangan**: satu modul pemilik sambungan (`admin-live-events.ts` diperluas).
Komponen lain berlangganan lewat modul itu, tidak membuat sambungan sendiri.

### 3.8 Satu sambungan per peramban, bukan per tab (menutup penggandaan tab)

**Masalah nyata**: puncak 93 permintaan per menit berasal dari sekitar 12 tab admin
terbuka bersamaan. Setiap tab sekarang punya sambungan dan polling sendiri.

**Rancangan**: pemilihan pemimpin antar tab lewat `BroadcastChannel`:

- Satu tab menjadi pemimpin: ia yang menjaga sambungan Reverb dan menjalankan heartbeat.
- Tab lain tidak menyambung dan tidak bertanya; mereka menerima pembaruan dari tab
  pemimpin lewat `BroadcastChannel`.
- Kalau tab pemimpin ditutup, tab lain memilih pemimpin baru.
- Kalau peramban tidak mendukung `BroadcastChannel`, tiap tab kembali mandiri (perilaku
  lama), tanpa gagal.

**Hasil**: 12 tab menjadi 1 sambungan dan 1 heartbeat, bukan 12.

### 3.9 Status sambungan tampil (menutup kebingungan)

**Rancangan**: tampilkan status halus di header panel: tersambung, menyambung ulang,
terputus. Saat terputus lebih dari 60 detik, tampilkan pemberitahuan bahwa data
mungkin tertinggal dan sediakan tombol muat ulang manual.

Alasan: admin perlu tahu kapan layar tidak lagi diperbarui. Sekarang tidak ada
penandanya sama sekali.

### 3.10 Siarkan perubahan resi (menutup celah non-notifikasi)

**Masalah nyata**: `ShippingStatusUpdated` ada tetapi **tidak** mengimplementasikan
`ShouldBroadcast`, jadi perubahan resi J&T tidak pernah sampai lewat WebSocket. Ini
salah satu alasan polling dianggap perlu.

**Rancangan**: jadikan `ShippingStatusUpdated` menyiarkan juga, sehingga perubahan resi
datang sebagai event.

### 3.11 Pembatas laju sebagai penambal (menutup kejutan)

**Rancangan**: `limit_req` di nginx untuk `/admin/notifications/poll`, misalnya 30
permintaan per menit per alamat IP dengan burst 10. Ini bukan jalur utama, hanya pagar
supaya bug atau lonjakan tidak bisa membanjiri server lagi.

### 3.12 Kolam PHP dan batas tunggu

**Rancangan**: `pm.max_children` dari 12 ke 24 sampai 32, dan `fastcgi_read_timeout`
dari 300 detik ke 60 detik. Ini penjaga umum, bukan bagian khusus live events.

### 3.13 Indeks `updated_at` (pengerasan sekunder)

Menambahkan indeks pada `updated_at` di tabel yang dipakai penanda versi. Setelah
penanda versi pindah ke Redis, ini tidak lagi di jalur polling, tetapi tetap berguna
untuk daftar admin yang mengurutkan atau menyaring berdasarkan waktu.

---

## 4. Mode gagal dan penutupnya

Tabel ini inti dari permintaan "tutup potensi masalah". Setiap baris harus punya
penutup, dan penutupnya harus bisa diuji.

| # | Mode gagal | Sebelum | Sesudah | Lapis penutup |
|---|---|---|---|---|
| 1 | Reverb berhenti bersih (kode 0) | tidak dihidupkan | hidup lagi dalam 3 detik | systemd `always`, lalu pengawas 5 menit |
| 2 | Reverb crash | hidup lagi 3 detik | sama, plus batas gagal dilonggarkan | systemd |
| 3 | Worker queue mati | notifikasi tertahan diam | hidup lagi 3 detik; heartbeat menutup sementara | systemd `always` + heartbeat |
| 4 | Impor panjang menyumbat event | event antre di belakang impor | tidak lagi, antrean terpisah | antrean `broadcast` |
| 5 | Deploy memutus sambungan | event di sela hilang | terselaraskan saat pulih | penyelarasan + `last_id` tersimpan |
| 6 | Redis mati | penanda versi dan antrean mati | endpoint jatuh ke basis data; heartbeat jadi jalur utama | fallback basis data |
| 7 | WebSocket diblokir jaringan | polling tetap jalan (kebetulan aman) | status `unavailable`, heartbeat penuh jalan | deteksi status sambungan |
| 8 | Event gagal lalu dibuang | notifikasi hilang diam | penanda versi berubah, heartbeat menangkap | heartbeat + penanda versi |
| 9 | 12 tab terbuka | 93 permintaan per menit | 1 sambungan dan 1 heartbeat per peramban | `BroadcastChannel` |
| 10 | Perubahan tanpa notifikasi (resi) | hanya tertangkap polling | disiarkan sebagai event | `ShippingStatusUpdated` disiarkan |
| 11 | Tab tidak aktif lama | polling jalan terus | heartbeat berhenti, selaras saat aktif | `visibilitychange` |
| 12 | Bug membanjiri endpoint | tanpa pagar | ditolak pembatas laju | `limit_req` nginx |
| 13 | Redis penanda versi rusak | (belum ada) | pembacaan jatuh ke basis data | fallback |
| 14 | Peramban tanpa `BroadcastChannel` | (belum ada) | tiap tab mandiri, tanpa gagal | jalur cadangan |

### Yang TIDAK ditutup oleh rancangan ini

Wajib dinyatakan, supaya tidak ada klaim berlebih.

1. **Jalur Cloudflare ke server (akar 522 pada 16 Okt 09:00).** Rancangan ini menurunkan
   jumlah permintaan sekitar 15 sampai 30 kali, sehingga jumlah permintaan yang terkena
   jauh lebih sedikit. Tetapi jalurnya tetap bisa terdegradasi. Penanganannya di luar
   aplikasi: tanyakan ke penyedia (Biznet Gio), dan pasang pengawas dari luar.
2. **Tumpukan cron tengah malam** (dua `mysqladmin flush-logs` berimpit, dpkg, rotasi
   log). Perlu langkah terpisah: geser salah satu ke menit ke-10, jauhkan rotasi log.
3. **Pemantauan produksi dari luar.** Sekarang produksi hanya diawasi oleh dirinya
   sendiri; agregator di 209 tidak menguji produksi sama sekali.

---

## 5. Cara menguji bahwa penutupnya benar bekerja

Setiap uji harus punya hasil yang terlihat, bukan asumsi.

| Uji | Cara | Harapan |
|---|---|---|
| Reverb mati bersih | `systemctl stop laravel-reverb` | hidup lagi dalam 3 detik |
| Reverb dibunuh | `kill -9` pada prosesnya | hidup lagi dalam 3 detik |
| Worker queue mati | `systemctl stop ragil-queue-fast` | notifikasi tetap sampai lewat heartbeat dalam 120 detik |
| Celah deploy | restart Reverb saat tab terbuka | event di sela tetap muncul setelah pulih |
| Redis mati | hentikan Redis sesaat | panel tetap menerima pembaruan (mode fallback) |
| Banyak tab | buka 5 tab | hanya 1 sambungan WebSocket dan 1 heartbeat |
| Tab tidak aktif | pindah ke tab lain 5 menit | heartbeat berhenti; selaras saat kembali |
| Data basi | matikan worker queue 5 menit | peringatan "pembaruan terganggu" muncul |
| Pembatas laju | tembak endpoint 100 kali cepat | kelebihannya ditolak, bukan menjenuhkan server |

### Angka yang dipantau setelah pemasangan

Diambil dari analitik Cloudflare (token di `prod/.env`, izin Account Analytics Read)
dan dari server.

| Ukuran | Sebelum | Sasaran |
|---|---|---|
| Permintaan `/admin/notifications/poll` per jam | sekitar 1.000 | di bawah 100 |
| Kode 5xx pada path itu | 194 + 106 + 84 + 63 | 0 |
| Peringatan `pm.max_children` di log php-fpm | muncul | 0 |
| Sambungan WebSocket per peramban | tidak terukur | 1 |
| Pembacaan `dataVersion` ke basis data | 14 subquery tiap polling | 0 (pindah ke Redis) |

Kalau permintaan per jam **tidak** turun, berarti Echo tidak tersambung dan justru
heartbeat yang jalan. Itu temuan, bukan kegagalan senyap.

Kalau kode 522 **tetap** muncul walau permintaan sudah sedikit, itu bukti tegas bahwa
akarnya di jalur Cloudflare ke server, dan langkah berikutnya di luar aplikasi.

---

## 6. Urutan pengerjaan

Bertahap, supaya bisa diuji dan dibalik satu per satu.

**Tahap 1, infrastruktur (tanpa ubah perilaku UI).**
`Restart=always` Reverb, `StartLimitIntervalSec=0`, log ke `shared`, antrean `broadcast`
plus worker `ragil-queue-fast`, method `broadcastQueue()` pada event, pembatas laju nginx,
kolam php-fpm dan batas tunggu.

**Tahap 2, biaya rendah.**
Penanda versi di Redis plus pengamat model, endpoint heartbeat yang hanya membaca
penanda versi, indeks `updated_at`.

**Tahap 3, klien.**
Satu pemilik Echo, penyelarasan saat pulih, deteksi data basi, interval heartbeat 120
detik, henti saat tab tidak aktif, status sambungan tampil, pemilihan pemimpin antar tab.

**Tahap 4, tutup celah terakhir.**
Siarkan `ShippingStatusUpdated`.

**Tahap 5, di luar aplikasi (perlu keputusan pemilik).**
Geser cron tengah malam, tambah pengawas dari luar, hubungi penyedia.

Setiap tahap: typecheck, lint, build, uji sesuai tabel bagian 5, lalu commit terpisah
supaya bisa dibalik sendiri.

---

## 7. Risiko yang harus disadari

1. **Reverb dan worker queue menjadi jalur kritis baru.** Ditutup dengan `Restart=always`,
   pengawas, dan heartbeat. Tetap ada jendela sampai 3 detik (systemd) dan sampai 120
   detik (heartbeat).
2. **Redis menjadi bergantung bersama.** Cache, antrean, sesi, dan penanda versi
   memakainya. Ditutup dengan fallback basis data pada heartbeat, tetapi mode ini lebih
   berat dan hanya untuk sementara.
3. **WebSocket menahan satu sambungan per peramban.** Jauh lebih murah daripada polling,
   tetapi `max_connections` Reverb sebaiknya diberi batas eksplisit dan dipantau.
4. **Rancangan ini tidak menyelesaikan 522 pada akarnya.** Hanya memperkecil paparan.
   Dinyatakan ulang di sini supaya tidak terlupa.
