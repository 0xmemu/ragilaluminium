# AUDIT E2E · PERFORMA TOKO
## Tingkat 1 (Discovery) + Tingkat 2 (Assurance) + Gap Discovery

| | |
|---|---|
| Tanggal audit | 19 September 2026 |
| Metodologi | MASTER AUDIT MANDIRI E2E.md + METODOLOGI (e2e.md), AUDIT E2E TINGKAT 2 (e2e2.md), SKILL GAP DISCOVERY (gape2e.md) |
| Scope | Fitur Performa Toko end-to-end: route, controller, service, export, UI, dashboard, data source, test, dokumen |
| Mode | READ ONLY · INDEPENDENT ASSURANCE (tidak ada data diubah) |
| Environment | Produksi ra.333labs.tech, Asia/Jakarta, commit HEAD saat audit |

---

## 1. ASSURANCE VERDICT

**ASSURED WITH LIMITATIONS · NEEDS CORRECTION (2 temuan P1, 1 temuan P2 material)**

### Yang terbukti valid (evidence kuat, tiga layer)

1. Lineage finansial konsisten lintas layer. Gross Rp 96.234.146 = Penjualan Bersih Rp 27.824.540 + beban Rp 1.585.806 (UI = payload = XLSX = service). Arus kas terurai aditif tanpa sisa: Pembayaran Diterima Rp 20.410.000 + COD tertahan Rp 75.824.146 = Gross, persis.
2. Mesin granularitas berperilaku sesuai kontrak untuk 8 periode dan berbagai rentang: 1-2 hari Per Jam, 3-45 hari Per Hari (plus Per Minggu), 46-366 hari Per Bulan (plus Per Minggu), lebih dari setahun Per Tahun. Rentang tanggal terbalik di-swap dengan benar (18..01 Sep menjadi 01..18 Sep).
3. Timezone konsisten: app.timezone = Asia/Jakarta, now() dan seluruh startOfDay/endOfDay memakai WIB.
4. Permission tertutup: ketiga route analytics membawa Authenticate + EnsureUserIsAdmin (route:list JSON).
5. Dashboard memakai service sebagai read model kanonik (DashboardController.php:369-406), jadi parity dashboard dengan performa toko terjaga secara konstruksi.
6. Output parity nilai periode berjalan: XLSX Ringkasan Finansial = UI untuk Gross, Bersih, kas masuk, dan COD tertahan (9 pesanan, Rp 75.824.146).
7. Automated layer: 62 test khusus StorePerformance plus test terkait lulus; typecheck, eslint, build hijau.
8. Platform: panel admin adalah aplikasi desktop (keputusan owner 19 Sep 2026), sehingga audit mobile tidak berlaku; seluruh blok diverifikasi pada desktop 1440px.

### Temuan paling penting (ringkas)

| No | Temuan | Severity | Status |
|---|---|---|---|
| 1 | Rentang kustom masa depan ditampilkan TERBALIK ("20 Sep - 19 Sep") | P1 | NEEDS CORRECTION |
| 2 | Sheet Ringkasan Finansial XLSX: kolom pembanding selalu "Tidak ada data" padahal data pembanding ada | P1 | NEEDS CORRECTION |
| 3 | Snapshot kondisi saat ini (COD Belum Selesai, Transfer Pending) tampil di periode kosong mana pun tanpa penanda; 18 badge "Tetap" pada periode kosong | P1 | NEEDS CORRECTION |
| 4 | Sort basis panel/modal interaksi tidak dinyatakan di UI | P2 | belum dieksekusi |
| 5 | "AOV" istilah Inggris; label resmi KPI ("Rata-rata Nilai Pesanan") tidak dipakai UI | P2 | belum dieksekusi |
| 6 | generated_at dibangun ke payload (P0-2 freshness) tetapi tidak pernah dirender | P2 | belum dieksekusi |

### Yang belum terbukti

- Export bulanan (rentang lebih dari 31 hari) baru diverifikasi jalur kodenya, belum dibandingkan sel-per-sel.
- Data pengunjung historis pra-15 Agustus (fallback metrik harian) tidak dapat divalidasi ulang terhadap sumber aslinya.
- Beban produksi penuh (47 produk interaksi, puluhan ribu event) tidak diuji.

---

## 2. AUDIT CHARTER

