# Master Handoff - Ragil Aluminium

Tanggal: 2026-08-19
Sumber kebenaran: /root/ragilaluminium di VPS
Status release: BELUM BOLEH PRODUCTION RELEASE; UI/UX dan rekonsiliasi akhir masih berjalan.

## Tujuan

Dokumen ini menghubungkan keputusan owner, spesifikasi, audit browser, hasil subagent,
commit, verifikasi, blocker, dan antrean. Kontrak teknis tetap berada di docs/features,
docs/logic, schema, dan sitemap.

Status: LOCKED=keputusan owner; IMPLEMENTED=ada bukti; PARTIAL=sebagian;
OPEN=belum dikunci/dikerjakan; BLOCKED=menunggu perbaikan/otorisasi.

## Rujukan

- Keputusan: docs/spec-final-session.md, docs/PRODUCT-HANDOFF.md, docs/MEMORY.md
- Fitur: docs/features/00-index.md sampai 09-admin-information-architecture.md
- API/schema: docs/api-and-routes-ragil-aluminium.md dan docs/database-schema-ragil-aluminium.md
- Alur: docs/logic/ui-public-store-flows-ragil-aluminium.md dan ui-admin-flows-ragil-aluminium.md
- Sitemap: docs/sitemap/ dan docs/handoff-sitemap-end-to-end.md
- Audit: docs/WORKFLOW-AUDIT.md, docs/audit-ux-20260809/, docs/STOREFRONT-AUDIT-TODO.md
- Release: docs/FULL-STACK-PRODUCTION-CHECKLIST.md dan docs/production-readiness-plan.md

## Keputusan owner yang terkunci

### Data dan katalog

- Customer guest-only; tidak ada akun customer, email checkout, atau fallback email.
- Kepemilikan order memakai nomor order + nomor HP; snapshot/histori tidak boleh hilang.
- Copy publik Bahasa Indonesia. Kategori kanonik dinamis: jendela, pintu, boven.
- Harga katalog dari VPS; harga setiap varian manual; server menghitung ulang seluruh angka.
- Snapshot order adalah sumber histori; katalog live tidak boleh mengubah performa lama.
- Stok adalah angka tampilan. Toggle acak default aktif (700-5000); bila dimatikan,
  admin mengisi manual dan tetap dapat memperbaiki stok 0/rendah.
- Teruskan Popularitas: sinyal A dipakai menaikkan ranking B; A tetap aktif, bukan
  product family, ulasan A tampil di B saat aktif tanpa label, rantai A-B-C dicegah.

### Search tanpa AI

- Pipeline deterministik: typo, token, model/kategori, warna Putih/Hitam/Coklat/
  Serat Kayu, dan ukuran tinggi x panjang.
- 100x50 berarti tinggi 100 x panjang 50. Jika exact tidak ada, cari ukuran terdekat
  dalam range; jangan membalik otomatis ke 50x100.
- Typo confidence tinggi seperti slidding menjadi sliding. Query ambigu diarahkan ke
  atribut katalog yang ada; query asli tidak diganti diam-diam.

### Cart, checkout, alamat, ETA

- Tanpa mode select dan tanpa centang: semua item masuk checkout. Dengan select: hanya
  item dicentang. Catatan hanya per line item dan diisi sebelum alamat.
- Checkout menampilkan produk, promo, voucher, subsidi, ongkir, ETA, total. Email dihapus.
- Wilayah provinsi -> kabupaten/kota -> kecamatan -> desa. Kode pos readonly dan hanya
  dari dataset kredibel yang lolos quality gate. Mapping invalid tidak mengarang angka;
  alamat lengkap dipakai untuk konfirmasi ulang.
- Peta hanya fallback opsional; Google Maps bukan sumber kode pos dan kontraknya harus
  direkonsiliasi/rollback bila tersisa.
- Quote live saat alamat lengkap. Provider gagal berarti sedang menghitung atau estimasi
  lokal yang dihitung, bukan angka tetap Rp9.999; admin diberi notifikasi.
