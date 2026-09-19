# AUDIT E2E TINGKAT 2 · PERFORMA TOKO
## Fokus: konflik, perhitungan salah, istilah salah, kualitas sumber data, mekanisme, sampai berkas XLSX

| | |
|---|---|
| Tanggal | 19 September 2026 |
| Metode | e2e.md (Tingkat 1), e2e2.md (Tingkat 2 assurance + adversarial), gape2e.md (gap discovery) |
| Mode | READ ONLY, kecuali berkas XLSX sementara di `storage/app/private/` untuk pembacaan |
| Baseline | `docs/audit-performa-toko-e2e.md` dan addendum `8b9473d` |
| Environment | Produksi, Asia/Jakarta, commit saat audit |

---

## 1. ASSURANCE VERDICT

**NEEDS CORRECTION.** Arsitektur angkanya sehat (paritas lintas sheet terbukti), tetapi ada **4 temuan P1** yang membuat satu angka salah konteks, dua sumber data saling bertentangan, dan satu klaim di sheet Panduan tidak lagi benar setelah perubahan terakhir.

### Yang terbukti SEHAT (bukti kuat, hitung ulang independen dari database)

| Klaim | Hasil |
|---|---|
| Gross = jumlah komponennya | produk 29.103.000 − voucher 1.234.000 + ongkir 400.140 + asuransi 12.960 + COD fee 1.128.246 = **29.410.346**, selisih **0** |
| Gross UI = payload = XLSX | tabel kolom N = 29.410.346 = payload = Ringkasan. Untuk periode `all`: 96.234.146 ketiga-tiganya |
| Penjualan Bersih = rantai rumus | tabel (N−M+O+P+Q) = 27.824.540 = Ringkasan = payload. Periode `all`: 92.612.040 |
| Kas masuk | tabel kolom S = Ringkasan = payload (0 untuk periode ini; 20.410.000 untuk `all`) |
| Subsidi ongkir | tabel kolom U = payload (44.460 / 319.460) |
| Rumus P&L rantai benar | `B11=SUM(B6:B10)`, `B19=SUM(B14:B17)+B18`, `B21=B11+B19` |
| Total Row | `=SUBTOTAL(109,…)` benar, bukan `SUM` biasa |
| Order vs payment | 11 order valid, **semuanya** punya payment record; 0 order bertanda `paid` tanpa payment |
| Shipping vs order status | 0 konflik (tidak ada `delivered` di shipping dengan order belum sampai) |
| Titik waktu keuangan | kas memakai `paid_at`, penjualan memakai `created_at`, keduanya dinyatakan benar |

---

## 2. TEMUAN P1

### [P1-1] "COD Belum Selesai" menampilkan angka SEMUA WAKTU di dalam konteks periode terpilih

Masalah: pada periode ini halaman menampilkan **9 pesanan** sementara periode hanya berisi **4 order COD**. Nilainya Rp 75.824.146, padahal nilai COD periode ini hanya Rp 29.410.346. Selisihnya Rp 46.413.800.

Evidence:
- Hitung ulang: `cod_pending` semua waktu = 75.824.146; hanya periode ini = 29.410.346. Service mengembalikan 75.824.146.
- XLSX, **satu berkas yang sama**, dua angka berbeda: sheet Tabel Pesanan kolom "Belum Masuk" (Total Row) = **29.410.346**; sheet Ringkasan baris "COD (barang belum sampai)" = **75.824.146**.
- Pada periode `all` keduanya kebetulan sama, jadi konflik hanya muncul saat periode dibatasi.
- Di panel yang sama, "Pembayaran Diterima" memakai basis periode (`paid_at`), sehingga **dua kartu bersebelahan memakai cakupan waktu berbeda**.

Akar masalah: `paymentCounts()` tidak menerima parameter tanggal untuk hitungan pending. Ia menghitung `Payment::where('status','pending')->whereHas('order', …)` tanpa `whereBetween`, sementara `received` dan `cod` memakai `paid_at` dalam rentang. Diperkuat test `test_payment_pending_count_is_current_snapshot`.

