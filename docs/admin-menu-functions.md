# Admin Menu & Functions — Ragil Aluminium

Daftar menu admin beserta fungsinya, **diverifikasi terhadap spec** (arsitektur informasi
kanonik) + implementasi nyata (route/controller/view). Sumber verifikasi:

- Struktur/IA: `config/admin-sitemap.php` (menu sidebar nyata) + `docs/sitemap/admin-sitemap.md` (spec kanonik).
- Route/controller/view: `php artisan route:list` (verifikasi 2026-08-19 — semua route menu **OK/terdaftar**).
- Fitur/atribut: `docs/features/*`, `docs/logic/*`, `docs/PRODUCT-HANDOFF.md`, `docs/MEMORY.md`.

Status release: **BELUM PRODUCTION** — dokumen ini deskriptif-praktis untuk navigasi admin.

---

## 1. Core (Sidebar utama)

| Menu | Route (verified) | Controller | View | Fungsi (spec) | Tipe |
|---|---|---|---|---|---|
| **Dashboard** | `admin.dashboard` → `/admin` | `DashboardController@index` | `Admin/Dashboard` | Snapshot KPI harian, alert operasional (import gagal, WA gagal), follow-up ke halaman asli. **Tidak** menggantikan Performa Toko. | Operational/Analytics |
| **Performa Toko** | `admin.analytics.store-performance` | `AnalyticsController@storePerformance` | `Admin/Analytics/StorePerformance` | KPI penjualan/kunjungan/operasional + tren + tabel produk/customer + unduh CSV. Omzet gross dari fulfillment `processing..completed` (+return); **COD diakui hanya saat completed**; net dikurangi refund return. | Analytics |
| **Pesanan** | `admin.orders.index` | `OrderController@index` | `Admin/Orders/Index` | Daftar pesanan + filter status; detail (info, item, WA log, status). | Operational |
| **Pembayaran** | `admin.payments.index` | `PaymentController@index` | `Admin/Payments` | Rekaman pembayaran & verifikasi bukti transfer. | Operational |
| **Pengiriman** | `admin.shipping.index` | `ShippingRecordController@index` | `Admin/Shipping` | Daftar resi (waybill), kurir, status integrasi; resi dibuat di J&T di luar website — admin hanya input nomor; tampil tracking URL + timeline + refresh jujur (sukses/gagal/stale). | Operational |

## 2. Produk

| Menu | Route (verified) | Controller | View | Fungsi (spec) | Tipe |
|---|---|---|---|---|---|
| **Kelola Produk** | `admin.products.index` | `ProductController@index` | `Admin/Products/Index` | Daftar SKU induk + status aktif/arsip; detail: Overview, Variants, Attributes, Media per produk; toolbar Import/Media/Export CSV/Tambah. | Operational/Content |
| **Import** | `admin.imports.index` | `ImportJobController@index` | `Admin/Imports` | Daftar job impor Shopee/Internal; detail: summary, statistik bar, failed rows, download correction. **Import Performance dibuka dari sini (toolbar)** — bukan nav terpisah (Fase 13). | Operational |
| **Teruskan Popularitas** | `admin.products.popularity-boosts.index` | `ProductPopularityBoostController@index` | `Admin/Products` | Konfigurasi produk sumber→target: snapshot penjualan sumber jadi seed target; bisa dinonaktifkan dgn alasan; audit + notifikasi ambang masuk Akun & Sistem. | Operational |
| **Media Library** | `admin.media.library` | `ProductMediaController@library` | `Admin/Media` | Global shared asset (browse/filter/attach lintas produk, upload langsung). | Operational |
| **Riwayat Media** | `admin.media.history` | `ProductMediaController@history` | `Admin/Media` | Histori pekerjaan/upload media (status, retry, log). | Operational |

## 3. Harga & Promo