```text
Scope owner      : Performa Toko (/admin/analytics/store-performance) dan seluruh yang berkaitan
Tujuan audit     : Membuktikan kebenaran angka, formula, alur, output, dan UX; menemukan
                   gap yang belum pernah diperiksa
Pengguna utama   : Owner/admin (monitoring bisnis harian)
Environment      : Produksi (read-only), Asia/Jakarta
Mode             : Read-only; write flows tidak dieksekusi
Kriteria sukses  : Setiap klaim punya minimal dua evidence; semua blok UI dipetakan;
                   skenario tidak-ideal diuji; laporan bisa ditelusuri
```

---

## 3. DISCOVERY INVENTORY

| Area | Artefak | Peran | Status |
|---|---|---|---|
| Route | web.php:340-342 store-performance, /export, /import-performance | Entry point admin | COVERED |
| Middleware | Authenticate + EnsureUserIsAdmin | Gerbang akses | COVERED |
| Controller | AnalyticsController:23 storePerformance, :84 exportStorePerformance, :162 importPerformance, :178 allowedGranularity | Orkestrasi | COVERED |
| Service | StorePerformanceService (35+ metode, lampiran A) | Read model kanonik | COVERED |
| Export | StorePerformanceExport (6 sheet), StorePerformanceMonthlyExport (lebih dari 31 hari, sheet per bulan) | Output | COVERED (bulanan partial) |
| UI | StorePerformance.tsx: 6 kartu, Rekonsiliasi 2 kolom, Operasional 5 tile + 15 indikator, Grafik + Kunjungan, Produk Terlaris + Interaksi, 2 modal, dialog export | Experience | COVERED |
| Dashboard | DashboardController.php:369-406 memakai service sebagai read model | Downstream | COVERED |
| Data source | orders, order_items, payments, order_return_cases, performance_metrics, performance_visitor_events, shipping_records, event_logs | Sumber fakta | COVERED |
| Tracker | TrackStorefrontPageView middleware, ProductEngagementService | Upstream data | COVERED (partial) |
| Test | 9 berkas, 62 test | Automated | COVERED |
| Docs | ADR-015, MEMORY.md, PRODUCT-HANDOFF.md | Kontrak | COVERED |
| Menu | Sidebar atas dan bottom nav | Navigasi | COVERED |

---

## 4. DATA LINEAGE & FORMULA CONTRACT

Semua KPI dipicu orders.created_at dalam rentang (WIB) dengan status REVENUE_STATUSES (processing, shipped, delivered, completed, return_in_process, return_completed) KECUALI yang dicatat lain.

| KPI | Formula | Source | Basis waktu | Catatan |
|---|---|---|---|---|
| Penjualan Gross | SUM(orders.total_amount) | orders, status valid | created_at | termasuk ongkir + biaya COD |
| Nilai Produk Terjual | SUM(subtotal_amount) | orders | created_at | sudah setelah potongan harga produk, sebelum voucher |
| Potongan Voucher | SUM(voucher_discount_amount) | orders | created_at | |
| Penjualan Bersih | gross - shippingRaw - codFees - refund - ongkirReturToko | gabungan | mengikuti gross | ongkir dasar = totalFreight J&T bila ada, selain itu asumsi checkout |
| Pembayaran Diterima | SUM(payments.amount) status=completed | payments | paid_at | hanya lunas |
| COD Selesai | idem, method=cod | payments | paid_at | |
| Pembayaran Transfer Pending | COUNT(payments pending non-cod, order OPEN_STATUSES) | payments+orders | SNAPSHOT (tanpa tanggal) | badge pembanding tidak bermakna |
| COD Belum Selesai | COUNT(payments pending cod, order REVENUE_STATUSES) | payments+orders | SNAPSHOT | amount tersedia (Rp 75,8 jt) tapi tak dirender |
| Pengunjung Unik | COUNT(DISTINCT visitor_hash); fallback SUM metric harian bila kosong | visitor events, metrics | visited_at / metric_date | fallback mengubah bucket granularitas (sudah dicek) |
| Pengunjung yang Membeli | buyers / visitors x 100 | orders distinct customer_phone | created_at | pembeli unik, bukan order |
| Pesanan Selesai | COUNT order_status=completed | orders | created_at | bukan completed_at |
| Retur | COUNT kasus | order_return_cases | created_at / completed_at | returns_open = snapshot |
| Rata-rata Waktu Konfirmasi | rata-rata event awaiting ke confirmed | event_logs | event time | naik = buruk |
| Produk Terlaris | SUM(order_items) join orders, urut revenue, top 50 | order_items | created_at | |
| best_sellers | query sama, urut unit | order_items | created_at | kini tidak dirender UI |

