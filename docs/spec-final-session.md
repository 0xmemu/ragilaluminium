# Spesifikasi Final Sesi — Ragil Aluminium

Tanggal konsolidasi: 2026-08-16. Dokumen ini merangkum keputusan bisnis dan UX yang dikunci selama sesi, status implementasi yang terlihat di VPS, serta pekerjaan yang masih terbuka. Ia menjadi rujukan penghubung untuk desain UI, backend/API, database, QA, dan handoff antar-agent; dokumen feature dan schema/API tetap menjadi kontrak teknis rinci.

## Cara membaca status

- **LOCKED** — keputusan owner; implementasi wajib mengikuti.
- **IMPLEMENTED** — ada runtime/test/commit yang dapat dirujuk, tetapi tetap tunduk pada kontrak locked.
- **PARTIAL** — sebagian alur ada atau kontrak belum tersinkron di semua layer.
- **OPEN** — belum diputuskan; jangan mengarang route, enum, schema, atau copy final.
- **ROLLBACK REQUIRED** — commit/runtime saat ini bertentangan dengan keputusan terbaru dan harus direkonsiliasi oleh batch kode berikutnya.

## Keputusan lintas fitur

1. Customer tetap guest. Tidak ada akun customer, email, atau fallback email. Kepemilikan order memakai nomor order + nomor HP sesuai validasi.
2. Harga produk VPS menjadi sumber harga katalog; harga varian diinput manual. Server selalu menghitung ulang harga efektif, promo, voucher, ongkir, subsidi, dan total.
3. Transaksi, snapshot order, event, refund, dan audit diarsipkan/immutable sesuai kontrak; jangan hard-delete histori.
4. User-facing copy berbahasa Indonesia. Semua loading, empty, unavailable, validation, retry, dan error harus jujur; tidak boleh ada angka, status, atau tracking palsu.
5. Perubahan penting harus masuk satu timeline **Riwayat Pesanan** customer/admin dengan timestamp, actor, status, shipping, edit, return, dan komunikasi yang aman. Catatan/evidence internal tidak bocor ke customer.
6. WhatsApp adalah kanal operasional independen dari sesi login web-admin: queue, retry, webhook, reconnect, dan delivery audit tetap berjalan tanpa admin sedang login. Email tidak ditambahkan.
7. Kode pos tidak berasal dari provider peta. Dataset internal hanya dapat mengisi field readonly setelah quality gate; data dapat direvisi melalui versi dataset dan selalu direcheck terhadap wilayah terpilih. Jika mapping kosong/tidak terverifikasi, kode pos tetap blank dan customer diminta konfirmasi ulang alamat/pencarian wilayah. Manual review hanya untuk kegagalan quote/provider ongkir.

## 1. Search pintar tanpa AI — LOCKED, PARTIAL

Search deterministik, explainable, fixture-testable, tanpa AI/LLM/image search. Pipeline trim/case-fold, tokenisasi, parser ukuran tinggi × panjang, taxonomy/warna, typo deterministik, scope produk aktif, lalu ranking.

- Exact produk/model/kategori/warna lebih dahulu.
- `100x50` berarti tinggi 100 × panjang 50; bila exact tidak ada, cari ukuran terdekat berdasarkan distance/range dan tampilkan label “ukuran paling mendekati”. Jangan menjadikan `50x100` rekomendasi default.
- Typo confidence tinggi seperti `slidding` dinormalisasi ke istilah katalog `sliding`; perilaku harus terasa seperti Google Search, namun raw query tetap tersedia untuk konteks/analitik dan sistem tidak mengarang produk.
- Query ambigu seperti “minimalis”/“modern” diarahkan ke saran yang benar-benar tersedia: model, model bukaan, ukuran, kategori, warna, atau atribut katalog.
- “Abu doff” tidak boleh menjadi varian karena varian resmi hanya Putih, Hitam, Coklat, Serat Kayu.
- Loading mempertahankan query; empty/error memberi retry, clear, dan saran valid. Threshold, tier, sinonim, retention analytics, dan admin cross-search masih OPEN.

Rujukan: `docs/features/01-search.md`. Target belum dianggap selesai sampai ranking dan edge cases memiliki test deterministik.

