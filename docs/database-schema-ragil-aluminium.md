# Database Schema - Ragil Aluminium Website

**Generated 2026-08-09 from the live production database (SQLite).**
Source of truth: `database/migrations/` (forward-only, no wipe). All agents must treat this as the canonical data model; any new table/column must be added to both a migration and this document.

Legend: PK = primary key, FK = foreign key, UQ = unique, IDX = index, NN = NOT NULL.

## 0. Pemformatan ID Publik — SKU & Nomor Order (Fase 4, FINAL)

Produk & varian buatan admin/website (bukan import Shopee) memakai SKU opak acak, TANPA dash:

- Product `parent_sku` = `RA` + 10 karakter acak (alfabet aman-URL tanpa 0/O/1/l), mis. `RAK7X2P9MFQ`.
  Dibuat hanya saat create/duplicate, IMMUTABLE — edit atribut tidak mengubah SKU.
- Variant `variant_sku` = `RA` + token acak independen 6–8 karakter, TANPA dash, unik & opak.
  Asosiasi varian ke produk lewat FK `product_variant.product_id`, BUKAN parse SKU.

Nomor order (`orders.order_number`) = `ORD` + `YYMM` + seq 4 digit (11 karakter), mis. `ORD26080001`.
Alokasi via `order_number_sequences` kunci `order-YYMM` (`SequenceService::next`) dalam transaksi
terkunci (`lockForUpdate`) sehingga unik/anti-bentrok; kunci per bulan membuat seq reset otomatis tiap bulan.

### Kompatibilitas legacy (TETAP resolve, JANGAN di-ubah)
- Import Shopee: `parent_sku` = `SP{id}`, `variant_sku` = `SP{id}-{variation_id}` (tetap dipakai).
- Nomor order lama `RA-{Ymd}-{seq}` tetap tersimpan & di-resolve via lookup string langsung.

### Strategi normalisasi data testing (AMAN — JANGAN jalankan di prod)
Data DB saat ini hanya: 2 order testing (`RA-260810-0001`, `RA-260815-0002`) + produk `SP{id}`
(sudah tanpa dash) + varian `SP{id}-{variation_id}` (berdash). Kontrak ini TIDAK mewajibkan migrasi
data: format baru hanya berlaku untuk SKU/order yang DIBUAT BARU; legacy SP/order dibiarkan apa adanya
agar tetap dapat di-resolve oleh referensi publik lama (constraint compat). Jika pembersihan dash
pernah diperlukan di kemudian hari: buat MIGRATION forward-only baru, tinjau SQL dengan
`php artisan migrate --pretend`, backup tabel terkait dahulu, dan JANGAN `migrate` di production
tanpa perintah eksplisit pengguna.

## 1. Catalog & Taxonomy

### 1.0 `categories` — sumber kanonik taxonomy katalog

- `id` (`INTEGER`), PK, NN
- `code` (`VARCHAR 50`), NN, UQ — kode kategori (Indonesia, mis. `JENDELA`/`PINTU`/`BOVEN`; admin dapat menambah)
- `name` (`VARCHAR 100`), NN — nama tampilan Bahasa Indonesia
- `slug` (`VARCHAR 100`), NN, UQ — slug URL kanonik (ASCII-safe)
- `seo_title` (`VARCHAR 191`), nullable
- `seo_description` (`VARCHAR 500`), nullable
- `sort_order` (`INTEGER UNSIGNED`), NN, default 0
- `is_active` (`BOOLEAN`), NN, default true
- `created_at` / `updated_at` (`DATETIME`), nullable

Sumber tunggal kategori untuk: navigasi mega menu (`CatalogTaxonomy::buildMegaMenuNav`),
slug URL + pemetaan kode produk (`CategoryUrl::codeToProductCode`/`categoryToSlug`),
pencarian (`CatalogSearch`), sitemap, breadcrumb, serta validasi form admin
(`Rule::in(productCategoryCodes())` / `Rule::in(modelCodes())`).
`products.product_category` tetap kolom kode internal (`VARCHAR`) untuk kompatibilitas
(legacy `WINDOW`/`DOOR`/`BOUVEN` via `CategoryUrl::codeToProductCode`); **JANGAN dihapus**
sebelum seluruh pemakai dipindah.

Migration terkait:
- `20260810_100926_create_categories_table.php` — create + seed WINDOW/DOOR/BOUVEN
- `2026_08_16_000001_normalize_category_slugs_to_indonesian.php` — normalisasi kode/slug ke
  Indonesia (grouped where/orWhere, preflight unique, snapshot `category_normalize_snapshot`
  agar rollback memulihkan penuh termasuk `name`/metadata)
- `2026_08_16_000002_relax_product_model_enum_to_string.php` — relaksasi `products.product_model`
  ENUM->VARCHAR(50) (MySQL) agar admin dapat menambah model baru (model dinamis)

### 1.1 `products`

