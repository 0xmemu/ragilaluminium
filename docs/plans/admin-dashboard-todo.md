# Admin Dashboard Todo

Status backlog untuk Beranda Admin Ragil Aluminium. Kerjakan dari atas ke
bawah. Satu item berstatus IN_PROGRESS pada satu waktu; setelah acceptance
criteria lulus, lanjut otomatis ke item berikutnya.

## Source of truth dan guardrail

- Perilaku: docs/PRODUCT-HANDOFF.md, schema, API/routes, dan Stage 9A/9B.
- UI: frontend/brand/BRAND-KIT.md, frontend/docs/DESIGN-SYSTEM.md,
  frontend/docs/UI-CONSISTENCY-CONTRACT.md, dan
  frontend/skills/ragil-admin-ui/SKILL.md.
- Integrasi: frontend/skills/ragil-ui-functional-integration/SKILL.md.
- Tidak membuat route, status, atau field schema baru tanpa kontrak.
- Tidak menghitung pending/cancelled/issue/return sebagai omzet.
- Tidak menampilkan laba sebelum harga modal/COGS dan kebijakan pengakuan
  pendapatan dikontrak.
- Tidak menjalankan reset/wipe database.

## Baseline selesai

- [x] D-01. Definisi omzet
  - Omzet memakai processing, shipped, delivered, completed.
  - Pending pembayaran, cancelled, issue, dan return dikecualikan.
- [x] D-02. Ringkasan nilai pesanan
  - Belum dibayar.
  - Pesanan aktif.
  - Pembayaran diterima hari ini.
  - Nilai antrean per status order.
- [x] D-03. Kejelasan UI omzet
  - Penjelasan tampil di kartu omzet.
  - Link menuju order pending_payment.
- [x] D-04. Kesiapan integrasi
  - WhatsApp, Media/R2, Queue, dan J&T.
  - Secret tidak pernah dikirim ke props atau UI.
- [x] D-05. Import dan media attention
  - Import gagal.
  - Attachment media gagal.
  - Shared asset gagal.
  - Media pending/downloading.
- [x] D-06. Regression coverage
  - Dashboard dan Store Performance.
  - Nilai omzet, pending, active, payment, import, dan media.

## P0 — Operasional harian

- [x] P0-01. Sinkronisasi status dan filter order
  - Acceptance:
    - Setiap kartu status membuka daftar Pesanan dengan filter yang sama.
    - Pending baru tidak masuk “Perlu Perhatian”.
    - Pending lebih dari 24 jam masuk “Perlu Perhatian”.
    - Count dan nilai kartu sama dengan query halaman Pesanan.
  - Kontrak: Stage 9A §4.1–4.2, Stage 9B §2.1.

- [x] P0-02. Pesanan terbaru sebagai work queue
  - Acceptance:
    - Menampilkan order terbaru dengan order/payment/shipping status.
    - Aksi Detail, WhatsApp, dan shipping memakai route nyata.
    - Mobile menampilkan informasi yang sama dengan tabel desktop.
    - Order cancelled tetap terlihat dengan label status yang jujur.
  - Kontrak: Stage 9A §4.3, Stage 9B §2.

- [x] P0-03. Alert dengan prioritas tindakan
  - Acceptance:
    - Alert diurutkan: payment overdue, processing overdue, delivered stale,
      return/issue, import/media, WhatsApp.
    - Alert kosong menjelaskan “tidak ada pekerjaan” tanpa angka palsu.
    - Setiap alert memiliki tujuan filter/detail yang valid.
  - Kontrak: Stage 9A §4.2, Stage 9B §8.

- [x] P0-04. Refresh dan freshness
  - Acceptance:
    - Tampilkan waktu data dashboard dibuat.
    - Admin dapat refresh tanpa kehilangan filter/periode.
    - Tidak melakukan polling eksternal otomatis.
    - Loading/error state terlihat dan tidak menampilkan angka stale sebagai
      data baru.
  - Backend support: props timestamp atau shared page state bila belum tersedia.

## P1 — Visibilitas bisnis dan katalog

- [x] P1-01. Panel ringkas import/media
  - Acceptance:
    - Job running, failed, completed terbaru, dan failed rows terlihat.
    - Media asset ready, pending, failed, dan archived dapat dibedakan.
    - CTA menuju Import atau Media, bukan aksi bulk dari dashboard.
  - Kontrak: Stage 5, Stage 6, Stage 9B §4–5.

- [x] P1-02. Aksi cepat berbasis pekerjaan nyata
  - Acceptance:
    - Tambah Produk → admin.products.create.
    - Mulai Import → admin.imports.create.
    - Buka Pending Payment → filter order.
    - Kelola Media → admin.media.index.
    - Tidak ada CTA yang hanya menampilkan toast tanpa side effect.

- [x] P1-03. Performa toko ringkas
  - Acceptance:
    - Periode dashboard memengaruhi KPI dan grafik.
    - Omzet, order, unit, visitor, conversion, customer baru, dan repeat
      customer konsisten dengan Store Performance.
    - Produk paling dilihat memakai analytics nyata, bukan angka demo.
  - Kontrak: Stage 9A §3, StorePerformanceService.