## 2. Share Produk — LOCKED, belum diimplementasikan penuh

Ikon Bagikan di PDP membuka Native Web Share jika tersedia, dengan fallback WhatsApp atau Salin Link. URL canonical membawa konteks variant yang valid; copy berisi nama/varian/link. Share tidak mengubah cart atau pilihan varian, tidak memiliki nomor tujuan tetap, dan berbeda dari Konsultasi ke nomor bisnis/order notification. Tidak ada PII/order/referral. Analytics share hanya jika kontrak agregat diputuskan kemudian.

Rujukan: `docs/features/02-share-product.md`. Commit coding belum menjadi bukti selesai.

## 3. Cart dan Checkout Guest — LOCKED, PARTIAL

- Jika mode select belum diaktifkan dan tidak ada item dicentang, **semua** item cart masuk checkout. Jika mode select aktif, hanya item dicentang yang masuk; item lain tetap di cart.
- Catatan hanya per satuan produk/line item dan diisi sebelum alamat. Tidak ada catatan alamat/global.
- Checkout menampilkan item, harga efektif, ongkir normal, subsidi, net, ETA display, dan total. Email dihapus sepenuhnya.
- Server memvalidasi stok/varian/alamat/metode bayar dan menghitung ulang seluruh angka. Submit memakai idempotency; retry/WhatsApp failure tidak menggandakan order.
- COD unavailable dijelaskan saat user memilih metode pembayaran dan Transfer ditawarkan. COD reason bukan error generik.
- Nomor order mengikuti kontrak VPS yang sudah berjalan. Order baru masuk Menunggu Konfirmasi; edit order hanya diperbolehkan sebelum konfirmasi.

Rujukan: `docs/features/03-cart-checkout.md`, `docs/PRODUCT-HANDOFF.md`, commit `c09f969`/`b9ada3f`. Instruksi transfer, reserve policy, dan beberapa adapter provider masih OPEN.

## 4. Alamat, kode pos, dan ongkir — LOCKED, PARTIAL, ROLLBACK REQUIRED untuk Maps

- Flow wilayah: provinsi → kabupaten/kota → kecamatan → desa. Dataset baseline Satu Data Indonesia/data.go.id, dengan Pos Indonesia sebagai cross-check.
- Dataset versioned (`source`, `version`, checksum, status, coverage, integrity, verified review). Hanya dataset aktif yang lolos quality gate boleh memberi auto-fill.
- Field kode pos readonly bagi customer. Server recheck terhadap desa/kecamatan terpilih bila mapping tersedia. Dataset bukan kebenaran absolut yang tak dapat direvisi, tetapi customer juga tidak memasukkan postal code manual.
- Mapping kosong/tidak terverifikasi: tampilkan blank + konfirmasi ulang alamat lengkap/pencarian wilayah. Jangan mengambil postal code dari Maps/provider. Titik lokasi/peta hanya fallback opsional untuk membantu menemukan/mengonfirmasi konteks alamat.
- Quote memakai destination/berat/dimensi/service dan menampilkan normal, subsidi, net, serta ETA display. Provider/quote failure → state manual review; tidak boleh partial order atau angka palsu.
- Notifikasi ikon admin harus dedupe per order dan actionable. Admin dapat edit ongkir, subsidi, total dengan alasan wajib; nilai terbaru masuk timeline/audit dan WhatsApp dapat dikirim ulang.
- Resi dibuat di J&T di luar website; web hanya menerima input nomor resi manual. Refresh harus jujur membedakan success/data berubah, stale/tidak ada event/integrasi belum siap, dan error.

**ROLLBACK REQUIRED:** commit `65a337e` menambahkan Google Maps geocoding contract; itu bukan keputusan final. Kontrak final tidak memiliki endpoint/API key Google Maps untuk postal. Docs telah diselaraskan di `34e2aa1` dan batch kode berikutnya harus menghapus runtime contract tersebut.

Rujukan: `docs/features/04-address-shipping.md`, bagian Postal & Shipping di `docs/api-and-routes-ragil-aluminium.md`, §14 schema postal, commit `e300442`, `b62b8ea`, `ef07bfa`, `77e2071`, `34e2aa1`.

