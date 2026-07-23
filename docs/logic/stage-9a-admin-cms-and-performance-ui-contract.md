# Skill: Stage 9A – Admin CMS & Performa Toko UI Contract (Ragil Aluminium)

This document connects **admin UI** (visual SoT: `docs/DESIGN.md` Bagian B + `resources/views/admin/dashboard.blade.php` + `docs/sitemap/admin-*`) to the backend modules defined in Stage 1–8 for Ragil Aluminium.  
All agents must respect the existing UI structure; this contract only defines **data and behaviour**, not a license to invent layout. **Do not** treat Next.js (`website_2.0/ui`) or legacy `paste.txt` as visual SoT.

---

## 1. Scope & Non‑Modification Principle

### 1.1 Scope

Stage 9A covers two major admin areas already designed:

1. **Pengaturan Website & Konten CMS**  
   - Panels: Beranda, Model Produk, Cara Pemesanan, Sering Ditanyakan (FAQ), Masalah & Solusi, Informasi Toko, Ketentuan Layanan, Kebijakan Privasi, Apa Kata Pelanggan, Hasil Pemasangan. [file:585]

2. **Dashboard Performa Toko & Analitik Finansial**  
   - Analytical dashboard: KPI cards (Omset, Pengunjung, Pesanan selesai, dll.), trend chart, customer dataset table. [file:585][file:586]

### 1.2 Non‑Modification

This skill **must not**:

- Remove existing admin UI components or flows defined in DESIGN / admin dashboard / admin-sitemap.  
- Rename sidebar/menu items (`Beranda`, `Performa Toko`, `Model Produk`, dll.) vs `config/admin-sitemap.php`.

If future changes are needed (misalnya menambah field), document as an explicit extension/update to DESIGN + this contract — not silent modifications.

---

## 2. Pengaturan Website & Konten CMS – Data Contract

Pengaturan Website & CMS berfungsi sebagai **editor konten** yang mengisi halaman publik dan materi edukasi Ragil Aluminium. UI mengikuti DESIGN / admin sitemap; di sini kita jelaskan bagaimana data disimpan dan diambil.

### 2.1 Storage Model

Backend harus menyediakan tabel/struktur CMS, misalnya:

- `cms_pages`
  - `id`
  - `slug` (e.g., `beranda`, `model-produk`, `cara-pemesanan`, `faq`, `masalah-solusi`, `tentang-kami`, `storefront-platforms`, `ketentuan-layanan`, `kebijakan-privasi`, `testimoni`, `hasil-pemasangan`)
  - `title`
  - `content` (JSON or structured fields per page type)
  - `published` (bool)
  - `updated_by_admin_id`
  - `updated_at`

Untuk konten yang terstruktur (FAQ, Masalah & Solusi, Galeri, Testimoni), gunakan tabel anak:

- `cms_faq_items` (link ke `cms_pages` dengan slug `faq`).  
- `cms_problems_solutions` (link ke `cms_pages` dengan slug `masalah-solusi`).  
- `cms_gallery_items` (slug `hasil-pemasangan`).  
- `cms_testimonials` (slug `testimoni`).  

Struktur field mengikuti panel CMS di DESIGN / admin wireframes:

- FAQ: pertanyaan, jawaban, kategori, urutan. [file:585]  
- Masalah & Solusi: teks masalah (kolom kiri), teks solusi (kolom kanan). [file:585]  
- Galeri: foto, label lokasi/nama pelanggan, status publish. [file:585]  
- Model Produk: foto, nama model, toggle aktif/nonaktif, urutan. [file:585]

### 2.2 Panel Beranda Utama (`BerandaEditor`)

UI (berdasarkan DESIGN / admin CMS panels + Figma Tata Letak Beranda):

- **Implemented:** Monitoring/Pengaturan → **Beranda Pembeli** (`admin.beranda.index`, `Admin/Beranda/Index`) — urutan & aktif/nonaktif section (Banner Utama, Sorotan Layanan, Cara Pesan), mode geser (naik/turun), Simpan.
- Edit konten Banner → Promo Toko (`admin.banners.*`).
- Edit Sorotan Layanan → `Admin/Beranda/ServiceHighlightsForm`.
- Edit Cara Pesan → `Admin/Beranda/HowToOrderForm`.
- Drag‑and‑drop gambar banner (webp/png/jpg) tetap di Promo Toko.  
- Input teks slogan utama (judul besar) — lewat banner / landing slide.  