- `id` (`INTEGER`), PK, NN
- `parent_sku` (`VARCHAR`), NN, UQ
- `name` (`VARCHAR`), NN
- `short_name` (`VARCHAR`), nullable
- `description` (`TEXT`), nullable
- `category_id` (`INTEGER`), NN
- `product_category` (`VARCHAR`), NN
- `status` (`VARCHAR`), NN, default 'active'
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `product_model` (`VARCHAR`), nullable
- `design_variant` (`VARCHAR`), nullable
- `homepage_popular` (`TINYINT(1)`), NN, default '0'
- `homepage_popular_sort` (`INTEGER`), NN, default '0'
- `popularity_seed` (`BIGINT UNSIGNED`), NN, default '0'; snapshot seed used only for ranking
- `popularity_seed_source_product_id` (`BIGINT`), nullable, FK -> products.id
- `popularity_seed_applied_at` (`TIMESTAMP`), nullable
- `popularity_seed_applied_by_user_id` (`BIGINT`), nullable, FK -> users.id

Indexes:
- `idx_products_status_category` (IDX on `status`, `product_category`)
- `idx_products_homepage_popular` (IDX on `homepage_popular`, `homepage_popular_sort`)
- `idx_products_category_model_design` (IDX on `product_category`, `product_model`, `design_variant`)
- `idx_products_category_id` (IDX on `category_id`)

### 1.2 `product_variants`

- `id` (`INTEGER`), PK, NN
- `product_id` (`INTEGER`), NN, FK -> products.id
- `variant_sku` (`VARCHAR`), NN, UQ
- `variation_1_name` (`VARCHAR`), nullable
- `variation_1_option` (`VARCHAR`), nullable
- `variation_2_name` (`VARCHAR`), nullable
- `variation_2_option` (`VARCHAR`), nullable
- `price` (`NUMERIC`), NN
- `stock` (`INTEGER`), NN, default '0'
- `weight_kg` (`NUMERIC`), nullable
- `width_cm` (`NUMERIC`), nullable
- `height_cm` (`NUMERIC`), nullable
- `depth_cm` (`NUMERIC`), nullable
- `status` (`VARCHAR`), NN, default 'active'
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `idx_product_variants_variations` (IDX on `variation_1_name`, `variation_1_option`, `variation_2_name`, `variation_2_option`)
- `idx_product_variants_product_id` (IDX on `product_id`)

### 1.3 `product_attributes`

- `id` (`INTEGER`), PK, NN
- `product_id` (`INTEGER`), nullable, FK -> products.id
- `product_variant_id` (`INTEGER`), nullable, FK -> product_variants.id
- `attribute_name` (`VARCHAR`), NN
- `attribute_value` (`VARCHAR`), NN
- `source` (`VARCHAR`), NN, default 'internal'
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `idx_product_attributes_name` (IDX on `attribute_name`)
- `idx_product_attributes_variant` (IDX on `product_variant_id`)
- `idx_product_attributes_product` (IDX on `product_id`)

### 1.4 `product_media`

- `id` (`INTEGER`), PK, NN
- `product_id` (`INTEGER`), NN, FK -> products.id
- `product_variant_id` (`INTEGER`), nullable, FK -> product_variants.id
- `position` (`INTEGER`), NN, default '1'
- `is_main_image` (`TINYINT(1)`), NN, default '0'
- `visibility` (`VARCHAR`), NN, default 'visible'
- `source_url` (`TEXT`), nullable
- `stored_path` (`VARCHAR`), nullable
- `stored_url` (`TEXT`), nullable
- `mime_type` (`VARCHAR`), nullable
- `size_bytes` (`INTEGER`), nullable
- `width_px` (`INTEGER`), nullable
- `height_px` (`INTEGER`), nullable
- `status` (`VARCHAR`), NN, default 'pending'
- `error_reason` (`TEXT`), nullable
- `created_by_import_job_id` (`INTEGER`), nullable, FK -> import_jobs.id
- `last_updated_by_import_job_id` (`INTEGER`), nullable, FK -> import_jobs.id
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `derivatives` (`TEXT`), nullable
- `show_in_catalog` (`TINYINT(1)`), NN, default '1'
- `is_installation` (`TINYINT(1)`), NN, default '0'
- `installation_caption` (`VARCHAR`), nullable
- `media_asset_id` (`INTEGER`), nullable, FK -> media_assets.id

Indexes:
- `idx_product_media_asset_visibility` (IDX on `media_asset_id`, `visibility`)
- `idx_product_media_visibility` (IDX on `visibility`)
- `idx_product_media_variant` (IDX on `product_variant_id`, `position`)
- `idx_product_media_status` (IDX on `status`)
- `idx_product_media_product` (IDX on `product_id`, `position`)
- `idx_product_media_is_main` (IDX on `product_id`, `is_main_image`)
- `idx_product_media_installation` (IDX on `is_installation`, `visibility`, `status`)
- `idx_product_media_created_job` (IDX on `created_by_import_job_id`)

### 1.5 `media_assets`

- `id` (`INTEGER`), PK, NN
- `kind` (`VARCHAR`), NN, default 'image'
- `label` (`VARCHAR`), nullable
- `source_url_hash` (`VARCHAR`), nullable, UQ
- `checksum` (`VARCHAR`), nullable, UQ
- `source_url` (`TEXT`), nullable
- `object_key` (`VARCHAR`), nullable, UQ
- `derivatives` (`TEXT`), nullable
- `mime_type` (`VARCHAR`), nullable
- `size_bytes` (`INTEGER`), nullable
- `width_px` (`INTEGER`), nullable
- `height_px` (`INTEGER`), nullable
- `duration_ms` (`INTEGER`), nullable
- `poster_asset_id` (`INTEGER`), nullable, FK -> media_assets.id
- `status` (`VARCHAR`), NN, default 'pending'
- `visibility` (`VARCHAR`), NN, default 'visible'
- `error_reason` (`TEXT`), nullable
- `created_by_import_job_id` (`INTEGER`), nullable, FK -> import_jobs.id
- `last_updated_by_import_job_id` (`INTEGER`), nullable, FK -> import_jobs.id
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `idx_media_assets_created_at` (IDX on `created_at`)
- `idx_media_assets_library` (IDX on `kind`, `status`, `visibility`)

