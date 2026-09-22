# ADR-015 — KPI Performa Toko dan Event Finansial

Tanggal draft: 2026-08-24
Dasar: implementasi KPI Task 1-4 (commit `d747e15` `3195faa` `ef825ab` `9cb88bf`) + final review.
ADR-015 KPI Performa Toko — disetujui (Accepted) 2026-08-24. Melengkapi definisi ADR-015 omzet yang ada.

## Status

**Accepted**

Tanggal approval: 2026-08-24

---

## Context

Performa Toko perlu memisahkan beberapa konsep untuk menghindari ambiguitas dan laporan yang
menyesatkan:

- **Penjualan (Gross)** vs **Penjualan Bersih** vs **Pembayaran Diterima**: nilai order yang masuk
  alur fulfillment (gross) bukan berarti uang sudah masuk. Pembayaran diterima adalah metrik
  cash-in terpisah. Penjualan bersih adalah gross dikurangi refund retur yang selesai.
- **Refund vs Retur**: refund adalah nominal uang yang dikembalikan pada kasus retur selesai;
  nilai retur adalah nilai produk yang dikembalikan; keduanya berbeda ukuran.
- **Pembatalan**: perlu berbasis event (`event_logs`) bukan snapshot `orders.created_at`, karena
  waktu pembatalan ≠ waktu pembuatan order, dan perlu dibedakan actor (pelanggan vs toko).
- **Produk engagement**: views vs clicks vs jumlah terjual harus dibedakan; data agregat harian.
- **Lifetime / comparison / period reporting**: semua metrik harus mendukung periode, perbandingan
  periode sebelumnya, dan granularity (sampai tahun) secara konsisten (WIB, half-open).

## Decisions

### 1. Penjualan (Gross)

- `SUM(orders.total_amount)`.
- Scope (REVISI 2026-09-22, keputusan owner P0.2): pesanan yang DIBUAT dalam periode DAN
  tercatat mencapai status `processing` pada `event_logs` paling lambat akhir periode
  (`StorePerformanceService::recognizedOrderIds`). Daftar status lama
  (`processing, shipped, delivered, completed, return_in_process, return_completed`)
  tidak lagi menjadi penyaring, dan status saat ini tidak dipakai sama sekali.
- Basis waktu: `orders.created_at` (bucket tidak berpindah).
- **Ini bukan** pembayaran diterima, settlement, atau laba. Semua pesanan (transfer & COD) dihitung
  sejak `processing` (ADR-015 existing, dipertahankan).
- Konsekuensi pengakuan beku yang disetujui owner: pembatalan SETELAH periode berakhir tidak
  menghapus pesanan dari laporan periode itu; pesanan yang baru `processing` SETELAH periode
  berakhir tidak dihitung di periode mana pun; pesanan tanpa catatan event tidak terhitung.
  Bukti diskriminatif: `StorePerformanceRecognitionFreezeTest`.

### 2. Penjualan Bersih

Formula yang berlaku sejak 2026-09-20 (revisi: sebelumnya hanya menyebut refund):

```
Net = Gross
      - ongkir_raw        (tagihan J&T, atau asumsi checkout bila J&T belum melapor)
      - biaya_cod         (biaya layanan COD yang diteruskan ke J&T)
      - refund            (SEMUA refund, lihat aturan di bawah)
      - ongkir_retur      (ongkir retur yang ditanggung toko)
      - nilai_barang_retur (nilai barang paket yang kembali sebelum diterima pembeli)
```

Terverifikasi cocok dengan kode dan dengan angka produksi 2026-09-20
(`gross - potongan = net`).

**Refund memakai SEMUA refund, termasuk goodwill** (keputusan owner 2026-09-20):
refund yang uangnya kembali ke pembeli walau barangnya tidak dikembalikan tetap
mengurangi penjualan, dan KPI `refund_given` memakai basis yang sama sehingga angka
di layar bisa direkonsiliasi. Sebelumnya penjualan memakai refund yang barangnya
kembali saja, sementara KPI menampilkan semua refund, sehingga dua angka berbeda
untuk hal yang sama.

- Sumber refund: `order_return_cases.refund_amount` (bukan payment ledger).
- Sumber refund: `order_return_cases.refund_amount` (bukan payment ledger).
- Basis waktu refund: `completed_at`.
- **Refund tidak boleh dihitung dua kali** dari payment ledger (payment `refunded` tidak dikurangi
  lagi dari net; `payments_received` hanya status `completed`).