| Menu | Route (verified) | Controller | View | Fungsi (spec) | Tipe |
|---|---|---|---|---|---|
| **Promo Toko** | `admin.promotions.index` | `PromotionController@index` | `Admin/Promotions` | CRUD/status/duplikasi/akhiri promo; aturan harga efektif (promo → voucher → subsidi ongkir → biaya COD). | Operational/Content |
| **Banner Promo** | `admin.banners.index` | `BannerController@index` | `Admin/Banners` | Aset hero banner & promo di beranda publik; hapus dgn cleanup media (dishare → archived). | Content/CMS |
| **Bar Promo** | `admin.announcements.index` | `AnnouncementController@index` | `Admin/Announcements` | Bar pengumuman (slide) di storefront. | Content/CMS |
| **Flash Sale** | `admin.promotions.index?type=flash_sale` | `PromotionController` | `Admin/FlashSale` | Menandai produk peserta via `product_attributes` (`promo_flash_sale`, `promo_compare_price`); diskon PER VARIASI (Fase 12). | Operational/Content |
| **Voucher Toko** | `admin.vouchers.index` | `VoucherController@index` | `Admin/Vouchers` | CRUD/status/duplikasi/akhiri kode voucher checkout; stacking per-voucher; tampilkan alasan tak terpakai. | Operational |
| **Biaya COD** | `admin.cod-settings.edit` | `CodSettingsController@edit` | `Admin/CodSettings` | Toggle COD + handling fee + limit belanja (`cms_pages.checkout.content.cod`). | Settings |
| **Subsidi Ongkir** | `admin.shipping-subsidy.edit` | `ShippingSubsidyController@edit` | `Admin/ShippingSubsidy` | Toggle subsidi + skema %/Rp + kurir J&T (`cms_pages.checkout.content.shipping_subsidy`). | Settings |

## 4. Pelanggan & Komunikasi

| Menu | Route (verified) | Controller | View | Fungsi (spec) | Tipe |
|---|---|---|---|---|---|
| **Customer** | `admin.customers.index` | `CustomerController@index` | `Admin/Customers/Index` | Kelola pelanggan guest (`customers`): cari, status/fraud turunan, detail/edit, riwayat order, unduh CSV. **Bukan** manajemen admin. | Operational |
| **Ulasan** | `admin.testimonials.index` + `admin.gallery-items.*` | `TestimonialController` | `Admin/Testimonials/{Index,Form,GalleryForm}` | Dual tab Ulasan Website (`cms_testimonials`) + Ulasan Foto (`cms_gallery_items`); moderasi pending/approved/rejected, verified purchase dari order delivered/completed, teks pelanggan immutable (admin hanya tambah media). | Operational |
| **WhatsApp** | `admin.whatsapp.dashboard` | `WhatsAppTemplateController@dashboard` | `Admin/WhatsApp/{Index,Connection,Pairing,Messages}` | Otomasi WA (toggle template aktif + edit body), koneksi gateway **Baileys-only** (terverifikasi — dokumen lama menyebut "Cloud API": **stale, sudah dikoreksi**), pairing QR/kode, log pesan masuk/keluar. | Settings/Operational |

## 5. Pengaturan Website