Dampak: admin membaca 9 pesanan tertahan padahal periode itu hanya punya 4; pembaca laporan XLSX melihat dua angka berbeda untuk konsep yang sama.

Perbaikan minimum: pisahkan menjadi dua metrik bernama jelas, **"COD Belum Selesai (periode)"** memakai basis periode dan **"COD Berjalan (kondisi saat ini)"** memakai basis snapshot, lalu beri label eksplisit di UI dan di XLSX. Alternatif paling murah: beri keterangan cakupan "semua waktu" pada kartu dan baris XLSX.

Acceptance: pada periode `this_month`, kartu dan baris XLSX menampilkan angka yang sama dan cakupannya dinyatakan.

Confidence: High.

### [P1-2] Dua sumber data "Pengunjung Unik" bertentangan, tanpa aturan rekonsiliasi

Masalah: `performance_visitor_events` dan `performance_metrics` menyimpan metrik yang sama dengan angka berbeda, dan service memilih salah satu secara diam-diam.

Evidence (hitung ulang):

| Rentang | events | metrics | yang dilaporkan service |
|---|---|---|---|
| 01–31 Agt 2026 | 17.205 | 18.788 | **17.205** (metrics diabaikan) |
| 08–14 Agt 2026 | 0 | 1.443 | 1.443 (fallback jalan) |
| 15–31 Agt 2026 | 17.205 | 17.345 | 17.205 |
| 01–19 Sep 2026 | 26.817 | 26.873 | 26.817 |

Selisih terbesar **1.583 (9%)**. Rentang yang menyeberang 15 Agustus (mis. 1–31 Agt) **kehilangan** data 8–14 Agustus yang hanya ada di `performance_metrics` (1.443 pengunjung), karena begitu events tidak kosong, fallback tidak dipakai dan tidak ada penggabungan.

Akar masalah: migrasi ke tabel event tidak menghapus atau menandai data lama; `visitorsBetween()` memakai logika "events bila ada, jika tidak metrics" yang bersifat all-or-nothing.

Dampak: "Pengunjung Unik" dan "Pengunjung yang Membeli" (persentase konversi) tidak stabil; angka periode yang menyeberang 15 Agustus lebih rendah dari seharusnya. Dua sumber kebenaran = angka tidak dapat diaudit.

Perbaikan minimum: tetapkan satu sumber kanonik (events sejak 15 Agt) dan untuk periode yang dimulai sebelum tanggal itu, gabungkan: pakai metrics untuk hari sebelum 15 Agt dan events untuk sesudahnya, dengan catatan di UI/export bahwa periode lama memakai sumber agregat harian. Alternatif: batasi pemilih periode agar tidak melintasi batas migrasi, dan tandai periode lama sebagai "data agregat".

Acceptance: satu angka untuk satu rentang, dan cakupan sumber dinyatakan.

Confidence: High.

### [P1-3] Kolom "Periode Sebelumnya" saling bertentangan antar sheet di berkas yang sama

Masalah: sheet Ringkasan Finansial menulis "Tidak ada data" untuk 17 baris, sementara sheet KPI Operasional di berkas yang sama mengisi **37 angka** pembanding, padahal `previous_has_data = true`.

Evidence: pembacaan XLSX langsung. Ringkasan Finansial kolom C: 17× "Tidak ada data", 1 angka. KPI Operasional kolom C: 37 terisi, 0 "Tidak ada data".

Akar masalah: closure `moneyF`/`money` di `StorePerformanceExport` menulis string tetap pada kolom C/D; hanya sheet KPI yang memakai `previous_has_data` dan nilai `previous` dari payload.

Dampak: laporan unduhan kehilangan seluruh kolom perbandingan di halaman utamanya, sementara sheet lain menampilkannya. Pembaca menyimpulkan tidak ada data pembanding padahal ada (UI menghitung −57,1%).

Perbaikan minimum: teruskan `previous` + `change_percent` ke closure Ringkasan dengan guard `previous_has_data`.