### 1.5a media_processing_logs

Log pemrosesan media (unduh/finalisasi) berbasis polimorfik `loggable`.

- id (INTEGER), PK
- loggable_type (VARCHAR), NN
- loggable_id (INTEGER), NN
- entity_label (VARCHAR), nullable
- event (VARCHAR), NN
- message (TEXT), nullable
- created_at (DATETIME), nullable

Indexes:
- IDX on `loggable_type`, `loggable_id`
- IDX on `event`
- IDX on `created_at`

### 1.6 `sub_models`

- `id` (`INTEGER`), PK, NN
- `product_model` (`VARCHAR`), NN
- `code` (`VARCHAR`), NN
- `name` (`VARCHAR`), NN
- `description` (`TEXT`), nullable
- `image_url` (`VARCHAR`), nullable
- `sort_order` (`INTEGER`), NN, default '0'
- `is_active` (`TINYINT(1)`), NN, default '1'
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `sub_models_product_model_code_unique` (UQ  on `product_model`, `code`)

### 1.7 `customers`

- `id` (`INTEGER`), PK, NN
- `name` (`VARCHAR`), NN
- `phone` (`VARCHAR`), NN, UQ
- `email` (`VARCHAR`), nullable
- `default_address_line1` (`VARCHAR`), nullable
- `default_address_line2` (`VARCHAR`), nullable
- `default_city` (`VARCHAR`), nullable
- `default_province` (`VARCHAR`), nullable
- `default_postal_code` (`VARCHAR`), nullable
- `default_country` (`VARCHAR`), nullable
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

## 2. Promotions & Pricing

### 2.1 `promotions`

- `id` (`INTEGER`), PK, NN
- `type` (`VARCHAR`), NN, default 'store' — nilai: `store`, `flash_sale`
- `name` (`VARCHAR`), NN
- `status` (`VARCHAR`), NN, default 'draft' — nilai: `draft`, `scheduled`, `active`, `ended`, `finished`
- `starts_at` (`DATETIME`), nullable
- `ends_at` (`DATETIME`), nullable
- `discount_percent` (`INTEGER`), NN
- `sync_banner` (`TINYINT(1)`), NN, default '0'
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `promotions_type_status_index` (IDX on `type`, `status`)

### 2.2 `promotion_items`

- `id` (`INTEGER`), PK, NN
- `promotion_id` (`INTEGER`), NN, FK -> promotions.id
- `target_type` (`VARCHAR`), NN
- `target_id` (`VARCHAR`), NN
- `excluded` (`TINYINT(1)`), NN, default '0'
- `override_discount_percent` (`INTEGER`), nullable
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `promotion_items_promotion_id_target_type_target_id_unique` (UQ  on `promotion_id`, `target_type`, `target_id`)
- `promotion_items_promotion_id_index` (IDX on `promotion_id`)

### 2.3 `store_vouchers`

- `id` (`INTEGER`), PK, NN
- `name` (`VARCHAR`), NN
- `code` (`VARCHAR`), NN, UQ
- `discount_type` (`VARCHAR`), NN, default 'percent'
- `discount_value` (`NUMERIC`), NN
- `min_purchase` (`NUMERIC`), NN, default '0' (0 = tanpa minimum)
- `stackable` (`TINYINT(1)`), NN, default '0' (boleh ditumpuk dengan voucher lain)
- `starts_at` (`DATETIME`), nullable
- `ends_at` (`DATETIME`), nullable
- `published` (`TINYINT(1)`), NN, default '0'
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `idx_store_vouchers_active_window` (IDX on `published`, `starts_at`, `ends_at`)

## 3. Orders & Shipping

### 3.1 `orders`

- `id` (`INTEGER`), PK, NN
- `order_number` (`VARCHAR`), NN, UQ
- `customer_id` (`INTEGER`), nullable, FK -> customers.id
- `customer_name` (`VARCHAR`), NN
- `customer_phone` (`VARCHAR`), NN
- `customer_email` (`VARCHAR`), nullable
- `shipping_address_line1` (`VARCHAR`), NN
- `shipping_address_line2` (`VARCHAR`), nullable
- `shipping_city` (`VARCHAR`), NN
- `shipping_province` (`VARCHAR`), NN
- `shipping_postal_code` (`VARCHAR`), NN
- `shipping_country` (`VARCHAR`), NN, default 'Indonesia'
- `order_status` (`VARCHAR`), NN
- `payment_status` (`VARCHAR`), NN, default 'pending'
- `shipping_status` (`VARCHAR`), NN, default 'pending_pickup'
- `subtotal_amount` (`NUMERIC`), NN
- `shipping_amount` (`NUMERIC`), NN, default '0'
- `discount_amount` (`NUMERIC`), NN, default '0'
- `total_amount` (`NUMERIC`), NN
- `payment_method` (`VARCHAR`), NN, default 'transfer'
- `cod_flag` (`TINYINT(1)`), NN, default '0'
- `notes` (`TEXT`), nullable
- `admin_notes` (`TEXT`), nullable (catatan internal admin, migrasi 2026-08-10)
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `shipping_district` (`VARCHAR`), nullable
- `shipping_village` (`VARCHAR`), nullable
- `voucher_code` (`VARCHAR`), nullable
- `voucher_discount_amount` (`NUMERIC`), NN, default '0'
- `cod_fee_amount` (`NUMERIC`), NN, default '0'
- `shipping_subsidy_amount` (`NUMERIC`), NN, default '0'
- `checkout_idempotency_key` (`VARCHAR`), nullable, UQ

