# Skill: Stage 9B – Admin Operasional UI Contract (Pesanan, Produk, Import, Media, WhatsApp)

This document defines the **UI–backend contract** for the main operational modules in the Ragil Aluminium admin: Pesanan, Produk, Import, Media, dan WhatsApp Otomatis.  
All agents must align UI behaviour with the backend modules from Stage 2–8 and the existing dashboard design; no existing menu or feature from the current UI may be removed or renamed without explicit design change.

---

## 1. Sidebar Structure & Starting Point

### 1.1 Sidebar Modules (Existing Design)

Based on the current admin UI design: [file:586]

- **Beranda** – Dashboard admin Ragil Aluminium.
- **Pesanan** – Halaman utama operasional order.
- **Produk**:
  - Daftar Produk (`admin.products.*` + variants/attributes)
  - Import (`admin.imports.*` — bulk Shopee/internal)
  - Import Performance (`admin.analytics.import-performance` — metrik job import)
  - Media Library (`admin.media.library` — shared asset katalog)
  - Riwayat Media (`admin.media.history` — histori pekerjaan media)
- **Harga & Promo**:
  - Promo Toko
  - Flash Sale
  - Voucher Toko (`admin.vouchers.*` → tabel `store_vouchers`; publish eksklusif 1 aktif; apply di checkout)
  - Bayar COD / Biaya COD (`admin.cod-settings.*` → `cms_pages.checkout.content.cod`; fee masuk `orders.cod_fee_amount`)
  - Subsidi Ongkir (`admin.shipping-subsidy.*` → `cms_pages.checkout.content.shipping_subsidy`; net ongkir + `orders.shipping_subsidy_amount`)
- **Komunikasi**:
  - WhatsApp Otomatis (`admin.whatsapp.templates.*` + `admin.whatsapp.connection` → 5 trigger Stage-8; toggle/edit; Cloud API status)
- **Performa Toko** (top-level, Analytics):
  - `admin.analytics.store-performance` → pembukuan KPI/omzet/produk/customer + CSV; visitor via `performance_metrics`.
- **Pelanggan & Monitoring**:
  - Customer (`admin.customers.*` → tabel `customers`; sync dari order; fraud/status turunan; CSV)
  - Ulasan
- **Pengaturan Website**:
  - Model Pembeli
  - Model Produk
  - Cara Pemesanan
  - Sering Ditanyakan
  - Masalah & Solusi
  - Informasi Toko
  - Ketentuan Layanan
  - Kebijakan Privasi
  - Apa Kata Pelanggan Kami
  - Hasil Pemasangan Kami
- **Akun & Sistem**:
  - Log Aktivitas (`admin.activity-logs.*`) dan Notifikasi (`admin.notifications.index`).
  - Profil Saya (`admin.profile.*` → edit nama/email/password akun login; peran read-only)
  - Manajemen Admin (`admin.users.*` → `Admin/Users/{Index,Form}`; filter status; canonical role `admin`; equal-admin — no role hierarchy; guard self + last active admin). See `docs/contracts/ROLE-AND-STATUS-CONTRACT.md`.
  - Pengaturan Sistem (`admin.settings.*` → status integrasi env, read-only)
- Logout.

### 1.2 Behaviour Principle

- Admin **selalu masuk via Beranda** setelah login. [file:586]  
- Dari Beranda, mereka melihat ringkasan order dan performa, lalu **klik Pesanan** untuk bekerja detail pada order.  
- Pesanan adalah modul operasional utama; **Produk** (daftar + Import + Media) dan WhatsApp Otomatis mendukungnya.

---

## 2. Halaman Pesanan (Order Management)

Halaman Pesanan adalah UI utama untuk mengelola order dan harus sinkron dengan Order, Payment, Shipping, dan WhatsApp modules (Stage 4, 7, 8).

### 2.1 List Pesanan

UI behaviour:

- Tabel list pesanan dengan kolom minimal:
  - No. Order (kode seperti #RA-000001).  
  - Penerima (nama pelanggan).  
  - Status Order (label seperti “Perlu Konfirmasi”, “Diproses”, “Dikirim”, “Sampai”, “Retur Diproses”).  
  - Total Tagihan.  
  - Metode Pembayaran (Transfer Bank, dsb.).  
  - Produk (ringkasan jumlah produk & unit).  
  - Waktu status terakhir (misal “1 Hari 16 Jam”).  
  - Aksi (lihat detail, edit tertentu jika diizinkan). [file:586]

- Filter & search:
  - search box global (cari No. Order, nama penerima, nomor WA, provinsi).  
  - filter berdasarkan:
    - `order_status` (Perlu Konfirmasi, Diproses, Dikirim, Sampai, Retur Diproses, Completed, Issue).  
    - `payment_status` (`pending`, `paid`, `refunded`).
    - `shipping_status` (`pending_pickup`, `in_process`, `in_transit`, `delivered`, `cancelled`).
  - opsi filter waktu (Hari ini, 7 hari terakhir, rentang tanggal).

Data contract:

- List Pesanan membaca dari Order Module:
  - `orders` + `order_items` + Payment & Shipping relasi.  
- Label status pada UI adalah mapping deterministik dari kombinasi:
  - `order_status`,
  - `payment_status`,
  - `shipping_status`.

- Ringkasan di atas daftar mengikuti query filter yang sama dengan kartu order:
  - `count` adalah jumlah order yang cocok dengan seluruh filter aktif.
  - `total_value` adalah jumlah `orders.total_amount` dari order yang cocok.
  - Aksi perubahan status dari daftar mempertahankan status, pencarian, urutan,
    status pembayaran, status pengiriman, dan rentang waktu aktif.

### 2.2 Detail Pesanan

UI behaviour:

- Halaman detail pesanan menampilkan:

  - **Header**:
    - No. Order.  
    - Status utama (badge).  
    - Total tagihan & metode pembayaran.  

  - **Customer & Alamat**:
    - Nama penerima.  
    - Alamat lengkap (provinsi, kota, kecamatan, detail).  
    - Nomor WhatsApp pelanggan (klik untuk open chat via WA link).  

  - **Produk dalam Pesanan**:
    - List item: nama produk, model/varian, jumlah, harga per unit, subtotal.  

  - **Timeline Status**:
    - Garis waktu perubahan `order_status` dan `shipping_status`, misalnya:
      - Order dibuat (pending_payment).  
      - Pembayaran dikonfirmasi.  
      - Diproses.  
      - Dikirim (shipping start).  
      - Sampai (delivered).  
      - Completed atau Issue/Retur.  

  - **Payment Panel**:
    - `payment_status` (pending/paid/refunded).
    - link ke bukti pembayaran (gambar/file/WA message).  

  - **Shipping Panel**:
    - carrier (misal JNT Cargo).  
    - nomor resi/waybill.  
    - status pengiriman (`in_transit` / `delivered`).

  - **WhatsApp Panel**:
    - list `whatsapp_messages` terkait order (direction, waktu, status).  
    - tombol kirim pesan template (order_created, payment_confirmed, order_shipped, dll). [Stage 8]

Data contract:

- Detail Pesanan adalah “single source of truth” yang menggabungkan:
  - Order Module snapshot.  
  - Payment Module.  
  - Shipping Module.  
  - WhatsApp Module (templates + messages).  
- Perubahan status di detail harus:
  - memanggil service di modul yang tepat (Order/Payment/Shipping),  
  - otomatis memicu event WhatsApp sesuai Stage 4 & 8.

---

## 3. Halaman Produk (Catalog Management)

Produk adalah admin UI untuk Catalog Module (Stage 3) yang juga terkait Import & Media (Stage 5).

### 3.1 List Produk

UI behaviour:

- List grid/tabel produk:
  - Nama Produk.  
  - Kategori (Window/Door/Bouven).  
  - Model (Jungkit, Sliding, Swing, dll.).  
  - Status publik (aktif/nonaktif).  
  - Jumlah varian.  
  - Link ke detail produk.  

- Filter:
  - berdasarkan kategori, model, status aktif, atau search nama/SKU.

Data contract:

- List Produk membaca dari `products` tabel:
  - `product_category`, `product_model`, `design_variant`, `name`, publish status.

### 3.2 Detail Produk & Varian

UI behaviour:

- Halaman detail produk menampilkan:

  - Info produk dasar:
    - nama, deskripsi, kategori, model, design variant.  
  - Daftar varian:
    - varian per `variant_sku` dengan atribut (warna, ukuran, kaca, dll.), harga, stok, berat, dimensi.  
  - Media:
    - list gambar/video terkait produk dan varian (Image 1–9), termasuk pemilihan
      asset yang sudah ada tanpa upload ulang.
    - Admin dapat menautkan `product_media.product_variant_id` per kombinasi opsi (warna/kaca) lewat `Admin/Products/Media` atau form edit varian.  
  - Aksi:
    - tambah varian, edit varian, aktif/nonaktif varian.  
    - upload media baru (gambar/video), lihat status import media, cari berdasarkan
      label/jenis/status, dan pasang satu shared asset ke banyak produk.

Saat membuat parent product, form boleh mengaktifkan **Buat varian awal sekarang**. Jika aktif, admin wajib mengisi SKU varian, harga, dan stok manual; product dan varian awal dibuat dalam satu transaksi. Varian lanjutan tetap dikelola melalui halaman Kelola varian.

Data contract:

- Perubahan produk/varian di UI harus:
  - menggunakan service Catalog Module (single add/edit),  
  - tidak menulis langsung ke DB tanpa log.

- Media:
  - membaca dan mengupdate attachment `product_media` serta shared asset
    `media_assets` melalui controller/service Media Module.

### 3.3 Shortcut ke Import & Media

Untuk menjaga integrasi:

- Import & Media hidup di sidebar grup **Produk** (bukan grup “Operasional Katalog” terpisah).
- Halaman Daftar Produk punya shortcut toolbar:
  - “Import” → `admin.imports.index`
  - “Media” → `admin.media.index`
  - “Bulk update via Import” (dari detail) → halaman Import
  - “Kelola media produk” → `admin.products.media.byProduct`

Namun semua bulk operations tetap dilakukan melalui Import Module (Stage 5), bukan lewat aksi direct di halaman Produk.

---

## 4. Halaman Import (Import Jobs & Corrections)

Import UI adalah front‑end untuk Import Module yang sudah didefinisikan di Stage 5.

Form upload menyediakan sumber stok:

- **Gunakan stok dari file**: mempertahankan stok per baris spreadsheet.
- **Gunakan stok manual**: satu angka non-negatif diterapkan ke seluruh varian dalam job.

Mode dan nilai manual disimpan pada `import_jobs`, ditampilkan pada detail job, dicatat dalam raw row, dan digunakan kembali saat retry.

### 4.1 List Import Jobs

UI behaviour:

- Tabel job import:
  - ID Job atau label (misal “Import Produk Shopee 2026-07-08”).  
  - Tipe job:
    - `catalog_products`, `catalog_variants`, `inventory_stock_price`, `catalog_media`.  
  - File:
    - nama file + link download.  
  - Status:
    - `pending`, `running`, `completed`, `failed`.  
  - Rows:
    - total, success, failed.  
  - Waktu:
    - created_at, completed_at.  

- Filter:
  - berdasarkan tipe job, status job, rentang waktu.

Data contract:

- List Import Jobs membaca dari `import_jobs` tabel (Stage 5).  
- Link “lihat detail” membuka halaman detail job.

### 4.2 Detail Import Job & Correction

UI behaviour:

- Halaman detail job menampilkan:

  - Header:
    - tipe job, file, status, summary rows.  
  - Tabel `import_job_rows`:
    - row_index.  
    - ringkasan raw data (misal parent_sku, variant_sku, product name).  
    - status (`success`, `failed`).  
    - error_reason untuk baris gagal.  

  - Aksi:
    - “Download file koreksi” → file berisi baris gagal + kolom Error Reason.  
    - link ke entitas yang berhasil (optional).

Data contract:

- Download koreksi harus menggunakan data dari `import_job_rows` (hanya baris failed).  
- Re‑upload file koreksi menciptakan **import_job baru** dengan referensi ke job lama (parent_import_job_id).

---

## 5. Halaman Media (Product Media Status)

Media UI mengelola status download media dari import pipeline.

### 5.1 List Media per Produk/Varian

UI behaviour:

- Tabel/grid media:

  - Produk/Varian:
    - referensi ke produk/variant.  
  - Thumbnail gambar.  
  - Source URL (Shopee atau lainnya).  
  - Preview URL turunan WebP untuk gambar atau URL object video pada media disk.
  - Status:
    - attachment legacy `pending`, `downloading`, `downloaded`, `failed`; asset
      library `pending`, `downloading`, `ready`, `failed`, `archived`.
  - Error Reason (jika `failed`).  

- Filter:
  - berdasarkan status (show only failed, pending).  
  - berdasarkan produk/variant.

Data contract:

- Data diambil dari `product_media` + `media_assets` (Stage 5).
- Aksi:

  - “Coba download ulang” → memicu media worker untuk record tersebut.  
  - “Edit source URL” → update `source_url` lalu re‑queue download.

---

## 6. Halaman WhatsApp Otomatis (Templates & Logs)

WhatsApp Otomatis adalah UI untuk WhatsApp Module (Stage 8).

### 6.1 Template Management

UI behaviour:

- Panel list template:

  - Nama template (internal name dan WABA name).  
  - Category (Transactional, Marketing).  
  - Language.  
  - Status (Approved/Pending/Rejected).  
  - Last sync info (jika ada sync dengan WABA). [web:594][web:598]

- Aksi:
  - “Sync templates” – memanggil API WABA/BSP untuk sync status template (opsional).  
  - Tambah template (kalau diizinkan via provider) – form Name, Category, Language, Body, Header, Footer, Buttons (sesuai kontrak integrasi WhatsApp / stage-8).  
  - Mark aktif/inaktif di sistem (untuk memilih template mana yang digunakan oleh event order).

Data contract:

- Template metadata disimpan di `whatsapp_templates` (Stage 8).  
- Jika penyusunan template dilakukan melalui provider dashboard (Meta/BSP), UI ini tetap sinkron via API sync (status & list nama).

### 6.2 WhatsApp Logs

UI behaviour:

- Tabel log:

  - Waktu.  
  - Arah (`outbound` / `inbound`).  
  - Phone.  
  - Template (jika outbound template).  
  - Status (queued, sent, delivered, failed, read).  
  - Order terkait (link ke detail pesanan).  
  - Ringkasan isi pesan.

- Filter:
  - berdasarkan tanggal, phone, order, status, direction.

Data contract:

- Data diambil dari `whatsapp_messages` (Stage 8).  
- Perubahan status (delivery/read) via webhook harus tercermin di tabel ini.

---

## 7. Log Aktivitas & Monitoring

Menu “Log Aktivitas” dan “Monitoring → Customer, Ulasan” juga ada di sidebar; Stage 9B tidak merinci UI-nya secara penuh, tetapi:

- Log Aktivitas:
  - **Implemented:** Monitoring → `admin.activity-logs.index` (`Admin/ActivityLogs/Index`) dari `event_logs` — tab kategori (Semua / Kehadiran / Produk & Harga / Pesanan & Biaya / WhatsApp / Backup / Pengaturan Web), cari, sort, CSV export, tautan Detail ke entity.
  - harus menampilkan log admin operasional (perubahan status order, import job, media operations, WhatsApp template changes, login admin).  
  - Append-only: jangan hard-delete baris log.
- Monitoring Customer/Ulasan:
  - menampilkan data dari Customer table dan feedback/review terkait order.

Detail lebih dalam untuk menu ini bisa jadi Stage berikut, namun prinsipnya:

- Semua tindakan kritis (order status change, import job run, WA template change) harus tercatat dan bisa terlihat di Log Aktivitas.  

---

## 8. Agent Checklist

Sebelum mengembangkan atau mengubah modul operasional di Admin UI, agents must:

- [ ] Menganggap sidebar dan beranda pada desain sekarang sebagai struktur tetap; modul Pesanan, Produk, Import, Media, dan WhatsApp Otomatis tidak boleh dihapus atau diganti namanya tanpa keputusan desain eksplisit. [file:586]  
- [ ] Menjadikan halaman Pesanan sebagai UI utama untuk Order Module, dengan list & detail yang memetakan semua status dan relasi (Payment, Shipping, WhatsApp) sesuai Stage 4 & 8.  
- [ ] Memastikan Beranda Admin (Status Order, Perlu Perhatian, Pesanan Terbaru) selalu sinkron dengan data yang terlihat di halaman Pesanan. [file:586]  
- [ ] Mengimplementasikan halaman Produk sebagai front‑end Catalog Module, menyediakan list, detail, dan per‑produk varian management tanpa mengganggu Import pipeline.  
- [ ] Menggunakan halaman Import untuk semua bulk operasi katalog/inventory, menampilkan job & row logs dan correction flows sesuai Stage 5.  
- [ ] Menggunakan halaman Media untuk memonitor status download media, memperbaiki source URL, dan men‑trigger ulang jobs tanpa mengubah pipeline dasar.  
- [ ] Menggunakan halaman WhatsApp Otomatis untuk mengelola templates & logs, dan tidak memanggil WhatsApp API langsung dari modul lain; semua via WhatsApp Module.  
- [ ] Menjaga agar setiap UI action yang mengubah data (status order, katalog, import, media, WA) memanggil service/module backend yang sesuai, bukan manipulasi database langsung.  
- [ ] Mencatat perubahan kritis ke Log Aktivitas sehingga monitoring dan audit dapat dilakukan.  

Setiap perubahan pada Admin UI operasional yang tidak sesuai dengan kontrak ini harus dikoreksi agar selaras dengan desain Ragil Aluminium dan modul backend yang sudah ditetapkan.