### 2b. Lingkup periode vs kondisi saat ini

Setiap metrik wajib jelas lingkupnya, karena mencampur keduanya membuat angka
periode tidak bisa dijumlahkan:

- **Periode**: dihitung dari tanggal dalam rentang terpilih (omzet, pesanan, unit,
  pembayaran diterima, retur selesai, pembatalan).
- **Kondisi saat ini (snapshot)**: dihitung dari keadaan sekarang tanpa batas tanggal.
  Labelnya wajib menyebut "kondisi saat ini" atau "semua waktu", dan tidak diberi
  pembanding persen karena pembandingnya adalah snapshot yang sama sehingga selalu 0.

Cakupan setiap metrik dideklarasikan di SATU tempat, `StorePerformanceService::METRIC_BASIS`.
Deklarasi itu menyebut `scope` (`period` atau `current`) dan `anchor`, yaitu tanggal
yang dipakai kueri, dalam frasa yang bisa dibaca pembaca. Label, drawer, tabel Referensi
di halaman, dan ekspor XLSX semuanya membaca deklarasi itu, jadi tidak ada permukaan yang
bisa berbeda.

Daftar metrik bercakupan kondisi saat ini, disamakan dengan kode. Menambah satu metrik
bercakupan baru berarti menambah satu baris di `METRIC_BASIS`, menambahkan testnya, dan
memperbarui daftar ini:

| Metrik | Penanda pada label | Alasan |
|---|---|---|
| `open_orders` | kondisi saat ini | menghitung seluruh pesanan yang belum selesai, tanpa melihat tanggal pembuatan |
| `dispatched_orders` | kondisi saat ini | menghitung pesanan yang sedang dikirim sekarang |
| `returns_open` | kondisi saat ini | kasus retur yang masih terbuka saat laporan dibuat |
| `payment_pending_count` | kondisi saat ini | pembayaran yang belum lunas pada pesanan aktif |
| `cod_pending_amount` | semua waktu | menjumlahkan seluruh dana COD yang belum cair |
| `cod_pending_count` | semua waktu | jumlah pesanan COD yang uangnya belum cair |

Seluruh metrik lain terikat periode. Empat di antaranya tidak tampil sebagai kartu KPI,
tetapi tetap dideklarasikan karena angkanya muncul di halaman atau di ekspor:
`open_orders_in_period`, `cod_pending_in_period_amount`, `cod_pending_in_period_count`,
dan `payment_pending_count`.

Grafik adalah VISUAL dari angka, bukan sumber perhitungan. Angka resmi di halaman
berasal dari satu sumber yang sama dan dipakai bersama oleh kartu, drawer, dan ekspor
XLSX; grafik menggambarkan angka itu supaya arah dan perbandingannya terlihat. Karena
itu:

- Tidak boleh ada angka halaman yang dihitung dari titik grafik.
- Angka Total pada tiap grafik wajib sama dengan angka kartu metrik yang sama, karena
  keduanya satu sumber. Kesamaan itu yang diuji, bukan kesamaan dengan jumlah titik
  grafik.
- Angka Total TIDAK wajib sama dengan jumlah titik grafik, dan itu memang wajar.
  Produk Terjual menghitung produk unik sepanjang periode, sedangkan grafik menampilkan
  produk itu di setiap hari penjualannya, sehingga jumlah titiknya bisa lebih besar.
  Memaksa keduanya sama berarti menjadikan grafik sebagai sumber perhitungan.
- Permukaan pembaca tidak menjelaskan hubungan Total dengan titik grafik. Penjelasan itu
  tidak menambah keputusan apa pun bagi pembaca dan pernah melahirkan kekeliruan: satu
  kalimat yang sama dipakai untuk dua perilaku berbeda, sehingga kartu Pengunjung Unik
  menyatakan "bukan penjumlahan titik grafik" padahal angkanya justru dijumlahkan.

Cara menentukan cakupan sebuah metrik TIDAK BOLEH memakai perbandingan nilai antar rentang.
Metrik terikat periode pun akan bernilai sama pada dua rentang bila datanya nol di kedua
rentang, jadi perbandingan itu tidak membuktikan apa pun. Yang dipakai adalah membaca kueri
sumbernya, lalu dibuktikan dengan test yang menanam data di LUAR rentang: metrik
bercakupan sekarang tetap menghitungnya, metrik terikat periode tidak
(`StorePerformanceMetricBasisTest`).