## 5. Order lifecycle dan status — LOCKED, PARTIAL

Status normal: Menunggu Konfirmasi → Pesanan Diproses → Sedang Dikirim → Pesanan Sampai → Pesanan Selesai. Exception: Pesanan Dibatalkan, Retur Diproses, Retur Selesai. `issue` adalah status internal/exception, bukan retur dan bukan label customer.

- Customer dapat membatalkan hanya saat belum dikonfirmasi/pending. Admin memproses status sesuai guard dan alasan.
- Edit order hanya saat Menunggu Konfirmasi. Setelah itu snapshot dan histori dikunci, kecuali adjustment workflow yang terdokumentasi.
- `GET /admin/orders/{order}/status` hanya handoff ke detail/status UI; perubahan status memakai `PUT`. Label/status harus memakai bahasa yang sama di list, detail, dan timeline.
- `delivered/Sampai` datang dari tracking terverifikasi; tidak ada tombol manual “Tandai Sampai”. Retur customer bukan saat paket masih dikirim.
- Customer dan admin memakai satu timeline Riwayat Pesanan; customer hanya melihat status, timestamp, tracking, CTA, dan notifikasi aman.

Rujukan: `docs/features/05-order-lifecycle.md`, `docs/api-and-routes-ragil-aluminium.md`, commits `b1a5e97`, `6184ac7`, `15c4639`. Enum `return_completed`/`completed` dan transisi lama masih harus diaudit lintas contract sebelum rename/migration.

## 6. Tracking — LOCKED target, PARTIAL

Customer dan admin memerlukan panel tracking visual: courier/service, nomor resi, normalized status, last update/source, ETA, dan scan timeline. Empty states: resi belum diterbitkan, menunggu tracking, invalid, provider unavailable, atau stale. Refresh idempotent dan tidak optimistic; provider failure tidak boleh menghasilkan delivered. Adapter J&T bertahap, tetapi UI/contract harus usable sebelum integrasi live siap.

Admin tidak mengubah delivered secara manual. Event webhook/refresh harus signature/idempotency, dedupe scan, retry/backoff, rate limit, dan redaction token/PII.

Rujukan: `docs/features/06-tracking.md`, `docs/api-and-routes-ragil-aluminium.md`, commits `5fa8ceb`, `590bdcc`.

## 7. Retur, refund, dan penggantian — LOCKED, PARTIAL

Retur customer dimulai melalui WhatsApp setelah Pesanan Sampai atau Selesai; tidak ada form retur publik. Admin mengisi form internal. Reason wajib (rusak/pecah/salah ukuran/salah produk/kurang/lainnya), kronologi, item/qty, inspeksi, evidence/reference pesan, actor, dan timestamp.

Resolution mengikuti hasil diskusi customer-admin: refund penuh/sebagian, replacement/variant/size/qty, reship, kompensasi, selisih harga, ongkir tambahan/subsidi, atau tanpa kompensasi. Admin mencatat amount/method/date/reference/proof serta catatan refund/transfer. `Retur Selesai` berarti case dan dokumentasi selesai, bukan otomatis berarti refund tertentu.

`issue` tetap status internal dan tidak dihitung sebagai retur. Return case/items/returned quantity/financial adjustment adalah ledger terstruktur; completion wajib memiliki resolution dan dokumentasi. Semua perubahan masuk Riwayat Pesanan/audit. Dampak Performa Toko dihitung dari barang yang benar-benar kembali dan adjustment/resolution, bukan sekadar label status.

Rujukan: `docs/features/07-return-refund.md`, §14 return schema, commit `3562157`. Pekerjaan form/evidence/refund admin dan approval/SLA masih perlu rekonsiliasi end-to-end.

## 8. Performa Toko — LOCKED contract, P0/P1 backend/UI sebagian

Performa Toko adalah fitur unggulan dan menu top-level. UI memakai periode/timezone/granularitas konsisten, financial summary gross/refund/net, trend, top product/customer/payment mix, export, dan **15 KPI** dalam tiga grup × lima KPI. Loading/empty/error jujur, responsif, keyboard-accessible, tanpa fake data.

Kontrak angka:

- Gross memakai order fulfillment yang disepakati; `issue` bukan retur. `completed` hanya `order_status=completed`, bukan delivered.
- Return count/value hanya order return case selesai dengan `returned_quantity > 0`; refund adjustment terpisah.
- Timing konfirmasi = event `pending_payment → processing`; timing proses = `processing → resi pertama`.
- Model/sub-model memakai snapshot order item, bukan katalog live dan bukan SQL MySQL `||`.
- Repeat customer historis melihat order non-cancelled sebelum periode. Visitor memakai dedupe visitor hash + tanggal/granularitas yang konsisten.
- Bedakan `product_count` (jumlah identitas produk berbeda) dan `unit_count` (total qty). KPI “model/sub-model terjual” adalah metrik terpisah dan tidak boleh dilabeli sebagai unit.
- Cancellation history tetap tersimpan walau bukan KPI utama. Export memakai service yang sama.

Rujukan: `docs/features/08-store-performance.md`, kontrak analytics di `docs/api-and-routes-ragil-aluminium.md`, commit `f02903b`. Form pengisian return ledger dan keputusan accounting issue setelah pembayaran masih OPEN.

## 9. IA Dashboard/Admin dan UI/UX audit — LOCKED target, PARTIAL

Dashboard hanya ringkasan dan tindakan penting; tidak memakai hamburger. **Performa Toko** top-level karena fitur unggulan. Nav ramping berdasarkan workflow:

- **Produk:** Daftar Produk, varian/model, Media, Import; Import Performance berada di halaman Import.
- **Pesanan:** list/detail, payment, shipping, tracking, return/refund; Payment/shipping/tanggal/umur berada di Filter Lanjutan, bukan sidebar penuh.
- **Harga & Promo:** Promo Toko, Flash Sale, Voucher.
- **Konten:** CMS, Media/ Hasil Pemasangan sesuai scope.
- **Akun & Sistem:** Settings, Notifikasi, Log Aktivitas, integrasi.

Workflow utama: list → filter → detail → action/status/ongkir/tracking/return → satu timeline. Notifikasi admin actionable dan membuka order/review; Log Aktivitas mudah ditemukan tetapi tidak mengotori nav utama. Desktop adalah prioritas admin; mobile cukup support dasar tanpa clipping/overflow. Semua page harus memiliki active nav/parent, breadcrumb/title, permission guard, empty/loading/error, keyboard focus, dan aksi yang jelas.

Media Library global berbeda dari media scoped Hasil Pemasangan. Hasil Pemasangan memiliki project/media/status/caption sendiri dan dapat ditautkan ke satu atau beberapa produk; upload media produk boleh langsung “Tambahkan sebagai Hasil Pemasangan”, tetapi tidak otomatis masuk galeri global/PDP. Lifecycle project tetap terpisah.

Rujukan: `docs/features/09-admin-information-architecture.md`, sitemap/admin docs, commits `e66a3ae`, `0e2fc43`. Browser visual QA authenticated belum tuntas jika Chrome/Edge tidak tersedia; route smoke/typecheck/build sebelumnya menjadi bukti terbatas, bukan pengganti screenshot.

## 10. Produk, import, media, review, dan popularitas — MIXED

### Produk/import/media — PARTIAL/IMPLEMENTED

Import alurnya: upload → preview/validasi → job/riwayat → failed rows/correction → retry → media queue/download → hasil katalog. Import Performance ditemukan di halaman Import. Snapshot order item wajib menyimpan identitas yang diperlukan agar histori tidak membaca katalog live.

Media global dan media per produk memakai archive/visibility lifecycle, derivative WebP, status pending/downloading/downloaded/failed, dan permission admin. Hasil Pemasangan adalah scope project terpisah, dapat multi-produk, caption/status/lifecycle terpisah.

### Ulasan/moderasi — IMPLEMENTED sebagian

Verified purchase adalah syarat. Admin tidak mengubah teks ulasan customer. Admin boleh menambahkan foto/video/screenshot WA, melakukan moderation status, dan membuat ulasan admin untuk order verified yang belum memberi ulasan. Setiap review menyimpan source/author/audit; satu order tidak boleh memiliki duplikasi. Ulasan turunan dari Teruskan Popularitas tidak membuat row review baru.