---

## 5. INDEPENDENT CONTRACT RECONSTRUCTION

| Contract item | Intended | Implemented | Experienced | Verdict |
|---|---|---|---|---|
| Rentang kustom masa depan | Tampil apa yang dipilih | range.to dimutasi ke now() saat is_running (Service:256-264) | "Rentang kustom (20 Sep 2026 - 19 Sep 2026)" terbalik | GAGAL |
| Kolom pembanding export | Terisi bila ada pembanding (docblock Export:331-333) | Ringkasan Finansial hardcoded "Tidak ada data"/"-" (Export:379,390); sheet KPI mengisi benar (:504-519) | XLSX "Tidak ada data" padahal pembanding 66,8 jt ada | GAGAL (kontradiksi antar sheet) |
| Snapshot vs periode | pending dan returns_open adalah kondisi saat ini (kode + test Task2:145) | Ditampilkan dalam konteks periode apa pun tanpa penanda | Periode Juli kosong menampilkan "COD Belum Selesai 9" | SEBAGIAN (konteks menyesatkan) |
| Persen pembanding | Delta di semua angka penting (permintaan owner 19 Sep) | 20 badge, semantik upIsBad benar | +97,1% waktu konfirmasi tampil merah | VALID |
| Tab Terlaris | (duplikat tabel Produk Terlaris) | Dihapus (75f440c) | Panel interaksi 2 tab | VALID (fixed) |
| Label transfer pending | "Pembayaran Transfer Pending", chip kembar dihapus (fd6419a) | Service dan UI diganti; badge snapshot dilepas | Kartu jujur: 0 pesanan | VALID (fixed) |
| Granularitas | Opsi mengikuti rentang; otomatis = opsi pertama | granularityOptions + defaultGranularity satu sumber | 8 periode diuji, semua cocok | VALID |
| Label AOV | KPI label resmi "Rata-rata Nilai Pesanan" (Service:272) | UI hardcode "AOV ... per pesanan" (TSX:830) | Istilah Inggris di UI Indonesia | GAGAL (P2) |

---

## 6. ASSURANCE MATRIX

| Area | Happy | Boundary | Error | Data parity | Output parity | UX live | Verdict |
|---|---|---|---|---|---|---|---|
| 6 kartu ringkas | COVERED | PARTIAL (delta -100% bilangan kecil) | COVERED | COVERED | PARTIAL (export kolom pembanding) | COVERED | ASSURED WITH LIMITATIONS |
| Rekonsiliasi | COVERED | COVERED (nilai 0) | n/a | COVERED (XLSX = UI) | PARTIAL (kolom C/D) | COVERED | ASSURED WITH LIMITATIONS |
| Arus Kas | COVERED | PARTIAL (snapshot di periode kosong) | n/a | COVERED | COVERED | COVERED | PARTIAL (konteks snapshot) |
| Operasional + retur | COVERED | PARTIAL (-100% dari 0 vs 1) | n/a | COVERED | n/a | COVERED | ASSURED |
| Grafik tren | COVERED | COVERED (fallback pengunjung dicek) | COVERED (refreshError) | COVERED | n/a | COVERED | ASSURED |
| Interaksi | COVERED | COVERED (47 produk) | COVERED (empty) | COVERED | n/a | COVERED | ASSURED |
| Export XLSX | COVERED | PARTIAL (monthly partial) | COVERED | COVERED | PARTIAL (kolom pembanding) | COVERED | ASSURED WITH LIMITATIONS |
| Permission | COVERED (middleware) | n/a | COVERED (guest 302) | n/a | n/a | COVERED | ASSURED |
| Mobile | NOT APPLICABLE: panel admin wajib desktop (keputusan owner 19 Sep 2026) | n/a | n/a | n/a | n/a | n/a | NOT APPLICABLE |

---

## 7. ADVERSARIAL SCENARIO RESULTS

