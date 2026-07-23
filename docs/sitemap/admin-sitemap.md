# Admin Sitemap: Ragil Aluminium (Internal Dashboard)

Dokumen ini memetakan arsitektur informasi (Sitemap) dari antarmuka internal Admin Dashboard Ragil Aluminium, berdasarkan `docs/ui-admin-flows-ragil-aluminium.md`.

## 0. Global Elements (Top Navbar / Topbar)
Elemen ini selalu persisten di bagian atas (atau area *header*) Dasbor Admin di semua halaman.

- **Logo Area**: Mengarah kembali ke halaman Dashboard (Beranda).
- **Search Global (Search Bar)**: 
  - Fungsi: Menerima *input* pencarian universal (seperti ID Pesanan, SKU Produk, atau Nomor Resi).
  - Mekanisme: Ketika *user* mengetik dan *submit*, sistem akan melakukan routing ke halaman yang relevan (misalnya ke detail pesanan jika *input* berupa nomor pesanan).
- **Notifikasi**: Menampilkan *alert* penting, seperti pesanan baru atau *import* yang gagal.
- **User Profile Menu**: Dropdown untuk melihat pengaturan akun staf, role, dan opsi *Logout*.

## Hierarki Menu Utama (Sidebar)

Footer sidebar: tautan **Lihat toko** → beranda publik (`home`, tab baru) agar admin bisa memeriksa storefront tanpa meninggalkan konteks panel.

### 1. Dashboard
- **Beranda** (Tipe: `Operational` & `Analytics`)
  - Snapshot KPI harian, funnel pesanan, grafik performa singkat, dan *alert* operasional (import gagal, WA gagal).

### 2. Catalog / Produk
- **Daftar Produk** (Tipe: `Operational` & `Content`)
  - Daftar SKU Induk, status aktif/arsip.
  - Sub-view: Product Detail (Overview, Variants, Attributes, Media per produk).
  - Shortcut toolbar: Import, Media hub, Export CSV, Tambah Produk.
- **Import** (Tipe: `Operational`) — di bawah grup nav **Produk**
  - Daftar job impor Shopee/Internal.
  - Sub-view: Job Detail (Summary, Statistik Bar, Failed Rows Table, Download Correction).
- **Media** (Tipe: `Operational`) — di bawah grup nav **Produk**
  - Media manager global + status download/upload; kelola per produk lewat `admin.products.media.*`.
- **Attributes** (Tipe: `Operational`)
  - Manajemen taksonomi (material, tipe kaca, dll) dari konteks produk.

### 3. Orders & Payments (Pesanan & Pembayaran)
- **Orders** (Tipe: `Operational`)
  - Daftar pesanan dengan filter status (pending, processing, shipped, dll).
  - Sub-view: Order Detail (Ringkasan, Info Pelanggan, Item, Log WA, Log Status).
- **Payments** (Tipe: `Operational`)
  - Daftar rekaman pembayaran, verifikasi bukti transfer.

### 4. Shipping (Pengiriman)
- **Shipping Records** (Tipe: `Operational`)
  - Daftar nomor resi (Waybill), kurir, dan status integrasi J&T/lainnya.

### 5. WhatsApp Center
- **WhatsApp Otomatis** (Tipe: `Settings/System` & `Operational`)
  - Daftar 5 otomasi Stage-8 (COD, Transfer, Diproses, Resi, Sampai): toggle aktif + edit provider/body preview.
  - Route: `admin.whatsapp.templates.*` → `Admin/WhatsApp/Index|Edit`.
  - Status koneksi Cloud API: `admin.whatsapp.connection` → `Admin/WhatsApp/Connection` (bukan QR WhatsApp Web).
- **Messages** (Tipe: `Operational`)
  - Log lalu lintas pesan masuk/keluar dan *troubleshooting* status gagal. Route: `admin.whatsapp.messages.*`.

