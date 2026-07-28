# Database Schema – Ragil Aluminium Website

This document defines the **core SQL schema** for the Ragil Aluminium website.  
It translates the Stage 1–10 skills and System Architecture into concrete tables, fields, and relationships.

All agents must treat this schema as the **canonical data model**:  
do not invent new tables or fields that conflict with this document without updating it explicitly.

---

## 1. Catalog & Taxonomy

### 1.1 `products`

Represents the parent product (aligned with Shopee parent item).

- `id` (PK, bigint, auto increment)  
- `parent_sku` (varchar, unique)  
  - Opaque public product ID and URL segment (`/product/{parent_sku}`).  
  - Shopee import: `SP{product_id}`. Website/admin create: random token with prefix `WEB` (config).  
  - **Not displayed on the storefront**; admin may label it “Kode produk”.  
- `name` (varchar)  
- `short_name` (varchar, nullable)  
- `description` (text, nullable)  
- `category_id` (bigint)  
  - Shopee category ID or mapping to an internal category table.  
- `product_category` (enum: WINDOW, DOOR, BOUVEN)  
- `product_model` (enum: JUNGKIT, SLIDING, SWING, KACA_MATI, ZIGZAG)  
- `design_variant` (enum: POLOS, ORNAMEN, KOMBINASI, SERIES_A, SERIES_B, SERIES_C)  
- `status` (enum: active, inactive, archived, draft)  
- `homepage_popular` (boolean, default false)  
  - Manual pick for Home **Paling Banyak Dipesan** (kurasi stok/workshop; bukan auto Shopee).  
- `homepage_popular_sort` (unsigned int, default 0)  
  - Urutan di Home (lebih kecil = lebih dulu).  