Confidence: High.

### [P1-4] Baris "Nilai Barang Retur Ditolak" memutus rantai rumus yang dijanjikan sheet Panduan

Masalah: baris itu menulis **angka mati dari payload**, bukan rumus yang menunjuk Tabel Pesanan, dan **tidak ada kolom padanannya di Tabel Pesanan**.

Evidence:
- Ringkasan `B18` berisi `0` (angka), bukan `=…`. Bandingkan `B11 = =SUM(B6:B10)`.
- `B19 = =SUM(B14:B17)+B18` dan `B21 = B11+B19`, jadi penjualan bersih bergantung pada angka mati itu.
- Tabel Pesanan punya 25 kolom; kolom terkait retur hanya "Refund Retur" dan "Ongkir Retur (Toko)". Tidak ada kolom nilai barang retur ditolak.
- Sheet Panduan menyatakan verbatim: *"Setiap angka pendapatan dan beban adalah rumus SUM kolom Tabel Pesanan; klik selnya untuk melihat asalnya."*

Akar masalah: nilai ini tidak punya kolom di tabel karena sifatnya lintas pesanan, tetapi ditempatkan pada baris beban yang kontraknya berbasis rumus.

Dampak: klaim Panduan tidak lagi benar; pengguna yang mengklik sel tidak menemukan asalnya; bila angka berubah, tidak ikut terkoreksi dengan mengedit tabel.

Perbaikan minimum (pilih satu):
1. Tambahkan kolom "Nilai Barang Retur Ditolak" di Tabel Pesanan sehingga baris Ringkasan bisa berumus `SUM` seperti baris lain, atau
2. Pindahkan angka itu ke blok keterangan terpisah (bukan bagian rantai rumus P&L) dan sesuaikan kalimat Panduan.

Confidence: High. Catatan: temuan ini muncul dari perubahan saya sendiri (`8b9473d`) dan belum tertutup test.

---

## 3. TEMUAN P2

### [P2-1] Istilah "COD" dipakai untuk tiga makna berbeda
- **COD** (kartu Metode Pembayaran): basis **nilai order** → Rp 29.410.346 = 100% Penjualan Gross.
- **COD Selesai**: basis **kas** → Rp 0 (belum ada yang cair).
- **COD Belum Selesai**: basis **snapshot uang tertahan** → Rp 75.824.146.

Tiga angka dengan label sama di satu halaman. Perbaikan: beri keterangan basis pada tiap label, mis. "COD (nilai pesanan)", "COD selesai (uang masuk)", "COD berjalan (belum masuk)".

### [P2-2] Rentang kustom masa depan tampil terbalik
Belum diperbaiki dari audit sebelumnya. `build()` memutasi `range['to']` menjadi `now()` saat `is_running`, sehingga 20–25 Sep tampil "20 Sep 2026 - 19 Sep 2026".

### [P2-3] Snapshot tampil di periode kosong tanpa penanda
Periode Juli (pra-peluncuran) menampilkan "COD Belum Selesai 9" dan 18 badge "Tetap" yang menyatakan perbandingan tidak valid.

### [P2-4] Alasan kasus retur otomatis memakai "Lainnya", bukan kategori yang benar
Enum alasan di sistem: `rusak, pecah, salah_ukuran, salah_produk, kurang, lainnya`. Kasus retur otomatis untuk paket ditolak saya set `reason = 'lainnya'`. Kategori yang benar ("ditolak pembeli", "paket dikembalikan") belum ada. Dampak: analisis penyebab retur tidak bisa membedakan penolakan dari alasan lain. Perbaikan: tambah nilai enum baru plus labelnya.

### [P2-5] Satu konsep, dua nama di dua permukaan
UI: "Pembayaran Diterima". XLSX: "Total Pembayaran Sudah Diterima". Hal serupa: UI "Pembanding", legend grafik "Periode Lalu", XLSX "Periode Sebelumnya". Perbaikan: satukan istilah per konsep.