### 6. CMS / Pengaturan Website
- **Beranda Pembeli** (Tipe: `Content/CMS`)
  - Tata letak section beranda (urutan/aktif) + editor Sorotan Layanan & Cara Pesan. Banner → Promo Toko.
  - Route: `admin.beranda.*` → `Admin/Beranda/{Index,ServiceHighlightsForm,HowToOrderForm}`. Data: `cms_pages.beranda` JSON.
- **Model Produk** (Tipe: `Content/CMS`)
  - Showcase/kurasi model katalog (`cms_model_products`): list + stats, reorder, sync dari produk, CRUD, aktif/draft.
  - Route: `admin.model-products.*` → `Admin/ModelProducts/{Index,Form}`. **Bukan** `admin.products.*` (katalog SKU).
- **Cara Pemesanan** (Tipe: `Content/CMS`)
  - Editor panduan publik `/cara-pemesanan`: hero, langkah (+ checklist), kartu info, catatan HTML.
  - Route: `admin.cara-pemesanan.*` → `Admin/CaraPemesanan/Edit`. Data: `cms_pages.slug = cara-pemesanan`.
- **Sering Ditanyakan** (Tipe: `Content/CMS`)
  - Accordion FAQ (`cms_faq_items`): tab Aktif / Diarsipkan, list first, tambah on-demand, meta halaman tersembunyi; filter kategori, reorder, archive.
  - Route: `admin.faq.*` → `Admin/Faq/Index`. Publik: `/faq` → `Public/Faq` (hanya `status=active`).
- **Masalah & Solusi** (Tipe: `Content/CMS`)
  - Pasangan kendala/rekomendasi (`cms_problems_solutions`) + meta `cms_pages.masalah-solusi`.
  - Route: `admin.masalah-solusi.*` → `Admin/MasalahSolusi/{Index,Form}`. Publik: `/masalah-dan-solusi` → `Public/MasalahSolusi`.
- **Informasi Toko** (Tipe: `Content/CMS`)
  - Editor dokumen panjang (`cms_pages.tentang-kami` → `content.body` + heading).
  - Route: `admin.tentang-kami.*` → `Admin/CmsDocument/Edit`. Publik: `/about`.
- **Marketplace & Media Sosial** (Tipe: `Settings`)
  - Editor tautan eksternal toko/akun (`cms_pages.storefront-platforms` → `content.links`). Katalog key/label/icon di `config/sitemap.php` → `platforms`.
  - Route: `admin.storefront-platforms.*` → `Admin/StorefrontPlatforms/Edit`. Tampil di Informasi Toko + footer via Inertia share `platforms`.
- **Ketentuan Layanan** (Tipe: `Content/CMS`)
  - Editor dokumen (`cms_pages.ketentuan-layanan`). Route: `admin.ketentuan-layanan.*` → `Admin/CmsDocument/Edit`. Publik: `/policy/terms`.
- **Kebijakan Privasi** (Tipe: `Content/CMS`)
  - Editor dokumen (`cms_pages.kebijakan-privasi`). Route: `admin.kebijakan-privasi.*` → `Admin/CmsDocument/Edit`. Publik: `/policy/privacy`.
- **Apa Kata Pelanggan Kami** (Tipe: `Content/CMS`)
  - Meta hero `/reviews` (`cms_pages.testimoni`: `title`, `heading`, `subtitle`, `published`) + daftar ulasan website (`cms_testimonials`).
  - Route: `admin.apa-kata-pelanggan.*` → `Admin/Testimonials/Index` (surface Pengaturan; CRUD item tetap `admin.testimonials.*`).
  - Monitoring → Ulasan tetap entry dual-tab (website + foto).
- **Hasil Pemasangan Kami** (Tipe: `Content/CMS`)
  - Meta section `/hasil-pemasangan` + beranda (`cms_pages.hasil-pemasangan`) + galeri `cms_gallery_items`; detail publik `/hasil-pemasangan/{parent_sku}`.
  - Route: `admin.hasil-pemasangan.*` → `Admin/Testimonials/Index` (tab foto + meta; CRUD item tetap `admin.gallery-items.*`).
- **Pages** (Tipe: `Content/CMS`)
  - Editor halaman publik generik.