### 3. Pembayaran Diterima

- `SUM(payments.amount)` WHERE `payments.status = 'completed'`.
- Event date: `payments.paid_at`.
- `payments` `refunded`, `cancelled`, `pending` TIDAK masuk.
- `paid_at` null dikeluarkan.

### 4. COD

- Pembayaran COD dianggap `paid` saat status pengiriman `delivered` sesuai lifecycle yang sudah
  ditetapkan (Sprint 2 retur), didukung `ReturnService::markDeliveredAndSettleCod` idempotent.
- `cod_paid` (KPI) = `SUM(payments.amount)` utk payment `payment_method='cod'` + `status='completed'`
  + `paid_at` in period. Dibaca dari **ledger**, bukan `SUM(orders.total_amount)`, untuk menghindari
  double-count.
- Definisi konsisten dengan payment ledger; tidak menghasilkan double-count.

### 5. Retur

- **Retur Diajukan** (`returns_created`): return case `created_at` in period.
- **Retur Aktif** (`returns_open`): return case `status='open'` **saat laporan dibuat** (snapshot
  current), BUKAN histori akhir periode (histori retur-aktif tidak dapat direkonstruksi dari struktur
  existing). Detail: "Kasus retur yang masih terbuka saat laporan dibuat."
- **Retur Selesai** (`returns_completed`): return case `status='completed'` + `completed_at` in period.
- **Refund Diberikan** (`refund_given`): `SUM(refund_amount)` pada return case selesai (konsisten
  dgn `financial.refund_adjustments`).
- **Nilai Retur** (`return_value`): `returned_quantity × order_items.unit_price` pada return case
  selesai.
- **Rasio Retur Diajukan**: `returns_created / orders` (order fulfillment) × 100.
- **Rasio Retur Selesai**: `returns_completed / completed_orders` × 100.

### 6. Pembatalan

- Source: `event_logs`.
- `event_type = 'order_status_changed'`.
- `payload.order_status = 'cancelled'`.
- Event date: `event_logs.created_at`.
- `COUNT(DISTINCT entity_id)` (dedupe; `cancelled` terminal).
- Actor: `created_by_user_id IS NULL` = pelanggan; terisi = admin/toko.
- **`payload.source` TIDAK digunakan sebagai actor canonical** (selalu `admin_cancel`).
- `cancellation_rate` = `cancelled / (cancelled + orders_fulfillment) × 100`; 0 bila denom 0.

### 7. Pelanggan

- Identity key: `orders.customer_phone`.
- **Cancelled order tidak dihitung sebagai repeat order valid.**
- Repeat customers = phone dgn order prior (valid); new = phone pertama kali di periode.
- `repeat_order_rate` = `repeat / (new + repeat) × 100`.

### 7b. Pengunjung (Kunjungan)

- Sumber: `performance_metrics.storefront_unique_visitors` (+ `performance_visitor_events`
  sebagai penyimpan unik per hari), dicatat middleware `TrackStorefrontPageView`.
- Satu pengunjung = satu sesi browser per hari (hash sesi), dihitung pada navigasi dokumen
  pertama; navigasi Inertia/partial reload tidak dihitung.
- **Batasan kontrak 2026-09-18:** kunjungan hanya dicatat bila permintaannya menyerupai
  navigasi browser manusia, yaitu User-Agent bukan bot/crawler/skrip, `Accept` memuat
  `text/html`, dan permintaan membawa cookie sesi atau header navigasi `Sec-Fetch`.
  Sebelumnya setiap permintaan tanpa cookie dihitung sebagai pengunjung baru, sehingga
  angka pengunjung membengkak (tinjauan 18 Sep 2026: sekitar 96% permintaan halaman depan
  berasal dari curl dan Python-urllib).
- **`Pengunjung yang Membeli` adalah rasio, bukan penautan sesi ke order:**
  `pembeli unik / pengunjung × 100`. Sistem tidak menyimpan relasi antara sesi kunjungan
  dan pesanan (pengunjung dikenali dari hash sesi, pembeli dari `customer_phone`), sehingga
  metrik ini TIDAK berarti "orang yang mengunjungi lalu membeli".