### [P2-6] "AOV" istilah Inggris di UI berbahasa Indonesia
Label KPI resmi di service sudah "Rata-rata Nilai Pesanan", tetapi UI menulis "AOV … per pesanan".

---

## 4. TEMUAN P3

- Rasio `storefront_page_views` ÷ `storefront_unique_visitors` hanya **1,14–1,42** (Sep: 30.737 ÷ 26.873). Untuk storefront, rasio serendah itu tidak wajar dan mengindikasikan metrik page view dihitung per sesi/hari, bukan per halaman. Tidak dipakai di halaman Performa Toko, jadi dampaknya nol saat ini, tetapi angkanya menyesatkan bila kelak dipakai.
- Label "Pengunjung yang Membeli" bernilai persen padahal berbunyi seperti jumlah. Sudah diterima owner lewat tooltip; dicatat sebagai utang istilah.
- Badge persen untuk metrik berbasis persen bisa menumpuk dua simbol persen (mis. nilai 100% dengan badge +100%).

---

## 5. KUALITAS SUMBER DATA (ringkasan status)

| Sumber | Baris | Rentang | Status |
|---|---|---|---|
| `performance_visitor_events` | 44.128 | 15 Agt 2026 – kini | Kanonik untuk kunjungan, tetapi bertentangan dengan metrics (P1-2) |
| `performance_metrics` (storefront_unique_visitors) | 43 | 08 Agt – kini | Turunan ganda; hanya dipakai sebagai fallback |
| `performance_metrics` (product_views / product_clicks) | 855 / 176 | 08 Agt – kini | Terisi (615 baris di periode ini); panel interaksi punya data |
| `orders` valid | 11 | Agu–Sep | Semua punya payment record |
| `order_return_cases` | 1 | - | Alasan "rusak"; belum ada kasus ditolak |

---

## 6. MEKANISME (hasil pemeriksaan kontrak)

| Mekanisme | Hasil |
|---|---|
| Granularitas band | Satu sumber (service), opsi = opsi pertama; teruji |
| Elapsed comparison (KPI-002) | Bekerja, tetapi menjadi **akar P2-2** karena memutasi `range['to']` |
| Idempotensi scan J&T | `firstOrCreate` + `event_hash` unik + guard stale → aman |
| Guard monotonic shipping | Regresi ditolak, tercatat warning; terbukti aktif (2 kejadian di log 17 Sep) |
| COD settle saat delivered | Hanya tanda terima asli (kode 100), bukan tanda terima retur (101) → uang tidak salah cair |
| Transisi shipped → retur | Baru dibuka; tertutup test |
| Penutupan payment saat retur selesai | Di dalam transaksi state machine; idempoten terhadap status pending |
| Export >31 hari | Sheet per bulan; belum dibandingkan sel-per-sel (limitasi) |

---

## 7. FALSE ASSURANCE SCAN

| Klaim yang tampak benar | Kenyataan | Bukti |
|---|---|---|
| "Setiap angka pendapatan dan beban adalah rumus SUM kolom Tabel Pesanan" | Baris retur ditolak adalah angka mati tanpa kolom di tabel | XLSX B18 = `0` |
| "COD Belum Selesai 9 pesanan" pada periode ini | Periode hanya punya 4 order; 9 adalah kondisi semua waktu | hitung ulang + XLSX |
| Kolom pembanding Ringkasan "Tidak ada data" | Data pembanding ada dan dipakai sheet lain | 37 sel terisi di sheet KPI |
| 66 test performa hijau | Tidak ada test untuk cakupan waktu snapshot maupun paritas antar sheet XLSX | daftar test |

---

## 8. COVERAGE MAP (12 dimensi), status terkini