| Menu | Route (verified) | Controller | View | Fungsi (spec) | Tipe |
|---|---|---|---|---|---|
| **Beranda Pembeli** | `admin.beranda.index` | `BerandaController@index` | `Admin/Beranda/{Index,ServiceHighlightsForm,HowToOrderForm}` | Tata letak section beranda (urutan/aktif) + Sorotan Layanan + Cara Pesan (`cms_pages.beranda` JSON). | Content/CMS |
| **Model Produk** | `admin.model-products.index` | `ModelProductController@index` | `Admin/ModelProducts/{Index,Form}` | Showcase/kurasi model katalog (`cms_model_products`): list+stats, reorder, sync dari produk, CRUD, aktif/draft. **Bukan** kelola SKU. | Content/CMS |
| **Sub Model** | `admin.sub-models.index` | `SubModelController@index` | `Admin/SubModels` | Kelola sub-model katalog (reorder, toggle). | Content/CMS |
| **Cara Pemesanan** | `admin.cara-pemesanan.edit` | `CaraPemesananController@edit` | `Admin/CaraPemesanan/Edit` | Editor panduan `/cara-pemesanan`: hero, langkah+checklist, kartu info, catatan HTML. | Content/CMS |
| **Sering Ditanyakan** | `admin.faq.index` | `FaqController@index` | `Admin/Faq/Index` | Accordion FAQ (`cms_faq_items`): tab aktif/arsip, kategori, reorder, archive; meta halaman. Publik `/faq` hanya `status=active`. | Content/CMS |
| **Masalah & Solusi** | `admin.masalah-solusi.index` | `MasalahSolusiController@index` | `Admin/MasalahSolusi/{Index,Form}` | Pasangan kendala/rekomendasi (`cms_problems_solutions`) + meta; publik `/masalah-dan-solusi`. | Content/CMS |
| **Dokumen Halaman** | `admin.documents.index` (+ tentang-kami, ketentuan-layanan, kebijakan-privasi) | `DocumentPagesController@index` | `Admin/CmsDocument/Edit` | Editor dokumen panjang: Tentang Kami (/about), Ketentuan Layanan (/policy/terms), Kebijakan Privasi (/policy/privacy). | Content/CMS |
| **Marketplace & Media Sosial** | `admin.storefront-platforms.edit` | `StorefrontPlatformController@edit` | `Admin/StorefrontPlatforms/Edit` | Editor tautan eksternal toko/akun (`cms_pages.storefront-platforms`); katalog key/label/icon di `config/sitemap.php → platforms`; tampil di Info Toko + footer. | Settings |
| **Apa Kata Pelanggan Kami** | `admin.apa-kata-pelanggan.index` | `TestimonialController@apaKata` | `Admin/Testimonials/Index` | Meta hero `/reviews` (`cms_pages.testimoni`) + daftar ulasan website (CRUD tetap `admin.testimonials.*`). | Content/CMS |
| **Hasil Pemasangan Kami** | `admin.hasil-pemasangan.index` | `TestimonialController@hasilPemasangan` | `Admin/Testimonials/Index` | Meta section `/hasil-pemasangan` + galeri (`cms_gallery_items`); detail publik `/hasil-pemasangan/{parent_sku}`; CRUD item tetap `admin.gallery-items.*`. | Content/CMS |

## 6. Akun & Sistem

| Menu | Route (verified) | Controller | View | Fungsi (spec) | Tipe |
|---|---|---|---|---|---|
| **Log Aktivitas** | `admin.activity-logs.index` | `ActivityLogController@index` | `Admin/ActivityLogs` | Audit trail `event_logs`: tab kategori, cari, sort, unduh CSV; detail ke order/import/WA. Append-only. | Operational/Monitoring |
| **Notifikasi** | `admin.notifications.index` | `NotificationController@index` | `Admin/Notifications` | Daftar + tandai-baca notifikasi admin (import_failed, return_created, media_cleanup, review ongkir manual dedupe per order → aksi Review/Edit/Konfirmasi). | Operational |
| **Profil Saya** | `admin.profile.edit` | `ProfileController@edit` | `Admin/Profile/Edit` | Edit nama/email/password akun sendiri; peran/status read-only. | Settings |
| **Manajemen Admin** | `admin.users.index` | `UserController@index` | `Admin/Users/{Index,Form}` | List/filter akun staf; equal-admin (tanpa SuperAdmin/Staf/Viewer); tidak bisa nonaktifkan diri sendiri; minimal satu akun aktif. | Settings |
| **Pengaturan Sistem** | `admin.settings.index` | `SettingsController@index` | `Admin/ResourceShow` | Status integrasi environment (WA, J&T, media disk) — read-only. | Settings |

---

## Hasil verifikasi (2026-08-19)

- **34/34 route menu terdaftar** di `php artisan route:list` — tidak ada menu dead-end di level route.
- **1 koreksi spec**: `docs/sitemap/admin-sitemap.md` baris lama menyebut "Status koneksi **Cloud API**" untuk halaman WhatsApp Connection → sudah dikoreksi menjadi **Baileys** (provider Meta diarsipkan 2026-08-19; `Connection.tsx` Baileys-only).
- Fase 13 IA: **Import Performance bukan nav terpisah** (dibuka dari halaman Import via toolbar) — sesuai config; **Dashboard** = summary/follow-up; **Log Aktivitas** di Akun & Sistem.
- Perubahan IA pasca-verifikasi harus memperbarui `config/admin-sitemap.php` → `docs/sitemap/admin-sitemap.md` → dokumen ini.