- [x] P1-04. Promo dan katalog
  - Acceptance:
    - Promo/Flash Sale hanya menampilkan atribut promo valid.
    - Status banner otomatis/manual tidak disimpulkan dari data palsu.
    - Link menuju pengelolaan produk/banner yang sesuai.
  - Kontrak: Stage 9A §2.2 dan §4.4.

- [x] P1-05. Status integrasi yang jujur
  - Acceptance:
    - Bedakan “credential configured” dan “worker/live connection verified”.
    - J&T/WhatsApp/R2/queue tidak menampilkan secret.
    - Production local disk dan sync queue ditandai perlu perhatian.
  - Backend/infra support: health check terpisah bila status live benar-benar
    diperlukan.
  - Selesai: badge dashboard membedakan konfigurasi tersedia dari koneksi live
    yang belum diverifikasi; J&T tidak lagi ditandai “Terhubung” hanya karena
    kredensial tersedia.

## P2 — Keuangan dan analitik lanjutan

- [x] P2-01. Payment settlement - DONE (2026-09-28)
  - Acceptance:
    - Rekonsiliasi berdasarkan payments.status=completed.
    - Tampilkan refund dan outstanding settlement.
    - Tidak mengganti status order secara langsung dari React.
  - Kontrak: PaymentService dan Stage 4.
  - Selesai: panel "Rekonsiliasi Pembayaran" pada halaman Pembayaran
    (Total Tagihan, Pembayaran Tercatat, Refund Tercatat, Sisa Tercatat,
    Status Rekonsiliasi, Catatan Verifikasi Admin) berbasis pencatatan
    website, tanpa klaim data bank. Test: PaymentRekonsiliasiTest (8 kasus).

- [ ] P2-02. Laporan laba
  - Acceptance:
    - Tambahkan harga modal/COGS hanya melalui keputusan schema resmi.
    - Simpan snapshot cost pada transaksi bila diperlukan.
    - Tampilkan laba kotor, margin, dan potensi laba dengan definisi tertulis.
  - Status: blocked until business/accounting policy is approved.

- [x] P2-03. Export dan pembanding periode - DONE (terverifikasi 2026-09-28)
  - Acceptance:
    - Export memakai query yang sama dengan dashboard.
    - Periode dan timezone tertulis di file.
    - Nilai export sama dengan halaman Performa Toko.
  - Selesai: StorePerformanceExport menerima payload build() yang sama dengan
    halaman (satu sumber query, recognizedOrderIds + METRIC_BASIS); sheet
    Ringkasan Finansial memakai financial_previous; zona waktu ada pada
    date_contract. Test: StorePerformanceExportTest (ringkasan pembanding,
    multi bulan, rentang kosong tidak menghasilkan persen palsu).

- [x] P2-04. Customer insight - DONE (terverifikasi 2026-09-28)
  - Acceptance:
    - Customer baru, repeat, total order, dan total spent konsisten dengan
      CustomerService/StorePerformanceService.
    - Tidak menampilkan nomor WhatsApp yang tidak terotorisasi secara terbuka.
  - Selesai: KPI Pelanggan Baru / Pelanggan Ulang / Total Pesanan / Penjualan
    Gross ada di Performa Toko dengan definisi tertulis di metric_basis
    (pengakuan yang sama dengan KPI penjualan); halaman Kelola Pelanggan
    menampilkan order_count dan total_spent dari CustomerService. Definisi:
    pelanggan baru = nomor yang pertama kali order valid pada periode;
    berulang = punya pesanan valid sebelum periode.

## Quality gate setiap item

- [ ] Feature test backend untuk query dan prop Inertia.
- [ ] Empty, loading, error, dan permission state.
- [ ] Responsive audit pada 360, 768, 1024, dan 1440 px.
- [ ] Keyboard focus dan target aksi minimal 44 px.
- [ ] ESLint/typecheck/build sesuai scope.
- [ ] git diff --check.
- [ ] Laporan agent memakai format wajib.

## Known blockers

- [SUPERSEDED 2026-09-28] Error TypeScript lama di
  resources/js/pages/Admin/Products/Media.tsx (assetFilters) dan
  resources/js/pages/Admin/ResourceIndex.tsx (Field) sudah tidak ada:
  npm run typecheck hijau penuh pada commit terbaru. Entri ini dipertahankan
  agar riwayat status lama tidak salah dibaca.

## Next execution item

Tidak ada item P1/P2 yang tersisa. P2-02 (laporan laba) tetap
blocked sampai kebijakan harga modal disetujui owner.

## Current implementation status

- Status: retur (edit teraudit, void administratif, retur manual pesanan
  Selesai), ongkir retur sebagai pengurang Penjualan Bersih, dan P2-01
  selesai; P2-03 dan P2-04 terverifikasi DONE.
- Last verified commit: lihat entri 2026-09-28 di docs/AGENT-LOG.md.
- Last verification date: 2026-09-28 (PHPUnit 1253 passed / 1 skipped,
  Vitest 230 passed, typecheck bersih, build sukses, ESLint bersih pada
  berkas yang disunting).
- Known limitations: filter periode halaman Pembayaran (basis created_at
  payment) berbagi berkas dengan rekonsiliasi; laporan laba (P2-02) tetap
  menunggu keputusan harga modal; ESLint global masih merah di berkas milik
  pekerjaan lain di luar scope ini.
- Open owner decisions: ongkir perjalanan balik J&T belum punya sumber angka
  otomatis; validasi subscribe J&T; KPI ongkir balik.