| Skenario | Input | Hasil efektif | Verdict |
|---|---|---|---|
| Periode kosong (Juli, pra-peluncuran) | custom 01-31 Jul | build OK; gross 0; konversi 0%; 18 badge "Tetap"; snapshot COD 9 tampil | PARTIAL. Angka jujur, konteks menyesatkan |
| Tanggal terbalik | custom 18 Sep ke 01 Sep | di-swap menjadi 01-18 Sep | VALID |
| Satu hari tanpa data | custom 15 Jul | granularitas hour; build OK | VALID |
| Masa depan | custom 20-25 Sep | rentang tampil 20-19 Sep (terbalik); angka 0 | GAGAL (P1) |
| Rentang 400 hari | custom Agu 2025-Sep 2026 | granularitas month; build OK | VALID |
| Pembagi nol | periode tanpa pengunjung | konversi 0%, bukan NaN | VALID |
| Pembanding kosong | previous tanpa data | previous_has_data=false; badge "Tetap"/"Baru" | PARTIAL (lihat False Assurance) |
| Semua pembayaran pending adalah COD | DB: 15 pending cod, 0 transfer | transfer pending = 0, benar | VALID |

Bukti database: seluruh payment transfer hanya 1 record (completed, Rp 10.205.000, order 100006, dibayar 26 Agt 2026). Seluruh payment pending = 15, semuanya COD.

---

## 8. CROSS-DOMAIN & DOWNSTREAM

| Perubahan/fitur | Downstream | Status |
|---|---|---|
| Perbaikan granularitas (2e8152e) | dropdown UI dan otomatis grafik | aman, satu sumber (service) |
| Penghapusan injectConversionDetail | payload conversion detail | service tetap menyedia; test kontrak lulus |
| Perbaikan fallback visitor hour (eb1b301) | grafik Per Jam periode legacy | bucket tetap 24; seri 0 jujur |
| Snapshot pending | Dashboard | Dashboard tidak menampilkan pending; aman |
| Label Pembayaran Transfer Pending | Dashboard tidak memakai KPI ini | aman |
| Export monthly (lebih dari 31 hari) | sheet per bulan + suffix nama bulan | jalur kode dibaca; belum uji isi (limitasi) |

Tidak ditemukan regresi lintas domain dari perubahan periode audit ini.

---

## 9. COVERAGE MAP (12 DIMENSI)

| Dimensi | Cakupan | Bukti |
|---|---|---|
| 1. Actor | Admin terverifikasi; tamu 302; non-admin ditolak middleware | route:list, curl |
| 2. Entry point | Sidebar, bottom nav, deep link query period/from/to | browser |
| 3. State | default, refresh, error (refreshError), empty (Juli), custom, export dialog | browser |
| 4. Data shape | kosong, satu hari, 30 hari, 400 hari, nilai 0, pembagi 0 | probe service |
| 5. Time | today, yesterday, bulan berjalan, pembanding terpotong jam sama, masa depan, terbalik, multi-tahun, timezone WIB | probe + browser |
| 6. Scale | 47 produk interaksi, 44 ribu pengunjung; beban maksimum TIDAK diuji | PARTIAL |
| 7. Permission | tamu dan admin; role non-admin TIDAK diuji end-to-end (middleware saja) | PARTIAL |
| 8. Failure | refreshError path; build() tanpa exception pada 5 skenario | COVERED |
| 9. Output | XLSX 6 sheet dibandingkan; monthly PARTIAL | COVERED/PARTIAL |
| 10. Dependency | Dashboard, middleware tracker, engagement service, ongkir aktual J&T | COVERED |
| 11. Platform | desktop 1440px; mobile dan tablet NOT APPLICABLE (panel admin wajib desktop, keputusan owner 19 Sep 2026) | NOT APPLICABLE |
| 12. Observability | refreshError ada; generated_at TIDAK dirender; log server ada | GAP |

---

## 10. ASSUMPTION REGISTER

| Asumsi | Sumber | Dibuktikan? | Risiko jika salah | Status |
|---|---|---|---|---|
| Setiap payment completed punya paid_at | query paymentCounts (whereNotNull) | sebagian | uang lunas tidak terhitung | OPEN (guard eksplisit ada) |
| Setiap order COD punya record payments | asumsi ledger | sebagian | Pembayaran Diterima kurang | OPEN |
| WIB bermakna untuk pemilik dan pembeli | config app.timezone | YA | cutoff hari salah | COVERED |
| Snapshot pending memang yang diminta owner | test Task2:145 + komentar 2026-09-02 | YA (namun konteks UI menyesatkan) | salah baca | PARTIAL |
| Visitor event mencakup trafik sejak 15 Agt | DB: event sejak 2026-08-15 | YA untuk periode kini | pengunjung lama tak terhitung | COVERED (dengan fallback) |
| Total tagihan = nilai produk + voucher + ongkir + asuransi + COD | XLSX section I | YA (rekonsiliasi persis) | - | COVERED |