- `created_by_user_id` (FK → `users.id`, nullable)  
- `updated_by_user_id` (FK → `users.id`, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_products_parent_sku` (unique on `parent_sku`)  
- `idx_products_category_model_design` (`product_category`, `product_model`, `design_variant`)  
- `idx_products_status_category` (`status`, `product_category`) — public catalog filters at scale  
- `idx_products_homepage_popular` (`homepage_popular`, `homepage_popular_sort`)  

- `idx_products_category_id` (`category_id`)

Notes:

- When a product is “taken down”, set `status = archived`; public catalog must not show archived products.  
- Historical orders referencing archived products remain valid; reports may include archived products when needed.  
- **Popular:** Catalog `?sort=popular` = sum website `order_items.quantity`. Home strip = `homepage_popular` picks; if none, fallback website sales.

### 1.2 `product_variants`

Represents individual variants of a product (sellable units; import may align with Shopee variation IDs).

- `id` (PK, bigint, auto increment)  
- `product_id` (FK → `products.id`)  
- `variant_sku` (varchar, unique) — opaque cart/order key; **not shown on storefront**  
- `variation_1_name` (varchar, nullable)  
- `variation_1_option` (varchar, nullable)  
- `variation_2_name` (varchar, nullable)  
- `variation_2_option` (varchar, nullable)  
- `price` (decimal(12,2))  
- `stock` (int)  
- `weight_kg` (decimal(8,3), nullable)  
- `width_cm` (decimal(8,2), nullable)  
- `height_cm` (decimal(8,2), nullable)  
- `depth_cm` (decimal(8,2), nullable)  
- `status` (enum: active, inactive, archived)  
- `created_by_user_id` (FK → `users.id`, nullable)  
- `updated_by_user_id` (FK → `users.id`, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_product_variants_product_id` (`product_id`)  
- `idx_product_variants_variant_sku` (unique on `variant_sku`)  
- `idx_product_variants_variations` (`variation_1_name`, `variation_1_option`, `variation_2_name`, `variation_2_option`)

Notes:

- Variants that are no longer sold should be marked `archived` instead of deleted.  
- Public catalog surfaces only variants with `status = active`; admin views can include `inactive` and `archived`.

### 1.3 `product_attributes`

Stores structured attributes for products/variants.

- `id` (PK, bigint)  
- `product_id` (FK → `products.id`, nullable)  
- `product_variant_id` (FK → `product_variants.id`, nullable)  
- `attribute_name` (varchar)  
- `attribute_value` (varchar)  
- `source` (enum: shopee, internal)  
- `created_by_user_id` (FK → `users.id`, nullable)  
- `updated_by_user_id` (FK → `users.id`, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_product_attributes_product` (`product_id`)  
- `idx_product_attributes_variant` (`product_variant_id`)  
- `idx_product_attributes_name` (`attribute_name`)

Notes:

- Either `product_id` or `product_variant_id` is set.  
- Used for filters, specs, and mapping to Shopee category attributes.
- Internal storefront promotion attributes use `promo_compare_price`, `promo_flash_sale`, `promo_cod`, and `promo_warranty`. `promo_compare_price` is shown only when greater than the current minimum active-variant price; the storefront derives the discount percentage from those two values. Boolean promotion values use `true`/`false`; Flash Sale defaults `false` and is enabled per participating product. Global campaign window (not a separate table) lives on `cms_pages.slug = flash-sale` → `content.period` (`enabled`, `starts_at`, `ends_at`); storefront treats `promo_flash_sale` as live only while that period is active. When `promo_compare_price` is absent, an optional global event may derive the comparison price from `STOREFRONT_PRODUCT_CARD_DISCOUNT_PERCENT` (default `0`).

---

## 2. Media

### 2.1 `product_media`

Represents media records for products/variants (images; extensible to video).

- `id` (PK, bigint, auto increment)  
- `product_id` (FK → `products.id`)  
- `product_variant_id` (FK → `product_variants.id`, nullable)  
- `position` (int)  
  - 1–9 for typical image slots.  
- `is_main_image` (boolean, default false)  
- `show_in_catalog` (boolean, default true)  
  - When true → included in PDP / product card gallery.  
- `is_installation` (boolean, default false)  
  - When true → included in Hasil Pemasangan (`/hasil-pemasangan`, home strip, PDP installation section, related product links).  
- `visibility` (enum: visible, archived, hidden, nullable)  
- `source_url` (text, nullable)  
  - Archive of the ingest URL (e.g. Shopee CDN). Not for production storefront hotlink when `MEDIA_ALLOW_SOURCE_FALLBACK=false`.  
- `stored_path` (varchar, nullable)  
- `stored_url` (text, nullable)  
  - Master file on disk `media` (local or R2/S3). Default efisien (`MEDIA_KEEP_ORIGINAL=false`): path ke WebP terbesar (`pdp`), bukan JPG original.  
  - Original penuh hanya dipertahankan bila `MEDIA_KEEP_ORIGINAL=true`, atau sementara bila derivative gagal.  
- `derivatives` (json, nullable)  
  - WebP delivery variants after download, shape:  
    `{ "thumb": { "path", "url", "width", "height" }, "card": {...}, "pdp": {...} }`  
  - Longest-edge targets (config): thumb ~400, card ~800, pdp ~1400. Quality default `MEDIA_WEBP_QUALITY=82`.  
  - List/catalog use `card`/`thumb`; PDP gallery uses `pdp` (via `ProductMedia::urlFor()`).  
- `mime_type` (varchar, nullable)  
- `size_bytes` (bigint, nullable)  
- `width_px` (int, nullable)  
- `height_px` (int, nullable)  
- `status` (enum: pending, downloading, downloaded, failed)  
- `error_reason` (text, nullable)  
- `created_by_import_job_id` (FK → `import_jobs.id`, nullable)  
- `last_updated_by_import_job_id` (FK → `import_jobs.id`, nullable)  
- `created_by_user_id` (FK → `users.id`, nullable)  
- `updated_by_user_id` (FK → `users.id`, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_product_media_product` (`product_id`, `position`)  
- `idx_product_media_variant` (`product_variant_id`, `position`)  
- `idx_product_media_status` (`status`)  
- `idx_product_media_is_main` (`product_id`, `is_main_image`)  
- `idx_product_media_visibility` (`visibility`)  
- `idx_product_media_created_job` (`created_by_import_job_id`)
- `idx_product_media_installation` (`is_installation`, `visibility`, `status`)

Notes:

- Frontend must only use media with appropriate `visibility` (e.g. `visible`) for catalog/gallery.  
- Catalog gallery filters `show_in_catalog = true`; Hasil Pemasangan aggregates `is_installation = true` (plus manual `cms_gallery_items`).  
- `is_main_image` supports consistent main thumbnail (only among catalog-visible media).  
- `product_variant_id` nullable: null = shared product gallery; set = foto khusus kombinasi opsi (warna/kaca). Admin: `Admin/Products/Media` + upload di `Admin/VariantEdit`. PDP memakai foto khusus varian bila ada, else fallback shared.
- Storefront should prefer `derivatives` URLs (`urlFor('card'|'thumb'|'pdp')`); `display_url` resolves to `card` (with safe fallbacks). Never rely on `source_url` in production.
- Storage efficiency: default **WebP-only on disk** after successful derivatives (`MEDIA_KEEP_ORIGINAL=false`). Prune existing JPG/PNG with `php artisan media:prune-originals`. Re-fetch from `source_url` if a larger master is needed.
- Import columns: `image_1..9` → catalog; optional `installation_slots` (e.g. `7,8,9`) marks those slots also `is_installation`; `installation_image_1..9` → `show_in_catalog=false`, `is_installation=true` (extra docs outside catalog gallery).

---

## 3. Import Pipeline

### 3.1 `import_jobs`

Represents a bulk import/update operation.

- `id` (PK, bigint, auto increment)  
- `type` (enum: shopee_mass_upload, shopee_mass_update, internal_bulk_update)  
- `source_file_name` (varchar)  
- `source_file_path` (varchar, nullable)  
- `stock_mode` (varchar, default `file`; allowed application values: `file`, `manual`)  
- `manual_stock` (unsigned int, nullable; required by application when `stock_mode = manual`)  
- `total_rows` (int, nullable)  
- `processed_rows` (int, default 0)  
- `success_rows` (int, default 0)  
- `failed_rows` (int, default 0)  
- `status` (enum: pending, running, completed, failed)  
- `started_at` (timestamp, nullable)  
- `completed_at` (timestamp, nullable)  
- `global_error_message` (text, nullable)  
- `triggered_by_user_id` (FK → `users.id`, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_import_jobs_status` (`status`)  
- `idx_import_jobs_type` (`type`)  
- `idx_import_jobs_triggered_by` (`triggered_by_user_id`)

Notes:

- `stock_mode = file` preserves each row's stock value from the source spreadsheet.
- `stock_mode = manual` applies `manual_stock` to every variant processed by the job. The choice is persisted on the job so retries use the same stock rule.

### 3.2 `import_job_rows`

Represents individual rows from an import job.

- `id` (PK, bigint, auto increment)  
- `import_job_id` (FK → `import_jobs.id`)  
- `row_number` (int)  
- `raw_data` (json)  
- `status` (enum: pending, processed, success, failed)  
- `error_reason` (text, nullable)  
- `linked_product_id` (FK → `products.id`, nullable)  
- `linked_product_variant_id` (FK → `product_variants.id`, nullable)  
- `processed_at` (timestamp, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_import_job_rows_job` (`import_job_id`, `row_number`)  
- `idx_import_job_rows_status` (`status`)  
- `idx_import_job_rows_linked_product` (`linked_product_id`)  
- `idx_import_job_rows_linked_variant` (`linked_product_variant_id`)

Notes:

- Correction files for admins are generated from rows with `status = failed` and `error_reason`.  
- Import logic should prefer row‑level failures over whole‑job failure.

---

## 4. Orders, Payments, Shipping

### 4.1 `orders`

Represents customer orders created via website checkout.

- `id` (PK, bigint, auto increment)  
- `order_number` (varchar, unique)  
- `customer_id` (FK → `customers.id`, nullable)  
- `customer_name` (varchar)  
- `customer_phone` (varchar)  
- `customer_email` (varchar, nullable)  
- `shipping_address_line1` (varchar)  
- `shipping_address_line2` (varchar, nullable)  
- `shipping_city` (varchar)  
- `shipping_province` (varchar)  
- `shipping_district` (varchar) — Kecamatan (nama snapshot dari pilihan wilayah)  
- `shipping_village` (varchar) — Desa/Kelurahan (nama snapshot dari pilihan wilayah)  
- `shipping_postal_code` (varchar)  
- `shipping_country` (varchar)  
- `order_status` (enum: pending_payment, processing, shipped, delivered, completed, issue, return_in_process, cancelled)  
- `payment_status` (enum: pending, paid, refunded)  
- `shipping_status` (enum: pending_pickup, in_process, in_transit, delivered, cancelled)  
- `subtotal_amount` (decimal(12,2))  
- `shipping_amount` (decimal(12,2)) — net shipping customer pays after subsidy  
- `shipping_subsidy_amount` (decimal(12,2), default 0) — store-funded shipping discount snapshot  
- `discount_amount` (decimal(12,2), default 0) — savings vs compare price on line items (informational; unit prices already promo-adjusted)  
- `voucher_code` (varchar, nullable) — applied store voucher code snapshot  
- `voucher_discount_amount` (decimal(12,2), default 0) — rupiah subtracted from payable total  
- `cod_fee_amount` (decimal(12,2), default 0) — COD handling fee added when paying COD  
- `total_amount` (decimal(12,2)) — `subtotal + shipping_amount - voucher_discount + cod_fee` (`shipping_amount` already net of subsidy)  
- `payment_method` (enum: cod, transfer, other)  
- `cod_flag` (boolean)  
- `notes` (text, nullable)  
- `created_by_user_id` (FK → `users.id`, nullable)  
- `updated_by_user_id` (FK → `users.id`, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_orders_order_number` (unique on `order_number`)  
- `idx_orders_customer_phone` (`customer_phone`)  
- `idx_orders_statuses` (`order_status`, `payment_status`, `shipping_status`)

Notes:

- Orders should generally not be deleted; visibility is handled by filters and date ranges.  

### 4.2 `order_items`

Represents line items within an order.

- `id` (PK, bigint, auto increment)  
- `order_id` (FK → `orders.id`)  
- `product_id` (FK → `products.id`)  
- `product_variant_id` (FK → `product_variants.id`, nullable)  
- `parent_sku` (varchar)  
- `variant_sku` (varchar, nullable)  
- `name` (varchar)  
- `variation_1_name` (varchar, nullable)  
- `variation_1_option` (varchar, nullable)  
- `variation_2_name` (varchar, nullable)  
- `variation_2_option` (varchar, nullable)  
- `unit_price` (decimal(12,2))  
- `quantity` (int)  
- `line_subtotal` (decimal(12,2))  
- `line_discount` (decimal(12,2), default 0)  
- `line_total` (decimal(12,2))  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_order_items_order` (`order_id`)  
- `idx_order_items_variant_sku` (`variant_sku`)

### 4.3 `payments`

Represents payment records associated with orders.

- `id` (PK, bigint, auto increment)  
- `order_id` (FK → `orders.id`)  
- `payment_method` (enum: cod, transfer, gateway)  
- `amount` (decimal(12,2))  
- `status` (enum: pending, completed, failed, refunded)  
- `transaction_reference` (varchar, nullable)  
- `evidence_url` (text, nullable)  
- `paid_at` (timestamp, nullable)  
- `created_by_user_id` (FK → `users.id`, nullable)  
- `updated_by_user_id` (FK → `users.id`, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_payments_order` (`order_id`)  
- `idx_payments_status` (`status`)

### 4.4 `shipping_records`

Represents shipping information and status reflecting carrier data.

- `id` (PK, bigint, auto increment)  
- `order_id` (FK → `orders.id`)  
- `carrier_name` (varchar)  
- `service_name` (varchar, nullable)  
- `waybill_number` (varchar, unique)  
- `shipping_cost` (decimal(12,2))  
- `status` (enum: pending_pickup, in_process, in_transit, delivered, returned, cancelled)  
- `status_raw` (varchar, nullable)  
- `last_status_at` (timestamp, nullable)  
- `tracking_url` (text, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_shipping_records_order` (`order_id`)  
- `idx_shipping_records_waybill` (unique on `waybill_number`)  
- `idx_shipping_records_status` (`status`)

---

## 5. WhatsApp Integration

### 5.1 `whatsapp_templates`

Represents mapping between internal template keys and provider templates.

- `id` (PK, bigint, auto increment)  
- `internal_key` (varchar, unique)  
  - e.g. `order_created`, `payment_confirmed`, `order_shipped`, `order_delivered`, `order_issue_followup`.  
- `provider_template_name` (varchar)  
- `language_code` (varchar, default `id`)  
- `category` (enum: transactional, marketing, otp)  
- `status` (enum: active, inactive)  
- `description` (text, nullable) — short admin note / catalog blurb  
- `body_preview` (text, nullable) — editable message draft for admin UI (Meta/BSP still owns approved template body)  
- `created_by_user_id` (FK → `users.id`, nullable)  
- `updated_by_user_id` (FK → `users.id`, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_whatsapp_templates_key` (unique on `internal_key`)  
- `idx_whatsapp_templates_status` (`status`)

### 5.2 `whatsapp_messages`

Represents individual messages sent or received via WhatsApp Business API.

- `id` (PK, bigint, auto increment)  
- `direction` (enum: outbound, inbound)  
- `order_id` (FK → `orders.id`, nullable)  
- `phone_number` (varchar)  
- `internal_template_key` (varchar, nullable)  
- `provider_message_id` (varchar, nullable)  
- `content_text` (text, nullable)  
- `content_payload` (json, nullable)  
- `status` (enum: pending, sent, delivered, read, failed, received)  
- `error_reason` (text, nullable)  
- `sent_at` (timestamp, nullable)  
- `received_at` (timestamp, nullable)  
- `raw_payload` (json, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_whatsapp_messages_order` (`order_id`)  
- `idx_whatsapp_messages_phone` (`phone_number`)  
- `idx_whatsapp_messages_direction_status` (`direction`, `status`)  
- `idx_whatsapp_messages_provider_message_id` (`provider_message_id`)

---

## 6. Users & Customers

### 6.1 `users` (Admin / Staff)

Represents admins and staff with access to the dashboard.

- `id` (PK, bigint, auto increment)  
- `name` (varchar)  
- `email` (varchar, unique)  
- `password` (varchar)  
- `role` (enum: `super_admin`, `admin`, `staff`, `viewer` — **canonical runtime value is `admin` only**; Stage 2 equal-admin; legacy enum values kept for DB compatibility, normalized to `admin`)  
- `status` (enum: active, inactive)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_users_email` (unique on `email`)  
- `idx_users_role` (`role`)  

Admin: **Manajemen Admin** (`admin.users.*` → `Admin/Users/{Index,Form}`). Filter `q`/`status`/`sort`. No role picker (all Store Admins equal). Activate/deactivate tanpa hard delete. Guard: no self-deactivate; keep ≥1 active admin.

### 6.2 `customers`

Represents customer entities for reporting and reuse.

- `id` (PK, bigint, auto increment)  
- `name` (varchar)  
- `phone` (varchar, unique)  
- `email` (varchar, nullable)  
- `default_address_line1` (varchar, nullable)  
- `default_address_line2` (varchar, nullable)  
- `default_city` (varchar, nullable)  
- `default_province` (varchar, nullable)  
- `default_postal_code` (varchar, nullable)  
- `default_country` (varchar, nullable)  
- `created_at` (timestamp)  
- `updated_at` (timestamp)

Indexes:

- `idx_customers_phone` (unique on `phone`)

Notes:

- Orders may reference `customers.id` to group histories; order snapshot fields remain the source of truth for that specific order.
- Checkout upserts by unique `phone` (normalized `62…`) and sets `orders.customer_id`.
- Admin Monitoring **Customer** (`admin.customers.*`) manages these rows — not `users` (admin staff).
- Status (`aktif` / `tidak_aktif` / `baru`) and fraud score are **derived** from order history (not stored columns).

---

## 6a. Homepage Promo Banners

### `cms_banners`

Ordered homepage promotion slides managed from Admin CMS.

- `id` (PK)
- `title` (varchar, nullable) — promotion copy, e.g. `Diskon sampai 30%`
- `image_url` (varchar) — uploaded fallback image
- `link_url` (varchar, nullable) — internal `/product/{parent_sku}` or full URL
- `sort_order` (integer, default 0)
- `published` (boolean, default true) — active/running promotion flag
- `created_at`, `updated_at` (timestamp)

Notes:

- A product link is resolved at render time; the active product's main media replaces `image_url` when available.
- Multiple published rows rotate on the homepage in `sort_order`.
- Automatic promo slides (products with explicit compare-price / Flash Sale attributes) are **not** rows in `cms_banners`. Their enablement lives on `cms_pages.slug = beranda` as JSON:

```json
{
  "auto_promotions": {
    "enabled": true,
    "max_slides": 3
  },
  "layout": {
    "sections": [
      { "key": "banner", "enabled": true, "sort_order": 0 },
      { "key": "service_highlights", "enabled": true, "sort_order": 1 },
      { "key": "how_to_order", "enabled": true, "sort_order": 2 }
    ]
  },
  "service_highlights": {
    "title": "Sorotan layanan",
    "subtitle": "...",
    "items": [{ "icon": "cod|shield|truck|check|package|star|whatsapp", "title": "...", "description": "..." }]
  },
  "how_to_order": {
    "title": "Cara pesan jendela Anda",
    "subtitle": "...",
    "steps": [{ "title": "...", "description": "..." }]
  }
}
```

- Admin **Beranda Pembeli**: `admin.beranda.*` (`Admin/Beranda/*`) manages layout order/enable + section editors. Banner “Edit konten” opens Promo Toko (`admin.banners.index`). Generic CMS editor must preserve these keys + `auto_promotions`.
- Homepage merge order: permanent landing slide → published `cms_banners` → automatic product slides (when enabled; prefer newest BOUVEN). When both promo sources empty: real newest BOUVEN (+ DOOR) product photos — no hardcoded dummy promo images.

### `cms_pages.slug = flash-sale`

Global Flash Sale campaign window (no dedicated campaign table):

```json
{
  "period": {
    "enabled": false,
    "starts_at": "2026-07-01T00:00:00+07:00",
    "ends_at": "2026-07-07T23:59:59+07:00"
  }
}
```

- Admin: `PUT /admin/flash-sale/period` (`FlashSalePeriodSettings`).
- Participating products still use `product_attributes.promo_flash_sale` (+ optional `promo_compare_price`).
- Storefront (`/flash-sale`, promo spotlight, card badge, announcement when live) only treats Flash Sale as active while `enabled` and within `starts_at`…`ends_at` (open-ended if a bound is null).

### `cms_pages.slug = cara-pemesanan`

Public panduan pemesanan (`/cara-pemesanan`) + admin `admin.cara-pemesanan.*`.

```json
{
  "heading": "Cara pesan jendela Anda",
  "subtitle": "Alur ringkas…",
  "body": "<p>Catatan tambahan (opsional)</p>",
  "steps": [
    { "icon": "search", "title": "Pilih model", "description": "…", "points": ["…"] }
  ],
  "info_cards": [
    { "icon": "credit-card", "title": "Metode pembayaran", "description": "…" }
  ]
}
```

Notes:

- Berbeda dari `cms_pages.beranda` → `content.how_to_order` (section singkat di beranda).
- Storefront: `CaraPemesananSettings::forStorefront()` → `Public/HowToOrder`.

### `cms_faq_items`

FAQ Q&A untuk `/faq` (slug halaman `faq`).

- `id` (PK)
- `cms_page_id` (FK → `cms_pages.id`)
- `question` (varchar)
- `answer` (text)
- `category` (varchar; default `Umum & Profil Toko`) — nilai: `Umum & Profil Toko`, `Spesifikasi Material & Ukuran`, `Metode Pembayaran`, `Pengiriman & Pemasangan`
- `status` (enum/string: `active` | `archived`; default `active`) — hanya `active` tampil di storefront
- `sort_order` (integer, default 0)
- `created_at`, `updated_at`

Indexes:

- `idx_cms_faq_items_page_status` (`cms_page_id`, `status`)

Notes:

- Admin: `admin.faq.*` → `Admin/Faq/Index` (tab Aktif / Diarsipkan; form tambah on-demand; meta halaman tersembunyi).
- Archive = soft hide (bukan hard delete). Hapus permanen tersedia di tab Diarsipkan.
- Public: `FaqSettings::forStorefront()` → `Public/Faq` (items `status=active` saja).
- Meta hero di `cms_pages.faq` (`heading`, `subtitle`, `published`).

### `cms_problems_solutions`

Pasangan masalah & solusi untuk `/masalah-dan-solusi` (slug halaman `masalah-solusi`).

- `id` (PK)
- `cms_page_id` (FK → `cms_pages.id`)
- `problem` (text) — kendala pelanggan (stage-9a: problem_text)
- `solution` (text) — rekomendasi Ragil (stage-9a: solution_text)
- `sort_order` (integer, default 0)
- `created_at`, `updated_at`

Notes:

- Admin: `admin.masalah-solusi.*`. Meta hero di `cms_pages.masalah-solusi`.
- Public: `ProblemsSolutionsSettings::forStorefront()` → `Public/MasalahSolusi`.

### `cms_pages` dokumen panjang (Informasi Toko / Legal)

Slug dokumen dengan `content.body` (+ `heading`):

- `tentang-kami` — admin `admin.tentang-kami.*`, publik `/about`
- `storefront-platforms` — admin `admin.storefront-platforms.*` (`content.links` keyed by platform key); publik via Inertia share `platforms`
- `ketentuan-layanan` — admin `admin.ketentuan-layanan.*`, publik `/policy/terms`
- `kebijakan-privasi` — admin `admin.kebijakan-privasi.*`, publik `/policy/privacy`

Helper: `CmsDocumentSettings`.

---

## 6c. Store Vouchers (Voucher Toko)

### `store_vouchers`

Checkout voucher codes managed from Admin → Harga & Promo → Voucher Toko.

- `id` (PK)
- `name` (varchar) — internal label (not shown to customers)
- `code` (varchar, unique) — customer-entered code at checkout (stored uppercase)
- `discount_type` (enum: `percent`, `fixed`)
- `discount_value` (decimal(12,2)) — percent 0.01–100 or fixed rupiah amount
- `min_purchase` (decimal(12,2), default 0) — minimum cart subtotal
- `starts_at` / `ends_at` (timestamp, nullable) — validity window
- `published` (boolean, default false) — only published vouchers are usable
- `created_by_user_id` / `updated_by_user_id` (FK → `users.id`, nullable)
- `created_at` / `updated_at`

Indexes:

- unique on `code`
- `idx_store_vouchers_active_window` (`published`, `starts_at`, `ends_at`)

Notes:

- **Only one** `published = true` voucher may exist at a time (enforced in `VoucherService::publishExclusive`).
- Applied at checkout → session → `orders.voucher_code` + `orders.voucher_discount_amount`; payable `total_amount` subtracts voucher discount.
- `orders.discount_amount` remains line-level compare-price savings (informational); do not conflate with voucher.

### Orders voucher columns

- `voucher_code` (varchar, nullable)
- `voucher_discount_amount` (decimal(12,2), default 0)
- `cod_fee_amount` (decimal(12,2), default 0) — handling fee when `payment_method = cod`
- `shipping_subsidy_amount` (decimal(12,2), default 0) — store subsidy; `shipping_amount` remains net paid

---

## 6d. COD settings (Biaya COD)

Stored on `cms_pages.slug = checkout` → `content.cod` (no dedicated table):

```json
{
  "cod": {
    "enabled": true,
    "fee_type": "percent",
    "fee_value": 0,
    "max_order_amount": null
  }
}
```

- `enabled` — store-wide COD availability at checkout
- `fee_type` — `percent` | `fixed` (Figma primary UI = percent handling fee)
- `fee_value` — percent 0–100 or fixed rupiah
- `max_order_amount` — optional COD subtotal cap after voucher; null/0 = unlimited
- Fee base = goods subtotal − voucher discount; added to `orders.total_amount` and snapshotted as `orders.cod_fee_amount`
- Admin: `GET/PUT /admin/cod-settings` (`Admin\CodSettingsController`)

Wilayah COD coverage from Figma copy is **out of scope** until a region contract exists; current control is enable + fee + max order.

---

## 6e. Shipping subsidy (Subsidi Ongkir)

Stored on `cms_pages.slug = checkout` → `content.shipping_subsidy` (sibling of `content.cod`; no dedicated table):

```json
{
  "shipping_subsidy": {
    "enabled": false,
    "subsidy_type": "percent",
    "subsidy_value": 0,
    "carriers": { "jnt": true }
  }
}
```

- `enabled` — store-wide shipping subsidy at checkout
- `subsidy_type` — `percent` | `fixed` (Figma primary = percent of courier tariff)
- `subsidy_value` — percent 0–100 or fixed rupiah (capped at gross shipping)
- `carriers.jnt` — only J&T is wired; if false, no subsidy even when enabled
- Gross tariff from `ShippingService`; net = gross − subsidy → `orders.shipping_amount`; subsidy snapshot → `orders.shipping_subsidy_amount`
- Admin: `GET/PUT /admin/shipping-subsidy` (`Admin\ShippingSubsidyController`)

Multi-carrier / wilayah coverage beyond J&T toggle is **out of scope**.

---

## 6a2. CMS Model Produk (Showcase)

### `cms_model_products`

Kurasi kartu model di storefront (beranda / hub `/products` / menu model), terpisah dari CRUD katalog SKU.

- `id` (PK)
- `name` (varchar) — label tampilan, e.g. `Jendela Jungkit`
- `product_category` (varchar 32, nullable) — `WINDOW` | `DOOR` | `BOUVEN`
- `product_model` (varchar 64, nullable) — e.g. `JUNGKIT`, `SLIDING`
- `image_url` (varchar, nullable)
- `description` (text, nullable) — deskripsi model di halaman detail storefront; diedit di admin Model Produk
- `type` (enum: `polos`, `ornamen`, `lainnya`, default `polos`)
- `status` (enum: `active`, `draft`, default `draft`)
- `sort_order` (integer, default 0)
- `created_at`, `updated_at`

Indexes:

- `cms_model_products_category_model_idx` (`product_category`, `product_model`)

Notes:

- Admin: Pengaturan Website → **Model Produk** (`admin.model-products.*`). Sync membuat baris dari pasangan kategori+model katalog yang belum ada.
- Storefront memakai baris `active` berurutan; jika tidak ada baris aktif → fallback taxonomy dari produk.
- Bukan pengganti `products` / `admin.products.*`.

---

## 6b. CMS Testimonials (Ulasan)

### `cms_testimonials`

Manual customer reviews (often copied from Shopee/WhatsApp) for the public storefront.

- `id` (PK)
- `cms_page_id` (FK → `cms_pages.id`) — usually the `testimoni` page
- `product_id` (FK → `products.id`, **nullable**)
  - Set → shown on that product’s PDP **Ulasan** tab (Stage 10 filter by product ID)
  - Null → general testimonial on `/reviews` only
- `customer_name` (varchar)
- `message` (text)
- `rating` (tinyint 1–5, nullable)
- `source` (varchar: `shopee`, `whatsapp`, `website`, `other`)
- `location` (varchar, nullable)
- `image_url` (varchar, nullable)
- `published` (boolean)
- `sort_order` (int)
- `created_at` / `updated_at`

Indexes:

- `cms_testimonials_product_published_idx` (`product_id`, `published`)

Notes:

- **Hasil pemasangan** = union of (1) `product_media` with `is_installation=true` (from catalog import / admin media flags) and (2) manual `cms_gallery_items` (no SKU). Do not treat gallery as product reviews / ratings.
- Admin CRUD: `/admin/testimonials` (Monitoring → Ulasan) with tabs **Ulasan Website** (`cms_testimonials`) and **Ulasan Foto** (`cms_gallery_items` via `/admin/gallery-items/*` + imported installation media listed read-only).
- Pengaturan Website → **Apa Kata Pelanggan Kami** (`/admin/apa-kata-pelanggan`): same website list + meta on `cms_pages.slug = testimoni` (`content.heading`, `content.subtitle`, `title`, `published`) for `/reviews` hero via `TestimonialPageSettings`.
- Pengaturan Website → **Hasil Pemasangan Kami** (`/admin/hasil-pemasangan`): meta on `cms_pages.slug = hasil-pemasangan` via `InstallationPageSettings` for `/hasil-pemasangan` + beranda section; photos come from import + manual gallery.

---

## 7. Analytics & Logs

### 7.1 `event_logs`

Generic log table for domain events.

- `id` (PK, bigint, auto increment)  
- `event_type` (varchar)  
- `entity_type` (varchar)  
- `entity_id` (bigint)  
- `payload` (json, nullable)  
- `created_by_user_id` (FK → `users.id`, nullable)  
- `created_at` (timestamp)

Indexes:

- `idx_event_logs_entity` (`entity_type`, `entity_id`)  
- `idx_event_logs_event_type` (`event_type`)

### 7.2 `performance_metrics` (optional)

Stores aggregated metrics for reporting (can also be computed from queries).

- `id` (PK, bigint)  
- `metric_date` (date)  
- `metric_name` (varchar) — e.g. `storefront_page_views`, `storefront_unique_visitors`  
- `metric_value` (decimal(18,4))  
- `context` (json, nullable)  
- `created_at` (timestamp)

Indexes:

- `idx_performance_metrics_date_name` (`metric_date`, `metric_name`)

Notes:

- Storefront middleware increments `storefront_page_views` and (once per session/day) `storefront_unique_visitors`.
- Product engagement (admin dashboard only): `product_views` (PDP load) and `product_clicks` (kartu produk storefront) with `context.product_id`; aggregated per `metric_date`.
- Performa Toko conversion = orders in period ÷ unique visitors (0 if no visitor data yet).
- Sales/omzet KPIs are computed live from `orders` / `order_items` (not only from this table).
- **Log Aktivitas (admin):** Monitoring → `admin.activity-logs.*` reads append-only `event_logs` (filter by category derived from `event_type` / `entity_type`, search, CSV export). Critical writers include order/payment/shipping, import start/retry, WhatsApp template changes, and admin login/logout. Do not hard-delete log rows.

---
---

## 8. Agent Checklist for Schema Usage

Before designing or implementing any data logic, agents must:

- Treat `parent_sku` / `variant_sku` as opaque public IDs (URL + backend); do not invent a second public ID system; **never display them on the storefront**.  
- Route all bulk catalog and inventory changes through `import_jobs` and `import_job_rows`, not ad‑hoc scripts.  
- Use `product_media` as the single source of truth for product images; frontend should consume `stored_url` and respect `visibility`.  
- Keep `orders`, `order_items`, `payments`, and `shipping_records` as the authoritative source for transaction and logistics data.  
- Log WhatsApp interactions in `whatsapp_templates` and `whatsapp_messages`.  
- Maintain links between tables for traceability (job → rows → catalog/media, order → WhatsApp → shipping).  
- Use archive‑style status/flags (e.g. `status = archived`, `visibility = archived`) for catalog/media instead of deleting rows.  
- Avoid creating new tables or fields that duplicate existing concepts without updating this schema document.

Any schema change that conflicts with this document must be reviewed and the document updated before being accepted into the Ragil Aluminium system.

---