Indexes:
- `idx_orders_statuses` (IDX on `order_status`, `payment_status`, `shipping_status`)
- `idx_orders_customer_phone` (IDX on `customer_phone`)
- `idx_orders_created_at` (IDX on `created_at`)

### 3.2 `order_items`

- `id` (`INTEGER`), PK, NN
- `order_id` (`INTEGER`), NN, FK -> orders.id
- `product_id` (`INTEGER`), NN, FK -> products.id
- `product_variant_id` (`INTEGER`), nullable, FK -> product_variants.id
- `parent_sku` (`VARCHAR`), NN
- `variant_sku` (`VARCHAR`), nullable
- `name` (`VARCHAR`), NN
- `product_category` (`VARCHAR`), nullable, snapshot saat checkout
- `product_model` (`VARCHAR`), nullable, snapshot saat checkout
- `design_variant` (`VARCHAR`), nullable, snapshot saat checkout
- `variation_1_name` (`VARCHAR`), nullable
- `variation_1_option` (`VARCHAR`), nullable
- `variation_2_name` (`VARCHAR`), nullable
- `variation_2_option` (`VARCHAR`), nullable
- `unit_price` (`NUMERIC`), NN
- `quantity` (`INTEGER`), NN
- `line_subtotal` (`NUMERIC`), NN
- `line_discount` (`NUMERIC`), NN, default '0'
- `line_total` (`NUMERIC`), NN
- `note` (`TEXT`), nullable (catatan per item, migrasi 2026-08-10)
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `idx_order_items_variant_sku` (IDX on `variant_sku`)
- `idx_order_items_order` (IDX on `order_id`)
- `idx_order_items_catalog_identity` (IDX on `product_model`, `design_variant`)

Snapshot identity di atas adalah sumber historis analytics; jangan membaca katalog live untuk order lama.

### 3.2a order_return_cases

Ledger internal retur yang diisi admin. issue pada orders.order_status bukan bukti retur.
- id (INTEGER), PK
- order_id (INTEGER), NN, FK -> orders.id
- status (VARCHAR), NN, default open
- reason (VARCHAR), NN
- resolution_type (VARCHAR), nullable
- customer_notes, admin_notes (TEXT), nullable
- refund_amount, replacement_amount, additional_shipping_amount (NUMERIC), NN, default 0
- completed_at (DATETIME), nullable
- created_by_user_id, updated_by_user_id (INTEGER), nullable, FK -> users.id
- created_at, updated_at (DATETIME), nullable

Retur KPI hanya membaca case status=completed, completed_at pada periode, dan item dengan returned_quantity > 0.

### 3.2b order_return_items

- id (INTEGER), PK
- return_case_id (INTEGER), NN, FK -> order_return_cases.id
- order_item_id (INTEGER), NN, FK -> order_items.id
- requested_quantity, returned_quantity (INTEGER), NN, default 0
- created_at, updated_at (DATETIME), nullable

Nilai retur = snapshot order_items.unit_price * returned_quantity; refund/settlement disimpan terpisah pada case.

### 3.2c performance_visitor_events

- id (INTEGER), PK
- visitor_hash (VARCHAR(64)), NN
- visit_date (DATE), NN
- visited_at (DATETIME), NN
- created_at, updated_at (DATETIME), nullable

UQ visitor_hash + visit_date mendeduplikasi visitor per hari; agregasi periode memakai distinct hash dan bucket timezone aplikasi.

### 3.3 `order_number_sequences`

- `id` (`INTEGER`), PK, NN
- `sequence_key` (`VARCHAR`), NN, UQ
- `seq` (`INTEGER`), NN, default '0'
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

### 3.4 `shipping_records`

- `id` (`INTEGER`), PK, NN
- `order_id` (`INTEGER`), NN, FK -> orders.id
- `carrier_name` (`VARCHAR`), NN
- `service_name` (`VARCHAR`), nullable
- `waybill_number` (`VARCHAR`), NN, UQ
- `shipping_cost` (`NUMERIC`), NN, default '0'
- `status` (`VARCHAR`), NN, default 'pending_pickup'
- `status_raw` (`VARCHAR`), nullable
- `last_status_at` (`DATETIME`), nullable
- `tracking_url` (`TEXT`), nullable
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `idx_shipping_records_status` (IDX on `status`)
- `idx_shipping_records_order` (IDX on `order_id`)

### 3.4a shipping_tracking_events

Riwayat pelacakan pengiriman per waybill (J&T webhook/poll).