---

## 11. OMISSION SCAN

| Temuan | Klasifikasi | Dampak | Rekomendasi |
|---|---|---|---|
| generated_at ada di payload, tidak pernah dirender | OBSERVABILITY GAP | Admin tidak bisa membedakan data segar vs basi | Render indikator "Data diperbarui" di header |
| cod_pending_amount ada di payload, hanya count yang dirender | METRIC CANDIDATE | Owner tidak melihat nilai uang COD tertahan | Tampilkan nominal di kartu COD Belum Selesai |
| return_shipping_cost_list ada di payload, tidak dirender | DETAIL ONLY | minor | defer |
| Date picker memperbolehkan memilih masa depan | NEW ISSUE | rentang terbalik tampil | clamp di UI plus perbaikan service (P1 no.1) |
| Delta -100% pada 0 vs 1 pesanan | RISK (aritmetika benar, makna tipis) | minor | defer; keputusan owner 2026-09-15 mengunci +100% |
| Route import-performance hanya redirect | NOT APPLICABLE | tidak berdampak | biarkan |

---

## 12. CONTRADICTION SCAN

| Sisi A | Sisi B | Hasil |
|---|---|---|
| UI delta -57,1% (pembanding ada) | XLSX Ringkasan "Tidak ada data" | KONTRADIKSI (P1 no.2) |
| Sheet Ringkasan (hardcoded) | Sheet KPI Operasional (previous_has_data) | KONTRADIKSI antar sheet |
| Label "Pembanding:" (grafik) | Legend "Periode Lalu" (blok sama) | dua istilah, satu konteks (P2 minor) |
| Label KPI "Pengunjung yang Membeli" | nilainya persentase | label terdengar jumlah; hint menjelaskan (diterima owner) |
| COD 86,0 jt (Metode Pembayaran, nilai order) vs COD Selesai 10,2 jt (kas) | nominal sudah dipisah dari bauran | sudah dibereskan |
| ADR-015 "tanpa pembanding" | implementasi "+100% dari nol" (owner 2026-09-15) | keputusan terbaru menang; ADR-015 perlu pembaruan (doc gap) |

---

## 13. FALSE ASSURANCE SCAN

| Klaim yang tampak benar | Mengapa menyesatkan | Bukti | Perbaikan acceptance |
|---|---|---|---|
| "COD Belum Selesai 9 pesanan" pada periode Juli kosong | Snapshot hari ini tampil seolah bagian periode Juli | browser: periode Juli menampilkan 9 | beri label "kondisi saat ini" atau render hanya bila periode mencakup hari ini |
| 18 badge "Tetap" pada periode kosong | Kedua periode tidak valid; "Tetap" menyiratkan perbandingan sah | browser: periode Juli | pertimbangkan "Tanpa pembanding" untuk periode kosong penuh (ADR-015) |
| XLSX kolom "Tidak ada data" | Data pembanding sebenarnya ada (66,8 jt) | XLSX vs UI | isi dari payload (P1 no.2) |
| Rentang "20 Sep - 19 Sep" | Terlihat seperti pilihan sah; sebenarnya hasil clamp dan tidak diswap | probe resolveRange: dari/to benar sebelum mutasi build | jangan mutasi range.to (P1 no.1) |
| 62 test lulus | Tidak menguji render UI untuk periode kosong dan masa depan | tidak ada test tampilan | tambah assertion Inertia untuk is_running dan rentang terbalik |

---

## 14. OBSERVABILITY GAPS

| Flow | Sinyal gagal | Visibilitas | Gap |
|---|---|---|---|
| Data basi (payload lama) | generated_at | ada di payload, tak dirender | render indikator kesegaran |
| Refresh gagal | refreshError | COVERED (teks + tombol Refresh) | - |
| Rentang tidak valid | clamp diam-diam (safeParseDate fallback) | tidak terlihat user | rentang efektif sudah tampil; jangan terbalik |
| Export besar | ExportSafety::assertPerformancePayloadWithinLimit | ada guard | - |

---

## 15. TEMUAN P0-P3