- Customer hanya melihat tanggal hasil estimasi + satu hari; rumus produksi/pengiriman
  internal tidak ditampilkan.

### Order, tracking, pembayaran, retur, ulasan

- Timeline: Menunggu Konfirmasi -> Sedang Diproses oleh Admin Gudang -> Sedang Dikirim
  -> Pesanan Sampai -> Pesanan Selesai.
- Cancel customer hanya sebelum konfirmasi; edit order hanya Menunggu Konfirmasi.
- Resi dibuat admin di web J&T; website hanya input nomor. Tracking raw/normalized
  immutable, idempotent, deduplicated; tidak ada Tandai Sampai manual.
- Transfer dapat Menunggu Pembayaran. COD paid otomatis saat completed dengan total_amount
  dan audit system/cod_completion. Biaya COD adalah persentase, bukan ongkir tambahan.
- Voucher stacking hanya bila semua voucher mengizinkan, setelah promo, boleh subsidi ongkir.
- Retur lewat WhatsApp setelah Sampai/Selesai; admin mengisi alasan wajib, item/qty,
  kronologi, evidence, resolusi, refund/penggantian, selisih harga/ongkir, transfer.
  issue adalah status internal; Retur Selesai tidak menentukan refund otomatis.
- Review hanya untuk item dibeli delivered/completed. Customer boleh edit (kembali
  moderasi). Admin tidak mengubah isi review customer; boleh tambah media/review admin.

### Media, import, admin

- Media Library dan media produk berbeda scope. Hasil Pemasangan bisa tertaut ke
  banyak produk; upload dari produk memakai konteks produk.
- Import memakai kunci jelas parent_sku; preset Shopee boleh; produk dapat langsung
  aktif bila kelengkapan otomatis terpenuhi.
- Performa Toko top-level; Dashboard hanya summary/follow-up. Import Performance ada
  di halaman Import. Semua admin setara; Log Aktivitas di Akun & Sistem.
- Rotasi session tidak boleh memutus WhatsApp.

## Sitemap terakhir

- Publik: Beranda, Model Produk, kategori/model/sub-model dinamis, detail, Cart,
  Checkout, order list/detail, Ulasan, Hasil Pemasangan, Panduan, Informasi, FAQ,
  Tentang, Syarat, Kebijakan.
- Kanonik: /products/jendela, /products/pintu, /products/boven, lalu model dinamis.
- /windows, /doors, /bouven sengaja 404. Alias /products/windows, /products/doors,
  /products/bouven hanya back-compat ke kategori Indonesia.
- Detail memakai parent SKU; query variant hanya SKU varian valid.
- Admin: Dashboard; Pesanan; Produk (Daftar, Import, Media, Sub Model); Promo/
  Flash Sale/Voucher; Performa; Customer; Ulasan; Hasil Pemasangan; Notifikasi;
  Akun & Sistem.

## Commit dan hasil subagent

- b2a8338: review backend + single-buffer ETA.
- 6a17643: ETA frontend tidak double buffer.
- cfe2e61: form review customer, ownership, moderation.
- 949c0a2: polish share, checkout copy, review, installation CTA.
- d99df27: catalog/PDP aman sebelum schema popularity.
- c3cf5d0: Playwright config/fixture kontrak terbaru.
- e3cd848: skeleton/shimmer katalog, galeri, instalasi, testimonial.
- 001438c: section Ulasan Website/Kami Bantu putih.
- abc371f dan 83a26d9: meta 11px; testimonial tanpa blur, overlay gelap.
- c458f0e: sticky CTA PDP mobile aman 320-430px.
- b8cb517: ikon Tentang Kami menjadi Info.
- 8dab8cf, fbee7ed, f285671, c217fb3: slug Indonesia, sitemap, test, handoff.
- 4ad01ab, 9e92c18, 4aed748: search, performa, promo/voucher/flash/COD.

