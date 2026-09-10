# Audit Fitur Admin vs Spek — Ragil Aluminium

Tanggal: 2026-08-22
Metode: audit paralel 6 subagent (deleg_ed5567ec) — baca spek (features/*, stage-9a/9b, admin-sitemap, admin-menu-functions) vs implementasi (controllers/services/views live VPS @ 5b8df55). Read-only, tidak ada commit.
Repo: /root/ragilaluminium — branch feat/admin-ui-redesign. Product: /root/ragilaluminium
Lensa lanjutan: docs/design_thinking.md (lihat bagian bawah).

## Ringkasan verdict per grup

| Grup | Menus | Sesuai | KURANG | BERLEBIH |
|---|---|---|---|---|
| Core | 5 | 4 | 2 minor | 1 |
| Produk | 8 | 8 | 3 minor | 2 positif |
| Harga & Promo | 7 | 6 | 0 | 1 (P0) |
| Pelanggan & Komunikasi | 3 | 3 | 0 | 0 |
| Pengaturan Website | 8 | 6 | 0 | 2 |
| Akun & Sistem | 5 | 5 | 0 | 1 minor |

---

## CORE (Dashboard, Performa Toko, Pesanan, Pembayaran, Pengiriman)

### Dashboard — SESUAI (1 KURANG minor)
Semua blok spec terpenuhi (snapshot KPI harian, bar status order, Perlu Perhatian/aging, alert operasional, kesiapan integrasi, pesanan terbaru/top produk/promo, ringkasan finansial).
- KURANG: quick action **"Lihat Pending Payment"** tidak ada — hanya 3 dari 4 aksi spec. Bukti: `DashboardController:487-506` vs `stage-9a:396-401`.

### Performa Toko — SESUAI penuh
15 KPI (3 grup ×5) + financial gross/refund/net; rule COD R4 konsisten lintas metrics/trend/top/customers/payment mix; alias delivered≠completed; retur ledger; snapshot order_items; repeat non-cancelled; visitor dedupe; timing event log; export service sama. Bukti: `StorePerformanceService.php:22-244, 270-286, 496-592, 714-746`.

### Pesanan — SESUAI + BERLEBIH
List/filter/export, detail lengkap, edit hanya pending_payment, cancel dgn stok kembali, retur hanya Sampai/Selesai, state machine.
- **BERLEBIH (deviasi spec 05/06):** aksi manual **"Tandai Sampai"** — admin bisa `shipped→delivered` langsung. Bukti: `OrderController:1018-1022`, `OrderStateMachine:13`. Spec: Sampai harus dari tracking terverifikasi, tanpa Tandai Sampai.
- Risiko: `return_completed` bisa diset langsung via `updateStatus` melewati `completeReturn` yang menulis ledger `returned_quantity`. Bukti: `OrderController:764-766` vs `completeReturn:688-755`.

### Pembayaran — KURANG
- **KURANG:** tautan **bukti transfer (`evidence_url`)** dibuat & divalidasi tapi tidak pernah dirender di UI detail/index. Bukti: `PaymentController:85,120,129` vs `OrderController:421-427`, `PaymentController:39-46`. Spec `stage-9b §2.2`.

### Pengiriman — SESUAI
Daftar resi, detail+tracking URL+timeline, refresh jujur (sukses/gagal/stale), input resi manual (buat di luar app), idempotensi scan/timeline, delivered terverifikasi carrier→cascade, poll throttling.

---

## PRODUK (Produk, Kategori, Model, Sub Model, Import, Popularitas, Media, Riwayat Media)

### Produk — SESUAI
List/filter/cari, sub-view detail, toolbar export/tambah, wizard varian. Minor: `paginate(14)` performance tersier.

### Kategori — SESUAI
CRUD, products_count, sort, guard hapus jika dipakai, flush taxonomy cache. Kategori flat (bukan defisit).

### Model Produk — SESUAI
Showcase cms_model_products, reorder/sync/CRUD, type & status divalidasi, route pisah `model-products.*`, fallback storefront.

### Sub Model — SESUAI
CRUD + reorder/toggle, code unique per model.

### Import — SESUAI + 2 KURANG minor
- KURANG: kolom **waktu** (created_at/completed_at) & **link download file** tidak tampil; baris gagal tak ada `parent_sku` snapshot. Bukti: `ImportJobController:41-48` vs `9b:245-252,272`.
- Tipe job beda dari stage-9b tapi sesuai IA terbaru (doc-drift, bukan bug).

### Teruskan Popularitas — SESUAI (+BERLEBIH positif)
Snapshot penjualan valid, disable dgn alasan wajib, enable reaktivasi, evaluasi threshold, notifikasi+audit. Positif: tampil source/target/effective_score live.

### Media Library — SESUAI (+BERLEBIH positif)
Global shared asset browse/filter/attach. Positif: bulk archive/delete/restore, polling status, libraryContext.

### Riwayat Media — SESUAI + 2 KURANG minor
- KURANG: kolom **Source URL** asal tidak tampil; aksi **edit source URL→re-queue** tidak ada. Bukti: `ProductMediaController:64-72,700-723` vs `9b:300,317`.

### Drift dokumen
`docs/admin-menu-functions.md` (seksi 2) menaruh Kategori/Model/SubModel di "Pengaturan Website" & tak mencantumkan Kategori — padahal `config/admin-sitemap.php:93-96` menempatkannya di grup Produk (kode benar, dokumen tertinggal).

---

## HARGA & PROMO (Promo Toko, Flash Sale, Voucher, Subsidi, Banner, Bar, COD)

### Promo Toko — SESUAI
CRUD, draft→aktif/terjadwal/akhiri, duplikasi, impact preview, target fleksibel, 1 produk=1 promo, nama unik.

### Flash Sale — **BERLEBIH (P0, DUPLIKASI SISTEM)**
Dua sumber-truth paralel:
- Campaign-based (aktif, dipakai menu+price): `PromotionController?type=flash_sale`
- Legacy attribute tersisa: `FlashSaleController` + view + `product_attributes.promo_flash_sale`/`promo_compare_price` — tak terjangkau menu, `PriceService:14` mengabaikan comparer price atribut, TAPI `ProductPromotionMetadata:40-53` & `HomepagePromotions:189-198` masih membaca atribut → risiko **badge vs harga tidak sinkron**.
- Rekomendasi: konsolidasi ke campaign, sapu bersih jalur atribut.

### Voucher Toko — SESUAI (+pesan menyesatkan)
CRUD, publish/unpublish/duplicate/end, stacking per voucher, multi-voucher. Minor: pesan sukses "Voucher lain dinonaktifkan" menyesatkan (`VoucherController:159`) padahal stacking aktif.

### Subsidi Ongkir — SESUAI
Toggle, skema %/Rp, kurir J&T toggle, reason.

### Banner Promo — SESUAI
CRUD, publish/unpublish/destroy, hapus→archive bila dipakai, auto-promotions.

### Bar Promo — SESUAI
CRUD, publish/unpublish, periode, sort, href internal.

### Biaya COD — SESUAI
Toggle, fee (hanya persen — sesuai MEMORY), max_order_amount, reason. "Flat" = item menu flat sejajar Promo (bukan submenu), sesuai spec.

---

## PELANGGAN & KOMUNIKASI (Customer, Ulasan, WhatsApp) — SEMUA SESUAI

### Customer — SESUAI
Cari name/phone/email/kota/prov, detail/edit, riwayat order, status & fraud turunan, ekspor CSV, sinkron dari order. Terpisah dari admin.users.

### Ulasan — SESUAI
Dual tab website+foto(Eksternal), moderasi pending/approved/rejected, verified purchase dari delivered/completed, teks immutable, admin hanya tambah media, 1 ulasan/order.

### WhatsApp — SESUAI
Otomasi on/off, template catalog-owned + edit body, Baileys-only, pairing QR/kode, log pesan in/out via ResourceIndex/ResourceShow.

---

## PENGATURAN WEBSITE (Beranda, CaraPesan, FAQ, Masalah&Solusi, Dokumen, Marketplace, ApaKata, HasilPemasangan)

### Beranda Pembeli — SESUAI
Layout section, edit service highlights/howto/updateSections, section bisa diatur. Sorotan Layanan = Legacy (tidak ditampilkan publik).

### Cara Pemesanan — SESUAI
Title/heading/subtitle/body/steps{icon,title,desc,points}/info_cards, preview, activity log.

### Sering Ditanyakan — SESUAI
4 kategori kanonik persis kontrak, tabs aktif/arsip, archive/reorder/meta/CRUD.

### Masalah & Solusi — SESUAI inti + **BERLEBIH**
- BERLEBIH: `MasalahSolusiController:167-196` menerima ±15 field di luar kontrak (solution_body, examples_*, photo_files, video_*, solutions_*, use_options, whatsapp_note). Spek hanya problem+solution.

### Dokumen Halaman — SESUAI inti + 2 anomali
3 dokumen (tentang-kami, ketentuan, privasi) dgn editor full-canvas.
- Anomali: `DocumentPagesController@index` render **Admin/Beranda/Index** (bukan hub); `@update` **no-op** (redirect+flash tanpa simpan) → tombol Simpan hub menyesatkan.

### Marketplace & Media Sosial — SESUAI
Editor link eksternal, validasi URL http(s), allowlist key, simpan ke cms_pages.

### Apa Kata Pelanggan Kami — SESUAI
apaKata→marketplaceScreenshotIndex, meta update, reorder.

### Hasil Pemasangan Kami — SESUAI
hasilPemasangan→fotoIndex (+sort/filter), meta, CRUD via gallery-items, pengaturanSurface.

---

## AKUN & SISTEM (Log Aktivitas, Notifikasi, Profil, Manajemen Admin, Pengaturan Sistem)

### Log Aktivitas — SESUAI
Tab kategori, cari, sort, unduh CSV, detail ke order/import/WA, append-only. describe() lengkap termasuk settings.version_created & whatsapp.logged_out.

### Notifikasi — SESUAI
Daftar (limit 100), filter unread, markRead per-item + markAllRead.

### Profil Saya — SESUAI (1 catatan kecil)
Edit name/username/email/password, peran/status read-only. Minor: spek bilang "nama/email/password", impl juga edit username (ekstensi wajar).

### Manajemen Admin — SESUAI
List/filter, equal-admin (STRAP admin), tak bisa nonaktifkan diri, minimal 1 aktif, semua aksi dilog.

### Pengaturan Sistem — SESUAI + **BERLEBIH minor**
Status integrasi read-only. BERLEBIH: endpoint `settings.update` no-op (`SettingsController:38-44`) + route PUT — tidak dipanggil frontend (endpoint mati).

---

## Aksi yang disarankan (prioritas)
1. **P0 Flash Sale** — konsolidasi dua sistem (campaign vs atribut). Risiko harga vs badge.
2. **P1 "Tandai Sampai" manual** — bereskan sesuai spec (tracking terverifikasi, no manual delivered).
3. **P1 bukti transfer** — sajikan `evidence_url` di UI pembayaran.
4. **P2** — form Masalah&Solusi kaya, dokumen admin-menu-functions drift, pesan voucher, DocumentPages no-op, endpoint settings.update mati, kolom waktu/link Import + Source URL media.

---

## Lanjutan: Review dgn lensa design_thinking.md

Lensa: X → Graph → Effect<A,E,R>; §1-10; Pipeline; E scoping di layer; divergent strategies.
(fokus audit tambahan diadakan pada temuan prioritas sesuai lensa ini — lihat laporan lanjutan terpisah)