### [P1] Rentang kustom masa depan tampil terbalik
Masalah: memilih 20-25 Sep menampilkan "Rentang kustom (20 Sep 2026 - 19 Sep 2026)".
Evidence: StorePerformanceService.php:256-264 (range.to dimutasi ke now() saat is_running); probe resolveRange membuktikan dari/to benar sebelum mutasi; UI live menampilkan terbalik.
Dampak: admin menganggap halaman rusak; laporan dengan periode berjalan menyimpan rentang yang menyesatkan.
Akar masalah: mutasi range untuk keperluan perbandingan elapsed (KPI-002) tanpa menjaga urutan from/to tampilan.
Perbaikan minimum: jangan mutasi range.to; simpan to efektif terpisah untuk metrics dan label Pembanding.
Non-scope: perilaku pembanding elapsed (KPI-002) tetap.
Acceptance: memilih rentang berakhir masa depan menampilkan "20 Sep - 25 Sep"; grafik terpotong di hari ini.
Confidence: High.

### [P1] Export Ringkasan Finansial tidak mengisi kolom pembanding
Masalah: kolom "Periode Sebelumnya" dan "Perubahan" selalu "Tidak ada data" dan "-" padahal pembanding ada.
Evidence: StorePerformanceExport.php:379,390 (hardcoded); kontras dengan :504-519 yang memakai previous_has_data; XLSX nyata menampilkan "Tidak ada data" pada periode dengan pembanding 66,8 jt.
Dampak: laporan unduhan kehilangan kolom perbandingan yang dijanjikan headernya sendiri.
Akar masalah: closure moneyF/money tidak menerima nilai pembanding; hanya sheet KPI yang diimplementasikan.
Perbaikan minimum: teruskan previous dan change dari payload ke closure, dengan guard previous_has_data.
Acceptance: periode berpembanding menghasilkan kolom C/D terisi; periode tanpa pembanding tetap "Tidak ada data".
Confidence: High.

### [P1] Snapshot kondisi saat ini tampil sebagai bagian periode (false assurance)
Masalah: kartu "COD Belum Selesai" dan "Pembayaran Transfer Pending" tampil bernilai sama di periode kosong (Juli) maupun periode aktif; 18 badge "Tetap" menyatakan perbandingan yang tidak valid.
Evidence: browser periode Juli; e2e2 10.3; gape2e 2.2.
Dampak: admin membaca kondisi hari ini sebagai data periode masa lalu.
Akar masalah: metrik snapshot memang tanpa periode; UI tidak membedakannya.
Perbaikan minimum: penanda kecil "kondisi saat ini" pada kedua kartu snapshot, atau tampilkan nilai snapshot hanya ketika rentang mencakup hari ini.
Acceptance: pada periode yang tidak mencakup hari ini, kartu snapshot berlabel eksplisit.
Confidence: High.

### [P2] Sort basis interaksi tidak dinyatakan; "AOV" Inggris; "Pembanding" vs "Periode Lalu"; COD 9 vs 15 tidak dijelaskan di permukaan
Sudah dijelaskan ke owner secara verbal; menunggu eksekusi UI.

### [P3] Penulisan
"Pembanding: Rp 66.823.800" berdampingan dengan legend "Periode Lalu": pertimbangkan menyatukan istilah.

---

## 16. RESIDUAL RISK REGISTER

| Risiko | Mengapa belum tertutup | Dampak | Mitigasi | Next step |
|---|---|---|---|---|
| Export monthly lebih dari 31 hari belum diverifikasi isi | butuh fixture payload besar | rendah | kode dibaca; guard ExportSafety ada | uji saat data memenuhi syarat |
| Role non-admin end-to-end | middleware terverifikasi, UI role belum | rendah | EnsureUserIsAdmin | uji dengan akun customer |
| Tablet, zoom, mobile | NOT APPLICABLE: panel admin wajib desktop (keputusan owner 19 Sep 2026) | n/a | n/a | - | tertutup keputusan |
| Data pengunjung pra-event | fallback metric harian | rendah | fallback teruji untuk day | - |
| Performa query rentang panjang | 400 hari build OK pada data kini | sedang jika data membesar | guard ExportSafety | monitoring |

---

## 17. REKOMENDASI & ROADMAP

