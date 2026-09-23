# ADR-026: Frozen Contract Perhitungan v1

> **STATUS: Accepted (2026-09-23).** Kontrak perhitungan uang dan Performa Toko dibekukan
> pada versi 1.0.0 dan kini berada pada versi 1.0.1. Perubahan atas lapis manapun di bawah wajib melewati gerbang yang
> dijelaskan di bagian "Cara mengubah kontrak".

## Konteks

Owner menuntut satu angka, satu formula, satu tanggal acuan, satu unit. Rantai kerja
September 2026 (Batch 1 sampai N+1) sudah menata perhitungan ini: `METRIC_BASIS` sebagai
deklarasi cakupan, pengakuan penjualan beku berbasis `event_logs` (P0.2), kontrak tanggal
dan satuan di payload (P0.4 + P0.5), serta pemisahan nama Kas Bersih per Produk dari
Penjualan Bersih (P0.1). Yang belum ada adalah pagar yang membuat perubahan diam-diam atas
semua itu tidak mungkin lolos: sampai hari ini satu suntingan kecil bisa menggeser angka
laporan tanpa jejak yang wajib diikuti.

## Keputusan

### Versi kontrak

Kontrak ini bernomor versi **1.0.0**. Versi tercatat di tiga tempat yang wajib senada:
ADR ini, berkas expectation golden, dan komentar FROZEN pada berkas pemegang kontrak.

### Delapan lapis yang dibekukan

| Lapis | Isi | Pemegang kode | Penjaga |
|---|---|---|---|
| 1 | Batas rentang dan zona waktu: hari pertama inklusif, hari terakhir inklusif sampai 23:59:59.999999, periode berjalan dipotong ke waktu laporan | `resolveRange()`, `date_contract` di `build()` | Golden test + `StorePerformanceInputGuardTest` |
| 2 | Deklarasi metrik: cakupan, tanggal acuan, satuan | `METRIC_BASIS`, `metricBasisMap()` | `StorePerformanceMetricBasisTest` |
| 3 | Pengakuan penjualan: pesanan dibuat dalam periode dan tercatat mencapai Diproses pada `event_logs` paling lambat akhir periode | `recognizedOrderIds()` | `StorePerformanceRecognitionFreezeTest` |
| 4 | Rantai uang inti: Penjualan Gross, komponen ongkir, COD, refund, ongkir retur, nilai barang retur, Penjualan Bersih | `metricsFor()` + blok `financial` | Golden test |
| 5 | Pembayaran dan kas: Pembayaran Diterima, COD Selesai, kas COD belum cair sebagai tampilan piutang | `paymentCounts()` | Golden test |
| 6 | Retur dan pembatalan: kasus retur, refund, paket ditolak, rasio pembatalan dengan penyebut gabungan | `returnCounts()`, `cancellationCounts()`, `cancellationRate()` | Golden test |
| 7 | Permukaan turunan satu sumber: grafik, produk terlaris, pelanggan, campuran pembayaran, ongkir retur per kasus | `chartSeries()`, `topProducts()`, `productPerformanceBreakdowns()`, `customers()`, `paymentMix()` | Golden test + `StorePerformanceChartAlignmentTest` |
| 8 | Permukaan ekspor: Kas Bersih per Produk dan KAS BERSIH TOKO sebagai konsep terpisah dari Penjualan Bersih | `OrderExport` + `EXPORT_BASIS`; `StorePerformanceExport` membaca `METRIC_BASIS` | `OrderExportContractTest` (dua arah) |