- id (INTEGER), PK
- shipping_record_id (INTEGER), NN, FK -> shipping_records.id
- order_id (INTEGER), NN, FK -> orders.id
- provider (VARCHAR 40), NN, default 'jnt'
- waybill_number (VARCHAR 100), NN
- provider_status (VARCHAR 80), nullable
- normalized_status (VARCHAR 40), nullable
- source (VARCHAR 24), NN, default 'poll'
- location (VARCHAR 160), nullable
- description (TEXT), nullable
- occurred_at (DATETIME), nullable
- event_hash (CHAR 64), NN
- created_at, updated_at (DATETIME), nullable

Indexes:
- UQ (`shipping_record_id`, `event_hash`)
- IDX (`order_id`, `occurred_at`)
- IDX (`waybill_number`, `occurred_at`)

### 3.5 `payments`

- `id` (`INTEGER`), PK, NN
- `order_id` (`INTEGER`), NN, FK -> orders.id
- `payment_method` (`VARCHAR`), NN
- `amount` (`NUMERIC`), NN
- `status` (`VARCHAR`), NN, default 'pending'
- `transaction_reference` (`VARCHAR`), nullable, UQ
- `evidence_url` (`TEXT`), nullable
- `paid_at` (`DATETIME`), nullable
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `idx_payments_status` (IDX on `status`)
- `idx_payments_order` (IDX on `order_id`)

## 4. WhatsApp

### 4.1 `whatsapp_templates`

- `id` (`INTEGER`), PK, NN
- `internal_key` (`VARCHAR`), NN, UQ
- `provider_template_name` (`VARCHAR`), NN
- `language_code` (`VARCHAR`), NN, default 'id'
- `category` (`VARCHAR`), NN, default 'transactional'
- `status` (`VARCHAR`), NN, default 'active'
- `description` (`TEXT`), nullable
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `updated_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `body_preview` (`TEXT`), nullable

Indexes:
- `idx_whatsapp_templates_status` (IDX on `status`)

### 4.2 `whatsapp_messages`

- `id` (`INTEGER`), PK, NN
- `direction` (`VARCHAR`), NN
- `order_id` (`INTEGER`), nullable, FK -> orders.id
- `phone_number` (`VARCHAR`), NN
- `internal_template_key` (`VARCHAR`), nullable
- `provider_message_id` (`VARCHAR`), nullable
- `content_text` (`TEXT`), nullable
- `content_payload` (`TEXT`), nullable
- `status` (`VARCHAR`), NN, default 'pending'
- `error_reason` (`TEXT`), nullable
- `sent_at` (`DATETIME`), nullable
- `received_at` (`DATETIME`), nullable
- `raw_payload` (`TEXT`), nullable
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `provider` (`VARCHAR`), NN, default 'meta'
- `provider_session` (`VARCHAR`), nullable

Indexes:
- `idx_whatsapp_messages_provider_status` (IDX on `provider`, `status`)
- `idx_whatsapp_messages_provider_message_id` (IDX on `provider_message_id`)
- `idx_whatsapp_messages_direction_status` (IDX on `direction`, `status`)
- `idx_whatsapp_messages_phone` (IDX on `phone_number`)
- `idx_whatsapp_messages_order` (IDX on `order_id`)

## 5. CMS & Content

### 5.1 `cms_pages`

- `id` (`INTEGER`), PK, NN
- `slug` (`VARCHAR`), NN, UQ
- `title` (`VARCHAR`), NN
- `content` (`TEXT`), nullable
- `published` (`TINYINT(1)`), NN, default '0'
- `updated_by_admin_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

### 5.2 `cms_banners`

- `id` (`INTEGER`), PK, NN
- `title` (`VARCHAR`), nullable
- `image_url` (`VARCHAR`), NN
- `link_url` (`VARCHAR`), nullable
- `sort_order` (`INTEGER`), NN, default '0'
- `published` (`TINYINT(1)`), NN, default '1'
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

### 5.3 `cms_faq_items`

- `id` (`INTEGER`), PK, NN
- `cms_page_id` (`INTEGER`), NN, FK -> cms_pages.id
- `question` (`VARCHAR`), NN
- `answer` (`TEXT`), NN
- `category` (`VARCHAR`), NN, default 'Umum & Profil Toko'
- `sort_order` (`INTEGER`), NN, default '0'
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `status` (`VARCHAR`), NN, default 'active'

Indexes:
- `idx_cms_faq_items_page_status` (IDX on `cms_page_id`, `status`)

### 5.4 `cms_gallery_items`

- `id` (`INTEGER`), PK, NN
- `cms_page_id` (`INTEGER`), NN, FK -> cms_pages.id
- `image_url` (`VARCHAR`), NN
- `label` (`VARCHAR`), nullable
- `published` (`TINYINT(1)`), NN, default '1'
- `sort_order` (`INTEGER`), NN, default '0'
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

### 5.5 `cms_model_products`

- `id` (`INTEGER`), PK, NN
- `name` (`VARCHAR`), NN
- `image_url` (`VARCHAR`), nullable
- `type` (`VARCHAR`), NN, default 'polos'
- `status` (`VARCHAR`), NN, default 'draft'
- `sort_order` (`INTEGER`), NN, default '0'
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `product_category` (`VARCHAR`), nullable
- `product_model` (`VARCHAR`), nullable
- `description` (`TEXT`), nullable
- `menu_href` (`VARCHAR 2048`), nullable (link menu override, migrasi 2026-08-10)
- `keywords` (`JSON`), nullable (array kata kunci 0-6, migrasi 2026-08-17; menggantikan kolom highlights)