Data contract:

- Slide promo terstruktur disimpan di `cms_banners`: `title`, `image_url`, `link_url`, `sort_order`, dan `published`.
- Tata letak + copy section disimpan di `cms_pages.slug = beranda` → `content.layout`, `content.service_highlights`, `content.how_to_order` (lihat schema §6 banners notes).
- Public Home merender section managed sesuai `layout.sections` order/enabled, lalu section katalog tetap (model, populer, galeri, testimoni, CTA).
- `published = true` berarti promo sedang berjalan; public homepage hanya membaca record aktif dan mengurutkannya dengan `sort_order`.
- `link_url` internal `/product/{parent_sku}` mengikat slide ke produk aktif. Homepage otomatis memakai gambar utama produk (`pdp`/`card`) dan copy produk; `image_url` menjadi fallback.
- `title` boleh memuat persentase (contoh `Diskon sampai 30%`); backend mengekstrak accent `-30%` dan merender slide dengan layout standar kartu promo 3:4 (`layout: promo_card`).
- Media upload tetap disimpan di disk `media` (Stage 6). Admin boleh tidak mengunggah gambar jika link produk valid dan produk mempunyai gambar utama.
- Urutan slides menentukan tampilan carousel di public homepage; frontend wajib membaca urutan dari data, bukan hardcode.

Banner promosi otomatis:

- Toggle disimpan di `cms_pages.slug = beranda` → `content.auto_promotions = { enabled: bool, max_slides: int }` (default `enabled: true`, `max_slides: 3`). Tidak ada migrasi SQL baru.
- Endpoint admin: `PUT /admin/banners/auto-promotions` (`Admin\BannerController@updateAutoPromotions`). Panel toggle ada di halaman Banner Beranda; editor CMS `beranda` wajib mempertahankan key `auto_promotions` jika tidak dikirim ulang.
- Produk eligible otomatis bila `status` aktif/visible, punya varian aktif + harga, punya gambar utama, dan atribut internal eksplisit: harga coret valid (`promo_compare_price` / alias) **atau** `promo_flash_sale=true` (alias `flash_sale`). Global `STOREFRONT_PRODUCT_CARD_DISCOUNT_PERCENT` tidak membuat produk eligible.
- Merge: slide landing brand selalu jadi slide pertama (tidak digantikan promo), lalu slide manual published, lalu slide otomatis (maks. `max_slides`), deduplikasi by SKU dari `link_url`/`href`. Fallback promo statis hanya jika manual dan otomatis kosong.
- Slide otomatis memakai `source: automatic`, `layout: promo_card`, CTA ke PDP; **tidak** masuk announcement ticker.

### 2.3 Panel Model Produk & Showcase (`ModelProdukEditor`) — **Implemented**

UI:

- List vertikal dengan foto model, nama model, stats katalog (aktif/arsip/varian), mode reorder (naik/turun), sync dari katalog, CRUD, aktif/draft.
- Filter status (Semua / Aktif / Draft). Sub-model desain (Polos/Ornamen/…) dihitung dari produk.

Data contract:

- Tabel `cms_model_products`:
  - `id`
  - `name`
  - `product_category` (nullable: `WINDOW`|`DOOR`|`BOUVEN`) — tautan katalog
  - `product_model` (nullable: e.g. `JUNGKIT`) — tautan katalog
  - `image_url` (stored via Media Module / URL)
  - `type` (`polos`, `ornamen`, `lainnya`)
  - `status` (`active`, `draft`)
  - `sort_order`
- Admin: `admin.model-products.*` → `Admin/ModelProducts/{Index,Form}` (**bukan** `admin.products.*`).
- Public: baris `status = active` (urut `sort_order`) via `ModelProductService::storefrontCards()`; jika kosong → fallback `CatalogTaxonomy::modelCards`.

### 2.4 Panel Cara Pemesanan & Alur Belanja (`CaraPemesananEditor`) — **Implemented**

UI:

- Editor khusus (bukan daftar CMS generik): hero, langkah pemesanan (ikon/judul/deskripsi/checklist), kartu info, catatan HTML dengan preview aman.
- Placeholder catatan: “Tuliskan langkah-langkah pemesanan di sini...”.

Data contract:

- Disimpan di `cms_pages` dengan `slug = 'cara-pemesanan'`:
  - `title`, `published`
  - `content.heading`, `content.subtitle`
  - `content.body` (HTML/teks — catatan tambahan)
  - `content.steps[]` — `{ icon, title, description, points[] }`
  - `content.info_cards[]` — `{ icon, title, description }`
- Admin: `admin.cara-pemesanan.*` → `Admin/CaraPemesanan/Edit`.
- Public `/cara-pemesanan` → `Public/HowToOrder` via `CaraPemesananSettings::forStorefront()` (default steps jika kosong).
- Section beranda “Cara Pesan” tetap di `cms_pages.beranda` → `content.how_to_order` (`admin.beranda.how-to-order.*`).

### 2.5 Panel FAQ (`FAQEditor`) — **Implemented**

UI:

- Accordion list admin: expand/collapse, filter kategori, reorder (naik/turun), tambah/edit/hapus.
- Kategori: Umum & Profil Toko, Spesifikasi Material & Ukuran, Metode Pembayaran, Pengiriman & Pemasangan.

Data contract:

- `cms_pages.slug = 'faq'` (meta: `heading`, `subtitle`, `published`).
- Tabel `cms_faq_items`:
  - `id`
  - `cms_page_id`
  - `question`
  - `answer`
  - `category` (enum string di atas)
  - `status` (`active` | `archived`)
  - `sort_order`
- Admin: `admin.faq.*` → `Admin/Faq/Index` (tabs Aktif/Diarsipkan; form tambah on-demand; meta via tombol Pengaturan halaman).
- Public `/faq` → `Public/Faq` via `FaqSettings::forStorefront()` (grup per kategori, `status=active` saja).

### 2.6 Panel Masalah & Solusi Teknis (`MasalahSolusiEditor`) — **Implemented**

UI:

- List pasangan masalah/solusi (dua kolom), reorder, CRUD.
- Form: kolom kiri `problem`, kolom kanan `solution`.

Data contract:

- `cms_pages.slug = 'masalah-solusi'` (meta: `heading`, `subtitle`, `published`).
- Tabel `cms_problems_solutions`:
  - `id`
  - `cms_page_id`
  - `problem` (teks kendala; alias kontrak: problem_text)
  - `solution` (teks solusi; alias kontrak: solution_text)
  - `sort_order`
- Admin: `admin.masalah-solusi.*` → `Admin/MasalahSolusi/{Index,Form}`.
- Public `/masalah-dan-solusi` → `Public/MasalahSolusi` via `ProblemsSolutionsSettings::forStorefront()`.

### 2.7 Informasi Toko, Ketentuan Layanan, Kebijakan Privasi

UI:

- Canvas penuh text area dengan scrollbar + preview aman.  
- Sticky footer: “Simpan Pembaruan Dokumen” dan “Kembali ke Hub”.

Data contract:

- `cms_pages.slug`:
  - `tentang-kami` — **Implemented** (`admin.tentang-kami.*` → `Admin/CmsDocument/Edit`)
  - `storefront-platforms` — **Implemented** (`admin.storefront-platforms.*` → `Admin/StorefrontPlatforms/Edit`; `content.links`)
  - `ketentuan-layanan` — **Implemented** (`admin.ketentuan-layanan.*` → `Admin/CmsDocument/Edit`)
  - `kebijakan-privasi` — **Implemented** (`admin.kebijakan-privasi.*` → `Admin/CmsDocument/Edit`)
- `content.heading`, `content.body` (rich text / plain); public pages menampilkan via `Public/CmsPage` (sanitize).

### 2.8 Panel Hasil Pemasangan & Apa Kata Pelanggan (Galeri + Testimoni)

UI:

- Galeri foto (grid image) dengan label lokasi/nama pelanggan (contoh: “Pemasangan Bpk. Ahmad – Perumahan Kudus Indah”).  
- Badge status publish. [file:585]

Data contract:

- `cms_pages.slug = 'hasil-pemasangan'` dan `cms_pages.slug = 'testimoni'`.
- Tabel `cms_gallery_items`:
  - `id`
  - `cms_page_id`
  - `image_url` (stored via Media Module)
  - `label`
  - `published` (boolean; setara kontrak `status` published/draft)
  - `sort_order`
- Tabel `cms_testimonials`:
  - `id`
  - `cms_page_id` (FK → `cms_pages`, biasanya slug `testimoni`)
  - `product_id` (FK → `products.id`, **nullable**)
    - Jika diisi → ulasan tampil di tab **Ulasan** PDP produk tersebut (Stage 10).
    - Jika null → ulasan umum (hanya `/reviews` / halaman testimoni).
  - `customer_name`
  - `message` (teks ulasan; kontrak lama menyebut `text`)
  - `rating` (optional, 1–5)
  - `source` (enum string: `shopee`, `whatsapp`, `website`, `other`) — entri manual dari Shopee/WA termasuk di sini
  - `location` (optional)
  - `image_url` (optional)
  - `published` (boolean; setara kontrak `status` published/draft)
  - `sort_order`
- Public pages menampilkan hanya item `published = true`.
- **Hasil pemasangan** (`cms_gallery_items`) terpisah dari ulasan produk; jangan menggabungkan keduanya di PDP.
- **Admin (Inertia):**
  - Pengaturan Website → **Apa Kata Pelanggan Kami** (`admin.apa-kata-pelanggan.*`): meta `cms_pages.slug = testimoni` (`title`, `heading`, `subtitle`, `published`) + list `cms_testimonials` (reuse `Admin/Testimonials/Index`).
  - Pengaturan Website → **Hasil Pemasangan Kami** (`admin.hasil-pemasangan.*`): meta `cms_pages.slug = hasil-pemasangan` + list `cms_gallery_items` (reuse Index tab foto).
  - Monitoring → Ulasan (`admin.testimonials.*`): dual tab **Ulasan Website** / **Ulasan Foto**; form `Admin/Testimonials/Form` + `Admin/Testimonials/GalleryForm`; publish/unpublish per baris.
  - Public `/reviews` → `Public/Reviews` props `pageMeta` (`TestimonialPageSettings`) + `installationMeta` (`InstallationPageSettings`) + published testimoni / gallery.

---

## 3. Dashboard Performa Toko – Data Contract

Dashboard Performa Toko adalah halaman analitik yang menampilkan metrik bisnis dan customer data. Visual mengikuti DESIGN Bagian B + dashboard Blade yang ada.

**Implemented (Inertia):** `Admin/Analytics/StorePerformance` via `StorePerformanceService` — period filters, KPI grids (Penjualan / Kunjungan & Layanan / Operasional), trend charts, top products, customers, payment mix, CSV export. Omzet = orders with status `processing|shipped|delivered|completed`. Visitors = `performance_metrics.storefront_unique_visitors`.

### 3.1 KPI Cards

Blueprint:

- KPICards_Summary_Grid:
  - Card_KPI_1: Total Omset Penjualan.  
  - Card_KPI_2: Volume Kunjungan Pengunjung.  
  - Card_KPI_3: Total Pesanan Selesai Fulfillment. [file:585]

Di beranda screenshot juga terlihat:

- Omset Hari Ini.  
- Jumlah Order.  
- Jumlah Unit.  
- Panel Performa Toko (Jumlah Pengunjung, Tingkat Konversi, Customer Baru, Customer Order Ulang). [file:586]

Data contract:

- Omset Hari Ini:
  - Dihitung dari Orders dengan `order_status` di `completed` dan `created_at` = hari ini (atau berdasarkan `payment_confirmed_at` sesuai kebijakan).  
- Jumlah Order:
  - Count orders hari ini (semua status kecuali cancelled).  
- Jumlah Unit:
  - Sum quantity dari `order_items` untuk order hari ini.

Performa Toko:

- Jumlah Pengunjung:
  - Berdasarkan analytics (e.g., page views, unique visitors) yang sistem rekam atau sumber analitik eksternal.  
- Tingkat Konversi:
  - `total_orders / total_visitors` pada periode dipilih (Hari ini, 7 hari terakhir, 30 hari, dsb.). [file:585][web:542][web:545]