| Dimensi | Status |
|---|---|
| Actor | COVERED (admin, tamu, middleware) |
| Entry point | COVERED |
| State | COVERED (default, refresh, empty, custom, export) |
| Data shape | COVERED (kosong, satu hari, 30 hari, 400 hari, nol, pembagi nol) |
| Time | COVERED kecuali transisi bulan/tahun langsung |
| Scale | PARTIAL (44 rb pengunjung; beban maksimum belum) |
| Permission | PARTIAL (middleware terbukti; role non-admin end-to-end belum) |
| Failure | COVERED (refreshError; build tanpa exception di 5 skenario) |
| Output | **COVERED sampai tingkat rumus dan paritas sel** (baru di audit ini) |
| Dependency | COVERED (Dashboard, tracker, engagement, ongkir J&T) |
| Platform | NOT APPLICABLE (panel admin wajib desktop) |
| Observability | PARTIAL (`generated_at` ada di payload, tidak dirender) |

---

## 9. REKOMENDASI DAN URUTAN

```text
Wave 1 (P1, wajib sebelum laporan dipakai pembukuan):
  1. Pisahkan/bedakan cakupan waktu "COD Belum Selesai" dengan label eksplisit
     di UI dan XLSX. Acceptance: satu angka, satu cakupan, dinyatakan.
  2. Tetapkan satu sumber kanonik pengunjung dan gabungkan data sebelum 15 Agt
     dengan aturan eksplisit. Acceptance: satu angka per rentang.
  3. Isi kolom pembanding Ringkasan Finansial dari payload dengan guard
     previous_has_data. Acceptance: kolom C/D terisi sama seperti sheet KPI.
  4. Rapikan baris retur ditolak: tambah kolom di Tabel Pesanan agar berumus,
     atau keluarkan dari rantai rumus dan sesuaikan kalimat Panduan.
     Acceptance: klaim Panduan benar kembali.
Wave 2 (P2):
  5. Beri keterangan basis pada ketiga label "COD".
  6. Perbaiki rentang masa depan (jangan mutasi range['to']).
  7. Penanda "kondisi saat ini" pada kartu snapshot.
  8. Tambah kategori alasan retur untuk paket ditolak.
  9. Satukan istilah per konsep (Pembayaran Diterima, Pembanding).
 10. Pakai label resmi "Rata-rata Nilai Pesanan" ganti "AOV".
Wave 3:
 11. Render generated_at sebagai indikator kesegaran.
 12. Periksa ulang definisi storefront_page_views.
Deferred:
 13. Export bulanan diperiksa sel-per-sel.
 14. Role non-admin end-to-end.
```

---

## 10. EVIDENCE APPENDIX

- Skrip audit (sementara, di `/tmp` VPS): `audit_recalc.php` (hitung ulang DB vs payload), `audit_xlsx.php` (semua sheet + klaim), `audit_xlsx2.php` (jalur export nyata + header 25 kolom + Total Row), `audit_formula.php` (rumus mentah vs klaim Panduan), `audit_twins2.php` (paritas sel antar sheet), `audit_istilah.php` (label + sumber data), `audit_sumber.php` (konflik dua sumber pengunjung + basis COD).
- Berkas XLSX bukti: `storage/app/private/audit-xlsx-full.xlsx`, `audit-parity-*.xlsx`, `audit-u.xlsx` (dapat dihapus; dibuat hanya untuk pembacaan).
- Angka kunci: Gross 29.410.346; Net 27.824.540; COD semua-waktu 75.824.146; COD periode 29.410.346; pengunjung events 26.817 vs metrics 26.873.
- Berkas sumber: `StorePerformanceService.php` (`:250` build dan mutasi range, `:452` metricsFor, `:676` paymentCounts, `:1166` visitorsBetween), `StorePerformanceExport.php` (Ringkasan `:338–397`, KPI `:501–519`, Panduan `:1095`), `StorePerformance.tsx`, `OrderStateMachine.php`, `ReturnService.php`, `ShippingService.php`.

---

## 11. LIMITASI

- Export rentang >31 hari belum dibandingkan sel-per-sel.
- Transisi bulan/tahun tidak diuji langsung (audit dalam satu hari kalender).
- Beban produksi maksimum tidak diuji.
- Role non-admin belum diuji end-to-end di browser.
- Berkas XLSX sementara masih ada di `storage/app/private/` dan perlu dibersihkan setelah audit.