Nilai enum `type`: `polos`, `ornamen`, `lainnya` (default `polos`).
Nilai enum `status`: `active`, `draft` (default `draft`).

Indexes:
- `cms_model_products_category_model_idx` (IDX on `product_category`, `product_model`)

### 5.6 `cms_problems_solutions`

- `id` (`INTEGER`), PK, NN
- `cms_page_id` (`INTEGER`), NN, FK -> cms_pages.id
- `problem` (`TEXT`), NN
- `solution` (`TEXT`), NN
- `sort_order` (`INTEGER`), NN, default '0'
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

### 5.7 `cms_testimonials`

- `id` (`INTEGER`), PK, NN
- `cms_page_id` (`INTEGER`), NN, FK -> cms_pages.id
- `customer_name` (`VARCHAR`), NN
- `message` (`TEXT`), NN
- `image_url` (`VARCHAR`), nullable
- `published` (`TINYINT(1)`), NN, default '1'
- `sort_order` (`INTEGER`), NN, default '0'
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `product_id` (`INTEGER`), nullable, FK -> products.id
- `rating` (`INTEGER`), nullable
- `source` (`VARCHAR`), NN, default 'other'
- `location` (`VARCHAR`), nullable
- `order_id` (`INTEGER`), nullable, FK -> orders.id; sumber verifikasi pembelian dan deduplikasi satu ulasan/order
- `author_admin_id` (`INTEGER`), nullable, FK -> users.id; admin pembuat ulasan admin
- `author_type` (`VARCHAR`), NN, default `customer` (`customer|admin`)
- `moderation_status` (`VARCHAR`), NN, default `approved` (`pending|approved|rejected`)
- `source_reference` (`VARCHAR`), nullable; referensi screenshot/WA atau sumber audit
- `media_items` (`JSON`), nullable; item type/url/source tambahan oleh admin
- `verified_at` (`TIMESTAMP`), nullable; terisi bila ditautkan ke order delivered/completed

Indexes:
- `cms_testimonials_product_published_idx` (IDX on `product_id`, `published`)

### 5.8 `product_popularity_boosts`

- `id` (`BIGINT`), PK, NN
- `source_product_id` (`BIGINT`), NN, FK -> products.id
- `target_product_id` (`BIGINT`), NN, FK -> products.id
- `enabled` (`TINYINT(1)`), NN, default '1'
- `seed_sold_count` (`BIGINT UNSIGNED`), NN, default '0'
- `notification_threshold` (`BIGINT UNSIGNED`), nullable
- `threshold_notified_at` (`TIMESTAMP`), nullable
- `disabled_at` (`TIMESTAMP`), nullable
- `disabled_by_user_id` (`BIGINT`), nullable, FK -> users.id
- `disabled_reason` (`VARCHAR(500)`), nullable
- `created_by_user_id` (`BIGINT`), nullable, FK -> users.id
- `updated_by_user_id` (`BIGINT`), nullable, FK -> users.id
- `created_at` / `updated_at` (`TIMESTAMP`), nullable

Indexes:
- `uq_popularity_boost_source_target` (UQ on `source_product_id`, `target_product_id`)
- `idx_popularity_boost_target_enabled` (IDX on `target_product_id`, `enabled`)

### 5.8 `announcements`

- `id` (`INTEGER`), PK, NN
- `text` (`VARCHAR`), NN
- `href` (`VARCHAR`), nullable
- `starts_at` (`DATE`), nullable
- `ends_at` (`DATE`), nullable
- `sort_order` (`INTEGER`), NN, default '0'
- `published` (`TINYINT(1)`), NN, default '1'
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

## 6. Users, Admin & Notifications

### 6.1 `users`

- `id` (`INTEGER`), PK, NN
- `name` (`VARCHAR`), NN
- `email` (`VARCHAR`), NN
- `email_verified_at` (`DATETIME`), nullable
- `password` (`VARCHAR`), NN
- `role` (`VARCHAR`), NN, default 'staff'
- `status` (`VARCHAR`), NN, default 'active'
- `remember_token` (`VARCHAR`), nullable
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `username` (`VARCHAR`), nullable, UQ

Indexes:
- `users_email_index` (IDX on `email`)
- `idx_users_role` (IDX on `role`)

### 6.2 `admin_notifications`

- `id` (`INTEGER`), PK, NN
- `type` (`VARCHAR`), NN
- `title` (`VARCHAR`), NN
- `body` (`TEXT`), nullable
- `order_id` (`INTEGER`), nullable, FK -> orders.id
- `href` (`VARCHAR`), nullable
- `read_at` (`DATETIME`), nullable
- `related_type` (`VARCHAR 80`), nullable (polimorfik target, migrasi 2026-08-14)
- `related_id` (`INTEGER`), nullable, FK polimorfik (no constraint) (migrasi 2026-08-14)
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `admin_notifications_read_at_index` (IDX on `read_at`)
- `admin_notifications_related_idx` (IDX on `related_type`, `related_id`)
- `admin_notifications_order_id_index` (IDX on `order_id`)
- `admin_notifications_type_index` (IDX on `type`)

### 6.3 `password_reset_tokens`

- `email` (`VARCHAR`), PK, NN
- `token` (`VARCHAR`), NN
- `created_at` (`DATETIME`), nullable