- Customer Baru:
  - Count customers (atau nomor WhatsApp unik) yang pertama kali order dalam periode.  
- Customer Order Ulang:
  - Count customer yang memiliki lebih dari satu order, diklasifikasi per periode.

Setiap KPI card menampilkan:

- Nilai utama (Rp, jumlah).  
- Badge tren (%) vs periode sebelumnya (e.g., 7 hari lalu, 30 hari lalu), seperti indikator tren di DESIGN/dashboard.  
- Label teks pembanding (“dibanding 7 hari lalu…”).

### 3.2 Dropdown Periode & Chart

Blueprint:

- DropdownPeriodFilter dengan opsi: Hari Ini, 7 Hari Terakhir, 30 Hari Terakhir, Bulan ini, Rentang Kustom. [file:585]  
- ChartGraph_Canvas: sumbu X waktu, sumbu Y nilai (penjualan, order, dll.). [file:585]

Data contract:

- Periode yang dipilih harus mempengaruhi:
  - perhitungan KPI,  
  - data chart (penjualan per jam/hari/bulan),  
  - teks pembanding di label.  
- Backend menyediakan API/endpoint yang menerima parameter periode dan mengembalikan:
  - series data (timestamp + value),  
  - aggregated KPI data.

Frontend mengikuti kontrak DESIGN / stage-9a:

- Opsi “Hari Ini” → sumbu X per jam.  
- “7 Hari Terakhir” → per tanggal.  
- “Rentang Kustom” memicu UI pilih tanggal start/end dan backend menghitung berdasarkan rentang itu. [file:585][web:548][web:554]

### 3.3 Customer Dataset Table

Blueprint:

- `AdvancedDataTable_Customers`: nama, nomor telepon, frekuensi belanja, total kontribusi uang. [file:585]

Data contract:

- Sumber data:
  - Order Module + Customer tracking:
    - `customer_name` (dari order snapshot atau profile).  
    - `customer_phone` (WhatsApp number).  
    - `order_count` (frekuensi belanja).  
    - `total_spent` (sum order total).  
- Tabel harus:
  - mendukung filter & sort sesuai kontrak (minimal: sort by total_spent, order_count).  
  - tampilkan data konsisten dengan modul Order & Payment.

---

## 4. Beranda Admin Ragil Aluminium – Sinkronisasi dengan Performa & Order

Screenshot beranda menunjukkan Beranda Admin sebagai kombinasi:

- Panel Omset Hari Ini / Jumlah Order / Jumlah Unit.  
- Panel Performa Toko.  
- Bar “Status Order” (Perlu Konfirmasi, Diproses, Dikirim, Sampai, Retur Diproses) dengan count.  
- Blok “Perlu Perhatian” (order terlambat dalam status tertentu).  
- Aksi Cepat.  
- Tabel “Pesanan Terbaru”. [file:586]

### 4.1 Status Order Bar

Data contract:

- Perlu Konfirmasi:
  - orders dengan `order_status = pending_payment` atau `status` khusus “Perlu Konfirmasi” yang belum berubah dalam threshold (misal < 24 jam).  
- Diproses:
  - `order_status = processing / awaiting_fulfillment`.  
- Dikirim:
  - `order_status = shipped`.  
- Sampai:
  - `order_status = delivered`.  
- Retur Diproses:
  - `order_status = return_in_process` atau `issue` terkait retur. [Stage 4]

Count di bar di Beranda harus sama dengan jumlah order yang akan terlihat jika admin membuka halaman Pesanan dengan filter status sesuai.

### 4.2 Perlu Perhatian Block

Data contract:

- Perlu Konfirmasi > 24 jam:
  - orders dengan status “Perlu Konfirmasi” dan `created_at` atau `pending_since` lebih dari 24 jam.  
- Diproses > 24 jam:
  - orders `processing` lebih dari 24 jam sejak payment confirmed.  
- Pesanan Sampai > 2 Hari Belum Selesai:
  - orders `delivered` lebih dari 2 hari tapi belum `completed`.  
- Retur Diproses > 7 Hari:
  - orders `return_in_process` lebih dari 7 hari. [file:586][Stage 4]