- Periode pembanding tanpa data (denominator 0) tidak menghasilkan persentase pertumbuhan;
  tampilkan "tanpa pembanding" alih-alih nilai pertumbuhan.

### 8. Produk

- `top_products` legacy dipertahankan utk compatibility
  (berbasis omzet dari `order_items`).

  `best_sellers` adalah ranking terpisah berdasarkan
  `SUM(order_items.quantity)` dalam revenue scope.
- `most_viewed` = ranking `product_views` (`performance_metrics`).
- `most_clicked` = ranking `product_clicks`.
- `best_sellers` = ranking `SUM(order_items.quantity)` pada revenue scope.
- **Product metrics adalah agregat harian** (`performance_metrics.metric_date`), bukan per-event;
  `views` = jumlah tampilan, bukan pengunjung unik.

### 9. Waktu dan comparison

- Timezone: WIB (`Asia/Jakarta`).
- Half-open range (`[start, end)`).
- Period & comparison memakai `resolveRange()` existing (termasuk `is_running` potong di jam sama).
- Retur aktif adalah snapshot current (bukan histori akhir periode).

### 10. Export / UI

- UI memakai Inertia + React + TypeScript (bukan Blade).
- Export XLSX memakai `report`/`service` yang sama (tidak ada query definisi beda).
- `payment_pending_amount` **deferred** (belum tampil; snapshot nominal pending belum reliable).
- Catatan: label financial card masih legacy ("Omset gross/Omset net/Penyesuaian refund") — keputusan
  polish di Open items.
- Catatan: `ProductEngagementContractTest` pre-existing failure (href route) — task terpisah.
- Catatan: tab "Produk Terpopuler" belum memakai `most_popular` (views+clicks) — lihat Open items.

---

## Non-goals

- Tidak ada tabel `product_views` per event (tetap agregat harian `performance_metrics`).
- Tidak ada settlement bank otomatis.
- Tidak ada nominal ongkir retur otomatis.
- ~~Tidak ada `payment_pending_amount` sampai ada snapshot yang reliable.~~
  DICABUT 2026-09-20: `cod_pending_amount`/`cod_pending_count` sudah dipakai di
  halaman dan di ekspor, dengan label lingkup "semua waktu". Snapshot dari
  `payments.status='pending'` diterima sebagai indikasi, bukan angka kas pasti.
- Tidak ada perubahan schema payment hanya untuk KPI.
- Tidak ada perubahan lifecycle retur/order dari ADR ini.

---

## Compatibility

Implementasi saat ini menjaga:

- `StorePerformanceService::build()` signature (`build(period, from, to, granularity)`).
- `resolveRange()`.
- Timezone WIB.
- Half-open boundary.
- Semua key legacy & section existing.
- React/Inertia (`StorePerformance.tsx`).
- Export XLSX (`AnalyticsController`).
- Test existing (termasuk contract, F10 rules, export, Task 1-3).

---

### 10. Cakupan data kunjungan

Pengunjung unik dihitung dari `sha1(session id)`, sehingga klien tanpa cookie
mendapat sesi baru pada setiap permintaan dan satu crawler terhitung banyak
pengunjung. Penyaring `isHumanBrowserVisit()` dipasang 2026-09-19 15:34 dan data
sebelum tanggal itu tercemar (audit menemukan 60 permintaan per jam rata sepanjang
24 jam, rasio halaman per pengunjung 1,08).

Konsekuensi yang mengikat:

- Data kunjungan yang layak dipercaya hanya sejak **2026-09-19**.
- Periode yang mulai sebelum tanggal itu **tidak boleh menampilkan** angka kunjungan
  dan konversi; tampilkan "Belum tersedia" beserta tanggal mulainya. Kalau dipaksa
  tampil, 7 pembeli dibagi 7 pengunjung terbaca konversi 100 persen.
- Pengunjung unik dihitung sebagai **jumlah harian**, bukan distinct sepanjang rentang,
  supaya angka kartu sama dengan total grafik tren.
- Tabel `performance_visitor_events` tidak boleh dikosongkan seluruhnya: bila kosong,
  `visitorsBetween()` jatuh ke jalur cadangan `performance_metrics`.

---

## Open items

Hanya:

- Apakah label legacy financial card akan dipoles (dari "Omset gross/Omset net/Penyesuaian refund"
  ke "Penjualan (Gross)/Penjualan Bersih")? Ini butuh keputusan pemilik; bukan perubahan ADR ini.
- Apakah key `most_popular` (views + clicks) akan ditambahkan utk tab "Produk Terpopuler"?
- Apakah `ProductEngagementContractTest` diperbaiki dalam task terpisah (pre-existing failure)?

### Tindak lanjut audit metrik 2026-09-20

Sudah dikerjakan: harga rata-rata per unit memakai nilai produk, refund disamakan
ke semua refund, ekspor berhenti mengurangi ongkir dan biaya COD paket ditolak dua
kali, pengunjung unik satu definisi, label snapshot dan konversi diperjelas, alamat
halaman tidak lagi membawa tanggal basi.

Belum dikerjakan, tercatat supaya tidak hilang:

- Rentang kustom terbalik ditukar diam-diam tanpa pemberitahuan ke pengguna.
- `products` hanya menghitung baris yang punya SKU varian, sehingga produk tanpa
  varian tidak terhitung; ada tiga ukuran berbeda (model, produk, unit) berdampingan.
- Rasio pembatalan dan rasio retur memakai pembilang dari tanggal kejadian sementara
  penyebut dari tanggal pesanan dibuat, sehingga rasionya bisa melewati 100 persen.
- `models` dan beberapa KPI lain ada di payload tetapi tidak dirender di halaman.
- Kunci bucket mingguan memakai tahun kalender di PHP dan tahun ISO di SQL, sehingga
  pekan di peralihan tahun bisa terbaca nol pada grafik.
- Halaman belum punya navigasi anchor meski terdiri dari enam bagian.

Tidak ada keputusan baru lain yang ditambahkan di draft ini.

---

## Konfirmasi

- Status keputusan ini Accepted (lihat bagian Status dan Tanggal approval di atas).
- Isi ADR ini berlaku sebagai kontrak: label, drawer, tabel Referensi, dan ekspor
  membaca deklarasi cakupan di `StorePerformanceService::METRIC_BASIS`.
- Perubahan yang mengikuti ADR ini selalu disertai test, karena setiap cakupan metrik
  dibuktikan dengan data di luar rentang, bukan dengan perbandingan nilai antar rentang.
- Tidak mengubah ADR existing.
## Revisi 2026-09-22 (Batch N+1)

### Kontrak keluaran baru (P0.4 + P0.5)

- `report.date_contract`: zona waktu aplikasi, semantik batas rentang, perilaku periode
  berjalan, cara pembandingan, dan aturan pengakuan penjualan. Catatan temuan terpisah:
  batas yang dipakai kode adalah INKLUSIF akhir hari (23:59:59.999999), bukan
  end_exclusive. Pergeseran ke end_exclusive tidak dikerjakan di dalam batch kontrak ini
  karena akan membolak-balikkan angka; ia dicatat sebagai pekerjaan tersendiri.
- `report.metric_basis[*].unit`: satu unit per metrik dari kosakata sah (rupiah, pesanan,
  pembayaran, unit, model, sub model, produk, kunjungan, orang, kasus, jam, hari, persen).
  Penjaga: `StorePerformanceMetricBasisTest`.
- Invarian keluaran dibuktikan pada dua rentang data live sebelum dan sesudah perubahan:
  hanya kunci baru yang bertambah, nol angka berubah.

### Kas Bersih per Produk (P0.1, ekspor pesanan)

- Kolom "Net Profit Toko per Produk (Kas Bersih)" pada ekspor pesanan diganti nama menjadi
  "Kas Bersih per Produk" (Sheet 1) dan "KAS BERSIH TOKO" (Sheet 2 Rekap).
- Statusnya: KONSEP TERPISAH dari Penjualan Bersih Performa Toko, bukan formula ganda yang
  salah. Bedanya: ongkir memakai tagihan asli J&T bila sudah dilaporkan, dan nilai barang
  retur tidak dikurangkan.
- Deklarasinya hidup di `OrderExport::EXPORT_BASIS` dan dijaga dua arah oleh
  `OrderExportContractTest`: tidak ada kolom uang tanpa deklarasi, tidak ada deklarasi
  untuk kolom yang bukan uang.
- Backlog #3 dan #14 ditutup sebagai keputusan, bukan bug.