## 7. Import, Events & Monitoring

### 7.1 `import_jobs`

- `id` (`INTEGER`), PK, NN
- `type` (`VARCHAR`), NN
- `source_file_name` (`VARCHAR`), NN
- `source_file_path` (`VARCHAR`), nullable
- `total_rows` (`INTEGER`), nullable
- `processed_rows` (`INTEGER`), NN, default '0'
- `success_rows` (`INTEGER`), NN, default '0'
- `failed_rows` (`INTEGER`), NN, default '0'
- `status` (`VARCHAR`), NN, default 'pending'
- `started_at` (`DATETIME`), nullable
- `completed_at` (`DATETIME`), nullable
- `global_error_message` (`TEXT`), nullable
- `triggered_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable
- `stock_mode` (`VARCHAR`), NN, default 'file'
- `manual_stock` (`INTEGER`), nullable

Indexes:
- `idx_import_jobs_triggered_by` (IDX on `triggered_by_user_id`)
- `idx_import_jobs_type` (IDX on `type`)
- `idx_import_jobs_status` (IDX on `status`)

### 7.2 `import_job_rows`

- `id` (`INTEGER`), PK, NN
- `import_job_id` (`INTEGER`), NN, FK -> import_jobs.id
- `row_number` (`INTEGER`), NN
- `raw_data` (`TEXT`), nullable
- `status` (`VARCHAR`), NN, default 'pending'
- `error_reason` (`TEXT`), nullable
- `linked_product_id` (`INTEGER`), nullable, FK -> products.id
- `linked_product_variant_id` (`INTEGER`), nullable, FK -> product_variants.id
- `processed_at` (`DATETIME`), nullable
- `created_at` (`DATETIME`), nullable
- `updated_at` (`DATETIME`), nullable

Indexes:
- `idx_import_job_rows_linked_variant` (IDX on `linked_product_variant_id`)
- `idx_import_job_rows_linked_product` (IDX on `linked_product_id`)
- `idx_import_job_rows_status` (IDX on `status`)
- `idx_import_job_rows_job` (IDX on `import_job_id`, `row_number`)

### 7.3 `event_logs`

- `id` (`INTEGER`), PK, NN
- `event_type` (`VARCHAR`), NN
- `entity_type` (`VARCHAR`), NN
- `entity_id` (`INTEGER`), NN
- `payload` (`TEXT`), nullable
- `created_by_user_id` (`INTEGER`), nullable, FK -> users.id
- `created_at` (`DATETIME`), NN
- `source` (`VARCHAR`), NN, default system
- `before` (`TEXT`), nullable JSON snapshot
- `after` (`TEXT`), nullable JSON snapshot
- `reason` (`TEXT`), nullable
- `reference_type` (`VARCHAR`), nullable
- `reference_id` (`VARCHAR`), nullable

Indexes:
- `idx_event_logs_event_type` (IDX on `event_type`)
- `idx_event_logs_entity` (IDX on `entity_type`, `entity_id`)

### 7.4 `performance_metrics`

- `id` (`INTEGER`), PK, NN
- `metric_date` (`DATE`), NN
- `metric_name` (`VARCHAR`), NN
- `metric_value` (`NUMERIC`), NN
- `context` (`TEXT`), nullable
- `created_at` (`DATETIME`), NN

Indexes:
- `idx_performance_metrics_date_name` (IDX on `metric_date`, `metric_name`)

## 8. Framework & Infra

### 8.1 `cache`

- `key` (`VARCHAR`), PK, NN
- `value` (`TEXT`), NN
- `expiration` (`INTEGER`), NN

### 8.2 `cache_locks`

- `key` (`VARCHAR`), PK, NN
- `owner` (`VARCHAR`), NN
- `expiration` (`INTEGER`), NN

### 8.3 `sessions`

- `id` (`VARCHAR`), PK, NN
- `user_id` (`INTEGER`), nullable
- `ip_address` (`VARCHAR`), nullable
- `user_agent` (`TEXT`), nullable
- `payload` (`TEXT`), NN
- `last_activity` (`INTEGER`), NN

Indexes:
- `sessions_last_activity_index` (IDX on `last_activity`)
- `sessions_user_id_index` (IDX on `user_id`)

### 8.4 `jobs`

- `id` (`INTEGER`), PK, NN
- `queue` (`VARCHAR`), NN
- `payload` (`TEXT`), NN
- `attempts` (`INTEGER`), NN
- `reserved_at` (`INTEGER`), nullable
- `available_at` (`INTEGER`), NN
- `created_at` (`INTEGER`), NN

Indexes:
- `jobs_queue_index` (IDX on `queue`)

### 8.5 `job_batches`

- `id` (`VARCHAR`), PK, NN
- `name` (`VARCHAR`), NN
- `total_jobs` (`INTEGER`), NN
- `pending_jobs` (`INTEGER`), NN
- `failed_jobs` (`INTEGER`), NN
- `failed_job_ids` (`TEXT`), NN
- `options` (`TEXT`), nullable
- `cancelled_at` (`INTEGER`), nullable
- `created_at` (`INTEGER`), NN
- `finished_at` (`INTEGER`), nullable

### 8.6 `failed_jobs`

- `id` (`INTEGER`), PK, NN
- `uuid` (`VARCHAR`), NN, UQ
- `connection` (`TEXT`), NN
- `queue` (`TEXT`), NN
- `payload` (`TEXT`), NN
- `exception` (`TEXT`), NN
- `failed_at` (`DATETIME`), NN, default CURRENT_TIMESTAMP

### 8.7 `migrations`

- `id` (`INTEGER`), PK, NN
- `migration` (`VARCHAR`), NN
- `batch` (`INTEGER`), NN


## Return case ledger (2026-08-15)

order_return_cases stores the admin-managed return record independently from orders.order_status: reason, customer/admin notes, resolution type, refund/replacement/additional shipping amounts, actors, and completion timestamp. order_return_items stores requested and returned quantities by order_item_id. Source order and order item history remain immutable; return_in_process and return_completed are audit status milestones only.


## Import Produk   kontrak aktivasi dan data shipping (2026-08-15)

Import katalog berjalan per baris dan menyimpan hasil pada import_job_rows.raw_data.
Baris yang gagal validasi teknis tetap dicatat sebagai failed; baris yang berhasil
tetapi belum memenuhi kelengkapan katalog dicatat success dengan metadata:

- _activation_status: active bila checklist publikasi lengkap, atau archived.
- _activation_reasons: daftar kebutuhan yang belum lengkap.
- _shipping_contract: weight_kg, height_cm, width_cm, dan depth_cm wajib > 0
  untuk aktivasi. Nilai 0/null mengikuti konflik spesifikasi web dan admin: kontrak
  admin yang lebih ketat dipakai sampai ada keputusan baru.
- _media_queue: media URL yang belum ready dikirim ke antrean media dan produk tetap
  archived sampai checklist dapat dipenuhi.

Tidak ada status draft pada hasil import. Kolom sumber shipping dapat memakai alias
weight/weight_kg, height/height_cm, width/width_cm, dan depth/length
(termasuk prefix packing_); semuanya disimpan pada product_variants.

Template internal mengekspor satu baris per varian dan wajib membawa pasangan
parent_sku + variant_sku. Endpoint preview hanya menghitung diff (maksimal 1.000
baris) dan tidak menulis data. Preset Shopee adalah adapter opsional, bukan kontrak
template internal.

## 14. Postal Dataset & Mapping

### 14.1 `postal_datasets`

Versioned import metadata for postal references. The active dataset is selected by `status=active`; older versions remain `retired` and are never rewritten.

- `id` (INTEGER), PK
- `source`, `version`, source/reference URLs, publication/retrieval timestamps
- `checksum_sha256`, nullable
- `status` (staged|active|retired)
- `row_count`, `notes`, timestamps

UQ: `source + version`; IDX: active status/retrieval time.

### 14.2 `postal_code_mappings`

Village/kelurahan postal mappings imported into a dataset version.

- `id` (INTEGER), PK
- `postal_dataset_id` (INTEGER), FK -> postal_datasets.id
- `province_id/name`, `regency_id/name`, `district_id/name`, `village_id/name`
- `postal_code` (VARCHAR(5))
- `source_row`, nullable; timestamps

UQ: `postal_dataset_id + village_id + village_name + postal_code`; IDX: dataset/postal and dataset/village.

Import baseline: Satu Data Indonesia/data.go.id “Kode Pos Desa Kelurahan di Indonesia”; Pos Indonesia is retained as a verification cross-check. Activation requires source/version/checksum, parent-child integrity, duplicate checks, coverage/format validation, and verified review; unverified or missing mappings do not auto-fill checkout. The active dataset provides a server-side suggestion only, the customer postal-code field is readonly, and checkout rechecks the selected region when a mapping exists. Import command: `php artisan postal:import {path} --version=... --activate`. Existing orders retain their postal snapshot and are not rewritten.

## 15. Operational settings & audit contract (2026-08-15)

### 15.1 `operational_setting_versions`

Append-only version snapshots for business-operational settings. The latest version
per `setting_key` is effective; prior versions are retained and immutable.

- `id` (`INTEGER`), PK
- `setting_key` (`VARCHAR`), NN: `cod`, `shipping_subsidy`, `stock_randomization`, or `eta`
- `version` (`INTEGER`), NN; unique with `setting_key`
- `value` (`TEXT`), NN JSON snapshot
- `actor_id` (`INTEGER`), nullable, FK -> users.id
- `source` (`VARCHAR`), NN, default `system`
- `reason` (`TEXT`), nullable
- `reference_type` / `reference_id`, nullable
- `created_at` (`DATETIME`), NN

COD snapshots are percentage-only and retain the maximum order amount. Shipping
subsidy snapshots retain percent/fixed rules and carrier selection. Stock
randomization defaults to enabled with a configurable range (default 700–5000);
existing stock is never re-randomized on edit. ETA snapshots include a display
buffer (default one day). Provider credentials/readiness are intentionally absent
from this contract.

### 15.2 Immutable activity metadata

`event_logs` remains the single Log Aktivitas stream (including settings and
auth/login/password events). Audit records use `source`, `before`, `after`,
`reason`, and `reference_*` metadata. Event logs and operational setting versions
are append-only; update/delete attempts are rejected at the model layer.

WhatsApp automation is independent of the web-admin session: server-side credentials,
queued jobs, retries, webhooks, reconnect handling, and delivery audit continue
without a logged-in admin and are not reset by login rotation or logout.