Blok ini mengambil subset order yang melampaui threshold dan menampilkan count plus link ke daftar Pesanan dengan filter yang tepat (misalnya klik card membawa admin ke halaman Pesanan dengan filter “Perlu Konfirmasi > 24 jam”).

### 4.3 Pesanan Terbaru Table

Data contract:

- Sumber: Order Module (Stage 4).  
- Kolom:
  - No. Order (`order_id` / human‑friendly code #RA-000001).  
  - Penerima (nama pelanggan).  
  - Status (mapping backend order_status ke label UI).  
  - Total Tagihan (total order).  
  - Metode (misal Transfer Bank).  
  - Produk (ringkasan jumlah produk & unit).  
  - Status Terakhir (timestamp relative: “1 Hari 16 Jam”).  
  - Aksi (icon detail, edit, dsb.). [file:586]

Beranda harus:

- menampilkan beberapa order paling baru (misalnya 5–10).  
- menyediakan link “Lihat Semua Pesanan” ke halaman Pesanan penuh dengan daftar semua order.

### 4.4 Panel Promo & Flash Sale Aktif

Data contract:

- Sumber: produk visible yang punya atribut promo internal eksplisit (`promo_compare_price` / alias harga coret, `promo_flash_sale` / alias `flash_sale`) — dievaluasi via `ProductPromotionMetadata::forProduct(..., applyGlobalEventDiscount: false)`. Diskon event global (`STOREFRONT_PRODUCT_CARD_DISCOUNT_PERCENT`) **tidak** dihitung.
- Baris menampilkan: `parent_sku`, nama, chip `-N%` (bila ada harga coret valid), label Flash Sale, dan penanda “Tampil di Home” (bila `homepage_popular = true`); klik baris membuka detail produk admin.
- Panel menampilkan maksimal 8 baris + total count; link “Kelola banner” menuju halaman Banner Beranda (tempat toggle banner otomatis).
- Panel Dashboard tetap read-only; pengelolaan Flash Sale per produk lewat `admin.flash-sale.*` (menulis `product_attributes` `promo_flash_sale` / `promo_compare_price`) atau halaman Atribut produk; kurasi Home lewat field `homepage_popular` di form produk.
- Periode kampanye global disimpan di `cms_pages.slug = flash-sale` → `content.period` (`enabled`, `starts_at`, `ends_at`) via `PUT /admin/flash-sale/period`. Tidak ada tabel kampanye terpisah. Storefront menampilkan label/listing Flash Sale hanya saat periode `live`.

---

## 5. Agent Checklist

Sebelum mengembangkan atau mengubah code yang menyentuh Admin CMS atau Performa Toko, agents must:

- [ ] Treat `docs/DESIGN.md` + admin dashboard Blade + `docs/sitemap/admin-*` as **visual source of truth**; do not remove or rename sidebar items without explicit design updates.  
- [ ] Implement CMS storage (`cms_pages` + child tables) so that every panel (Beranda, Model Produk, Cara Pemesanan, FAQ, Masalah & Solusi, Informasi Toko, Legalitas, Testimoni, Hasil Pemasangan) can save and load data exactly matching the fields in the UI.  
- [ ] Ensure public website reads from CMS data and reflects the content edited in these admin panels (no hardcoded text for pages covered by CMS).  
- [ ] Implement Dashboard Performa Toko metrics (KPI, trends, customer dataset) using data from Order, Payment, Customer, and analytics modules with period filters matching the dropdown options.  
- [ ] Make Beranda Admin’s “Status Order”, “Perlu Perhatian”, and “Pesanan Terbaru” counters and lists consistent with the Order module and thresholds defined in Stage 4.  
- [ ] Avoid building parallel, conflicting dashboards or CMS screens; extend existing ones if needed, preserving naming and grouping from the sidebar.  
- [ ] Keep UI‑side validations and states (loading skeleton, error highlights) consistent with DESIGN, but handle data integrity and business rules in backend services.  
- [ ] Document any new fields or behaviours in this contract / DESIGN if they change the UI contract, rather than silent changes.

Any implementation that breaks alignment between DESIGN/admin UI and backend data/behaviour must be corrected to comply with this Stage 9A contract.