- **Banners / Promo** (Tipe: `Content/CMS`)
  - Mengelola aset hero banner dan promo di beranda publik.
- **Flash Sale** (Tipe: `Operational` & `Content`)
  - Menandai produk peserta Flash Sale via `product_attributes` (`promo_flash_sale`, `promo_compare_price`). Route: `admin.flash-sale.*`.
- **Voucher Toko** (Tipe: `Operational`)
  - CRUD kode voucher checkout (`store_vouchers`). Route: `admin.vouchers.*`. Hanya satu voucher `published` sekaligus.
- **Biaya COD** (Tipe: `Settings`)
  - Toggle COD + handling fee + limit belanja. Route: `admin.cod-settings.*` → `cms_pages.checkout.content.cod`.
- **Subsidi Ongkir** (Tipe: `Settings`)
  - Toggle subsidi + skema %/Rp + kurir J&T. Route: `admin.shipping-subsidy.*` → `cms_pages.checkout.content.shipping_subsidy`.

### 7. Analytics (Analitik & Performa)
- **Performa Toko** (Tipe: `Analytics` / pembukuan)
  - Dashboard KPI penjualan, kunjungan, operasional + tren + tabel produk/customer + unduh CSV.
  - Route: `admin.analytics.store-performance` (+ `.export`). Inertia: `Admin/Analytics/StorePerformance`.
  - Omzet hanya order fulfillment (`processing|shipped|delivered|completed`).
- **Customer** (Tipe: `Operational` / Monitoring)
  - Kelola pelanggan guest (tabel `customers`): cari, status/fraud turunan, detail/edit, riwayat order, unduh CSV.
  - Route: `admin.customers.*` → `Admin/Customers/{Index,Edit}`. **Bukan** Manajemen Admin (`admin.users.*`).
- **Ulasan** (Tipe: `Operational` / Monitoring)
  - Tab **Ulasan Website** (`cms_testimonials`) + **Ulasan Foto** (`cms_gallery_items` / hasil pemasangan): cari, filter publish, publish/unpublish, CRUD.
  - Route: `admin.testimonials.*` + `admin.gallery-items.*` → `Admin/Testimonials/{Index,Form,GalleryForm}`.
- **Log Aktivitas** (Tipe: `Operational` / Monitoring)
  - Audit trail `event_logs`: tab kategori, cari, sort, unduh CSV, Detail ke order/import/WA. **Bukan** Import Performance.
  - Route: `admin.activity-logs.*` → `Admin/ActivityLogs/Index`.
- **Import Performance** (Tipe: `Analytics`)
  - Metrik keberhasilan dan tingkat *error* sistem impor data. Route: `admin.analytics.import-performance`.

### 8. Settings (Sistem) / Akun
- **Profil Saya** (Tipe: `Settings/Account`)
  - Edit nama, email, password akun yang sedang login. Peran/status read-only.
  - Route: `admin.profile.*` → `Admin/Profile/Edit`.
- **Manajemen Admin / Users** (Tipe: `Settings/System`)
  - List/filter akun staf (`users`): cari nama/email, filter status, sort; CRUD + aktif/nonaktif.
  - Equal-admin (Stage 2): tidak ada picker Super Admin/Staf/Viewer — semua akun = Admin.
  - Guard: tidak bisa nonaktifkan akun sendiri; minimal satu akun aktif.
  - Route: `admin.users.*` → `Admin/Users/{Index,Form}`.
- **Pengaturan Sistem** (Tipe: `Settings/System`)
  - Status integrasi environment (WA, J&T, media disk) — read-only di UI. Route: `admin.settings.*` → `Admin/ResourceShow`.

---

## Hubungan Antarhalaman (Flows)

- **Order Management Flow**: `Dashboard (Needs Attention)` -> `Orders List` -> `Order Detail` -> (Tab Pembayaran / Tab Pengiriman / Tab WA Logs).
- **Catalog Update Flow**: `Dashboard (Import Alerts)` -> `Produk → Import` -> `Failed Rows` -> (Perbaikan Data Excel) -> `Produk → Daftar Produk` -> `Product Detail (Variants & Media)`.