```text
Wave 1 (sekarang, P1):
  1. Jangan mutasi range.to di build(); pisahkan to efektif untuk metrik.
     Acceptance: rentang berakhir masa depan tampil urut.
  2. Isi kolom C/D Ringkasan Finansial dari payload, guard previous_has_data.
     Acceptance: kolom pembanding XLSX = UI.
  3. Penanda "kondisi saat ini" pada kartu snapshot.
Wave 2 (P2):
  4. Caption basis urutan panel dan modal interaksi; metrik penentu ditonjolkan.
  5. Ganti "AOV" dengan label resmi KPI.
  6. Satukan istilah "Pembanding" dan "Periode Lalu".
  7. Render generated_at sebagai indikator kesegaran.
Deferred:
  8. Delta -100% pada bilangan kecil (keputusan owner 2026-09-15 berlaku).
  9. Uji role non-admin end-to-end (mobile dan tablet NOT APPLICABLE, keputusan owner).
Rejected:
  10. Menghapus best_sellers dari service (kontrak teruji Task3Test).
```

---

## 18. EVIDENCE APPENDIX

- routes/web.php:340-342, tiga route analytics dan middleware.
- AnalyticsController.php:23 storePerformance, :84 export (monthly lebih dari 31 hari), :178 allowedGranularity.
- StorePerformanceService.php: :43 safeParseDate, :61 resolveRange dan swap :113, :156 spanDays, :179 granularityOptions, :214 defaultGranularity, :250 build dan mutasi range :256-264, :271-278 salesKpis, :308 payment_pending_count, :382 financial, :452 metricsFor (:454 base created_at, :543-549 netRevenue), :642 returnCounts (open snapshot), :676 paymentCounts (pending snapshot, lunas paid_at), :880 cancellationCounts, :926 breakdowns, :1032 topProducts, :1108 paymentMix, :1166 visitorsBetween (fallback harian), :1251 bucketSelect, :1278 dan :1290 rata-rata durasi, :1317 kpi (aturan +100% owner 2026-09-15), :1371 emptyBuckets, :1440 paidRevenueStatusSql.
- StorePerformanceExport.php: :338-397 Ringkasan (kolom C/D hardcoded), :501-519 KPI (previous_has_data), :1095 panduan.
- StorePerformance.tsx: Layer 1-5, modal, dialog export.
- DashboardController.php:369-406: service sebagai read model.
- Probe: /tmp/boundary3.php (5 skenario), /tmp/rr.php (resolveRange mentah), /tmp/codprobe.php (0 transfer pending; 15 COD pending; 9 pada alur; Rp 75.824.146), /tmp/exportcheck2.php (XLSX 20.287 byte, 6 sheet, nilai = UI), /tmp/gran_probe2.php (band granularitas).
- Browser: periode kosong Juli, rentang masa depan terbalik, desktop 1440px, panel interaksi 2 tab.
- Test: 62 lulus (filter StorePerformance), 82 lulus (gabungan analytics, dashboard, import).

---

## 19. LIMITASI AUDIT

- Export bulanan (rentang lebih dari 31 hari) belum dibandingkan sel-per-sel.
- Role non-admin belum diuji end-to-end di browser.
- Beban produksi maksimum tidak diuji.
- Audit dilakukan pada satu hari kalender (19 Sep 2026); transisi bulan dan tahun tidak diuji langsung, hanya ditelusuri dari kode.

---

## 20. ADDENDUM 19 SEPTEMBER 2026 - TINDAK LANJUT TEMUAN STATE MACHINE

Temuan negative space (pesanan ditolak kurir sebelum lunas) dieksekusi pada
commit 8b9473d:

- Transisi shipped ke return_in_process kini legal (admin dan carrier);
  cascade returned dari kurir otomatis memindahkan pesanan dan membuat kasus
  retur (open, fault_party other, tanpa restore stok).
- Penutupan retur (return_completed) pada pesanan belum lunas menandai
  payment pending menjadi cancelled di dalam transaksi state machine.
- Performa Toko: KPI Pesanan Ditolak di blok Retur, dan baris Nilai Barang
  Pesanan Ditolak di Rekonsiliasi yang mengeluarkan nilai barang dari
  Penjualan Bersih saat retur selesai; Export XLSX menambah baris yang sama
  di seksi beban supaya rumus Penjualan Bersih tetap sinkron dengan UI.
- ADR-006 diperbarui.

Status temuan: TUTUP (dengan keputusan owner 19 Sep 2026: tanpa restore stok,
biaya lewat jalur retur). Sisanya sesuai daftar temuan di atas.