`IncomeDetailQuery` sengaja tidak masuk delapan lapis: laporan itu adalah konsep terpisah
yang perbedaannya sudah diputuskan owner (backlog #3 ditutup sebagai keputusan), dan
perubahan atasnya tidak dianggap pelanggaran kontrak ini sampai ada keputusan baru.

### Golden test

`tests/Feature/StorePerformanceGoldenTest.php` menanam dataset deterministik yang memuat
semua kelas kejadian penentu angka: pesanan diakui, pembatalan pasca periode, pengakuan
telat, pesanan tanpa event, COD lunas saat sampai, paket ditolak, retur refund, pesanan
batal tanpa event, pembanding bulan sebelumnya, dan kunjungan. Jam laporan dibekukan lewat
`Carbon::setTestNow`, sehingga seluruh angka, termasuk seri grafik dan pembanding, tidak
bergantung jam eksekusi.

Seluruh keluaran `build()` dibekukan pada
`tests/Expectations/store-performance-golden-v1.json`. Test gagal bila satu angka pun
berubah. Angka expectation sudah diverifikasi terhadap hitungan manual dataset: Gross
4.950.000; Net 4.030.000; Pembayaran Diterima 3.500.000; pesanan diakui 5 dari 9; rasio
pembatalan 16,67 persen.

### Komentar FROZEN dan gerbang template PR

Berkas pemegang kontrak (`StorePerformanceService.php`, `OrderExport.php`) membawa komentar
header FROZEN yang menyebut ADR-026 dan versi kontrak. Kehadirannya dijaga test. Template
PR (`.github/PULL_REQUEST_TEMPLATE.md`) memuat Gerbang Kontrak Beku: PR yang menyentuh
berkas beku wajib memperbarui expectation di PR yang sama dan menaikkan versi kontrak.

### Di luar beku v1.0.0

Batas akhir rentang saat ini inklusif akhir hari, bukan `end_exclusive`. Pergeseran ke
`end_exclusive` mengubah angka laporan historis (restatement) dan **sengaja berada di luar
kontrak ini**; ia dikerjakan sebagai batch tersendiri setelah owner memutuskan soal
restatement. Hal yang sama berlaku untuk pengembangan mode historis status (P1.9) dan
rekonsiliasi kas (P1.6): keduanya additive dan tidak boleh mengubah angka delapan lapis
tanpa naik versi.

## Cara mengubah kontrak

1. Jalankan `GOLDEN_UPDATE=1 php artisan test --filter=StorePerformanceGoldenTest`, periksa
   selisih angka yang dihasilkan baris demi baris, dan pastikan setiap perubahan memang
   disengaja.
2. Naikkan versi: penambahan metrik atau field baru tanpa mengubah angka lama = naik PATCH
   atau MINOR; perubahan formula, batas tanggal, atau angka expectation lama = MINOR atau
   MAJOR sesuai dampaknya. Versi disamakan di ADR ini, berkas expectation, dan komentar
   FROZEN.
3. Sertakan berkas expectation baru, penjaga yang disesuaikan, dan penjelasan alasannya di
   PR yang sama. PR tanpa ketiganya ditolak oleh review, bukan oleh test saja.

## Konsekuensi

- Setiap perubahan angka perhitungan kini meninggalkan jejak wajib: berkas expectation yang
  berubah di PR yang sama, dengan alasan dan naik versi.
- Angka laporan menikah dengan dataset golden: kalau dataset harus diubah (misalnya ada
  kelas kejadian baru), perubahannya juga eksplisit lewat jalur yang sama.
- Test golden berjalan di SQLite in-memory, jadi angkanya disiplin untuk laporan, bukan
  untuk ketepatan SQLite versus MySQL; perbedaan dialek ditangani penjaga terpisah
  (`StorePerformanceF10RulesTest`).

## v1.0.1 (2026-09-23)

PATCH: teks penjelasan metrik `payments_received` diperluas untuk
menjelaskan titik lunas kedua metode, transfer setelah konfirmasi admin dan COD
saat barang sampai ke pembeli bukan saat setoran kurir. Tidak ada angka, formula,
cakupan, acuan, satuan, atau urutan yang berubah; expectation diperbarui lewat
GOLDEN_UPDATE dan versi kontrak disamakan di ADR ini, berkas expectation, dan
komentar FROZEN.