Rujukan: commits `fdcf212`, `48e4487`, `b2a8338`, `cfe2e61`; API review contract.

### Teruskan Popularitas — IMPLEMENTED

Admin mengarahkan popularitas produk aktif A ke produk aktif B tanpa memindahkan histori order. Seed dan penjualan valid dipisahkan; disable wajib alasan; threshold notification dedupe; review A dapat tampil pada PDP B tanpa mengubah `product_id`/menduplikasi data. Route collision dan catalog safety sudah ditangani pada `882497b`, `d99df27`, `1ef89c1`.

## 11. Promo, Flash Sale, Voucher, COD, subsidi — MIXED

- Harga promo/Flash Sale menghasilkan harga efektif terlebih dahulu.
- Voucher admin dapat nominal **atau** persentase; minimum pembelian opsional (default tanpa minimum); stacking dikonfigurasi per voucher. Voucher diterapkan setelah harga efektif produk dan dapat digabung subsidi ongkir. CRUD/status/duplikasi/akhiri memiliki audit.
- Flash Sale memiliki campaign window dan target hingga variasi yang ditetapkan; jangan menggandakan mekanisme promo atau membuat campaign table baru tanpa keputusan.
- COD hanya ditawarkan bila wilayah/nilai order memenuhi aturan; penjelasan unavailable muncul pada pemilihan payment dan Transfer ditawarkan.
- Subsidi ongkir tetap terpisah dari harga produk dan dapat diedit admin melalui workflow ongkir dengan audit.

Rujukan: `docs/PRODUCT-HANDOFF.md`, API/schema voucher/promotion, commit `27b32b3`. Batas usage limit voucher di luar schema saat ini tidak boleh diinvent.

## 12. Notifikasi, Log Aktivitas, WhatsApp, keamanan — LOCKED

Notifikasi admin ikon harus dedupe untuk manual-review ongkir, return, import/media cleanup, dan threshold yang relevan; setiap item punya alasan, order/entity link, status terbaca, dan aksi. Log Aktivitas berada di Akun & Sistem, append-only, mencatat actor/source/before/after/reason/reference.

Admin-only operations memakai auth/permission guard. Customer hanya menerima safe subset; return notes/evidence/refund detail internal tidak bocor. Semua amount/status/stock/ownership diverifikasi server-side; idempotency berlaku pada checkout, tracking refresh, webhook, return completion, dan notification actions. Token/provider secret tidak masuk payload atau log publik.

WhatsApp order/return/tracking dikirim dari queue dan memiliki delivery audit; login/logout admin tidak memutus gateway. Tidak ada email fallback.

## 13. Open decisions dan pekerjaan berikutnya

1. Final ranking threshold/tier/sinonim/analytics retention Search.
2. Implementasi Share Product dan metadata OpenGraph/canonical yang final.
3. Quality gate, coverage, refresh schedule, dan operator correction dataset postal; implement rollback Google Maps di runtime.
4. Final J&T credentials/status mapping/webhook SLA/polling dan provider ETA.
5. Rekonsiliasi enum/status lama (`completed`, `delivered`, `return_completed`, `issue`) di semua controller/UI/test tanpa destructive migration.
6. End-to-end admin return ledger: evidence, refund transfer/reference, replacement, approval, SLA, dan timeline.
7. Accounting treatment order `issue` setelah pembayaran dan resolusi retur terhadap gross/net.
8. Final responsive breakpoint/screenshot QA admin; browser authenticated QA masih bergantung pada Chrome/Edge.
9. Voucher usage/stacking edge cases hanya jika schema/spec owner menambahkannya.
10. Urutan final sidebar, permission granularity, dan carrier adapter selain J&T.

## Referensi canonical

- `docs/features/00-index.md` dan `docs/features/01-search.md`–`09-admin-information-architecture.md`
- `docs/api-and-routes-ragil-aluminium.md`
- `docs/database-schema-ragil-aluminium.md`
- `docs/PRODUCT-HANDOFF.md`
- `docs/MEMORY.md`
- `docs/sitemap/admin-sitemap.md` dan `config/admin-sitemap.php`

Perubahan dokumen ini tidak mengubah runtime. Route/schema/enum baru tetap wajib melewati dokumen API/database dan test sebelum coding.