Verifikasi yang dilaporkan:
- PHPUnit 340/4513 pada batch review/ETA; 430/5131 setelah contract/sitemap.
- Vitest 30 hijau (subset sebelumnya 27/27); typecheck/build hijau per batch.
- Browser 72 route/viewport checks pada 320, 360, 375, 390, 414, 430, 1024,
  1440px: 0 error, 0 document overflow. Playwright storefront desktop 11/11,
  mobile 10/10 + 1 performance skip.
- migrate --pretend --force lolos; bukan izin migration production.

## Visual audit selesai

Homepage Ulasan Website dan Kami Bantu putih; warranty/sold 11px; testimonial tidak
blur dan sedikit gelap; skeleton shimmer mencegah layout shift; share/sticky CTA aman;
ikon Tentang Kami Info.

## Temuan UI/UX terbuka

1. Hapus catatan dari Cart; catatan per produk di Checkout.
2. Perbaiki proporsi CTA product card mobile.
3. Percepat wilayah; kode pos di bawah desa, auto-fill readonly dataset kredibel.
4. Sembunyikan rumus ETA; tampilkan tanggal + satu hari.
5. Perbaiki padding confirmation/order dan konten tertutup sticky nav.
6. Tampilkan potongan promo/voucher/subsidi di subtotal card.
7. Selaraskan tombol /order, judul Pesanan Anda, list -> detail.
8. Perbaiki /admin/orders/{order}/status yang pernah 404.
9. Satukan status order dan tracking dalam satu timeline.
10. Audit visual desktop prioritas dan mobile banyak lebar.

## Handoff agent tanpa overlap

A Visual QA/polisher: browser live, desktop prioritas, mobile 320-430; padding,
clipping, hierarchy, CTA, loading/error, fixed layers, accessibility, alur 1/2/banyak.
Tidak mengubah schema, harga, status, API.

B Storefront integration: Cart, Checkout, order list/detail/timeline, review, share,
ETA, shipping copy; single/multi-product tanpa mock. Tidak mengubah admin IA/postal.

C Admin workflow/UI: Dashboard, Orders, Product/Import/Media, Promo/Voucher, Performa,
Review, Installation, Notifications, Akun/Sistem. Tidak membuat rumus KPI baru.

D Data/contract: snapshot, price/voucher/COD/subsidi, return ledger, performance,
idempotency, audit, schema/API, MySQL/SQLite. Tidak polish visual.

E Shipping/postal/J&T: versioned dataset/quality gate, quote/fallback, ETA, tracking,
readiness. Tidak memakai Google Maps sebagai postal dan tidak migration production.

F Media/import/R2: library, product media, installation multi-product, lifecycle,
mapping/preset, archive/restore/cleanup. Tidak mengubah order/performa.

G Release QA: regression matrix, tests, route smoke, browser evidence, migrate pretend,
backup/restore, queue/WhatsApp/R2/J&T readiness, rollback. Gate setelah A-F selesai.

## Blocker dan release gate

- Working tree VPS dirty milik beberapa agent; jangan reset/checkout/commit massal.
- Lint warning dari UI agent harus diperbaiki pemilik scope.
- Google Maps contract perlu rollback/reconcile.
- Dataset postal kredibel/quality gate masih prioritas; customer field readonly.
- Production migration, backup cutover, deploy graceful belum dimulai.
- Teruskan Popularitas, retur admin, dan alur admin perlu verifikasi browser/DB.
- DoD: temuan visual tertutup; checkout 1/2/banyak; order timeline/tracking/review/
  retur; admin tanpa dead end; full PHPUnit/Vitest/typecheck/lint/build/browser hijau;
  pretend migration, backup/restore, observability, rollback selesai.

## Protokol pembaruan

Setiap agent wajib mencatat scope, root cause bila bug, perubahan, test/evidence,
spec impact, dan blocker. Jangan menulis selesai tanpa bukti. Perubahan owner harus masuk
spec-final-session.md lalu disinkronkan ke feature/API/schema/sitemap.

