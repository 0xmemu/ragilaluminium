# Peta Data Dummy/Test di Database Dev (VPS 209)

Dibuat: 2026-08-22. Tujuan: memudahkan pembersihan data uji sebelum deploy ke
VPS production (202.74.74.87). DB dev `ragil_aluminium` berisi campuran data
asli (import katalog, dataset pos) dan data dummy/test (order uji, seeder QA,
traffic bot).

## Cara pakai cepat

```bash
# 1. Lihat apa yang akan dihapus (TANPA menghapus apa pun)
php artisan dev:cleanup-dummy

# 2. Eksekusi pembersihan inti (order test, testimonial seeder, user dev,
#    promo seeder, sesi) — TIDAK menyentuh katalog
php artisan dev:cleanup-dummy --yes

# 3. Opsional, bila mau bersih total: tambah data performa + katalog
php artisan dev:cleanup-dummy --yes --visitors --katalog --with-sequences
```

Command aman: default = dry-run; `--yes` baru menghapus. Semua dalam satu
transaksi DB. `--katalog` menghapus produk/media hasil import (bukan dummy
sengaja, tapi data dev — keputusan hapus/pertahankan ada di Anda).

---

## A. Order test — 6 order, SEMUA dummy ❌

| order_number | customer_name | status | total | asal |
|---|---|---|---|---|
| `ORD26080003` | Pembeli Uji Coba | pending_payment | 10.294.800 | E2E checkout 22 Agt |
| `ORD26080002` | bian | pending_payment | 7.275.000 | test checkout 21 Agt |
| `ORD26080001` | febrian afik | shipped | 10.205.000 | test checkout 21 Agt |
| `RA-TEST-TRACK` | Pembeli Test | shipped | 2.015.000 | seed uji tracking 18 Agt |
| `RA-260815-0002` | Febrian Afik Dwi Susanto | cancelled | 3.308.500 | test 15 Agt |
| `RA-260810-0001` | Febrian Afik Dwi Susanto | cancelled | 3.308.500 | test 10 Agt |

**Tidak ada satu pun order asli di dev.** Ini yang mengisi KPI Performa Toko
(omzet 2.015.000, "customer" Pembeli Test/bian, konversi 6 order/11.430
pengunjung).

Turunan yang ikut terhapus otomatis (via command):
- `order_items` (8 baris), `payments` (6), `shipping_records` (2),
  `shipping_tracking_events` (10), `whatsapp_messages` (order_id 100000-100002),
  `event_logs` entity_type=order (order.created/status_changed/edited)

**Cara identifikasi**: `order_number IN (daftar di atas)` ATAU
`customer_name IN ('Pembeli Test','Pembeli Uji Coba','bian')`.
⚠️ Jangan pakai pola `RA-2608%` sebagai penanda (bisa kena order asli di prod).

## B. Testimonial fiktif — 62 baris, semua published ❌

Semua `cms_testimonials` berasal dari seeder QA (TestimonialSeeder/
StorefrontQaSeeder): nama generik (Budi Santoso, Dewi Lestari, Yudi Hartono...),
dibuat massal 18 Agt + pola harian Juni, semua `source=website`, `published=1`.
Tampil di storefront /reviews dan beranda.

**Cara identifikasi**: seluruh isi tabel (62/62). Di prod diisi ulang manual
lewat admin atau order nyata.

## C. User dev — 3 akun ❌

| id | name | email | role |
|---|---|---|---|
| 1 | QA Admin | qa.admin@example.com | admin |
| 12 | Dev Agent | dev.agent@ragilaluminium.test | admin |
| 13 | Febrian | febrian@333labs.tech | admin |

(Plus akun `tmp-*@ragil.test` yang dibuat sesi verifikasi — sudah dihapus.)
Di prod, admin dibuat manual setelah deploy.

## D. Promo/banner/announcement seeder ❌

- `promotions`: 1 ("Flash Sale Agustus", active) + `promotion_items`: 6
- `cms_banners`: 2 (Jendela Swing, Boven jungkit)
- `announcements`: 6
- `product_attributes` promo: `promo_compare_price`, `promo_flash_sale`
  (seeder ProductCardPromotionSeeder)

**Cara identifikasi**: seluruh isi (semua dari seeder). Sama seperti
testimonial: dipakai untuk QA tampilan.

## E. Data performa visitor — tercemar bot ❌ (opsional)

- `performance_visitor_events`: 11.471 baris. Anomali: **21 Agt = 7.527
  pengunjung** vs hari lain 300-500 (20x lipat, pola bot/script). 22 Agt = 1.597.
- `performance_metrics`: 498 baris (page views 14.901, unique visitors).
- `sessions`: 10.873 baris (sebagian besar bot/test).

Pengunjung 11.430 di KPI Performa Toko = mayoritas bot, bukan manusia.
Kategori ini TIDAK dihapus default command (flag `--visitors`), karena
mungkin masih berguna untuk QA grafik.

## F. Katalog & media import dev — BUKAN dummy ⚠️ (keputusan Anda)

- `products`: 50 (SKU SP..., nama realistis — hasil ImportShopeeCatalog)
- `product_variants`: 612, `sub_models`: 30, `cms_model_products`: 8
- `media_assets`: 171 (169 dari import job #2), `product_media`: 234
- `import_jobs`: 2 (shopee_mass_upload, 8 Agt), `import_job_rows`: 662

Ini **data import nyata**, bukan fiktif — tapi dari lingkungan dev. Untuk
go-live prod: import ulang dari sumber asli (Shopee mass upload) atau migrasi
terkontrol. Command `--katalog` menghapusnya bila Anda mau start bersih.

## G. Data yang TIDAK boleh dihapus ✅

| Data | Alasan |
|---|---|
| `postal_code_mappings` (81.058) + `postal_datasets` (1) | dataset pos asli, dipakai validasi alamat checkout |
| `whatsapp_templates` (8) | katalog template, disinkronkan via seeder |
| `cms_pages` (12) + `cms_faq_items` (7) | konten CMS (beranda, cara pemesanan, dokumen) |
| `categories` (3), `cms_model_products` (8) | taksonomi asli |
| `config` (cod settings, subsidi ongkir, dll) | setting operasional (perlu dicek isinya sebelum deploy) |
| `migrations` (80) | riwayat schema |

## Checklist sebelum go-live prod (ringkas)

1. `php artisan dev:cleanup-dummy --yes --visitors` (inti + performa)
2. Putuskan katalog: `--katalog` atau migrasi import
3. `php artisan optimize:clear` + verifikasi halaman admin & storefront
4. Reset `order_number_sequences` bila perlu (`--with-sequences`)
5. Cek ulang log error pasca-pembersihan
