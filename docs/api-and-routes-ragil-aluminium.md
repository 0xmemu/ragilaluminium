# API & Routes – Ragil Aluminium Website

This document defines the **core routes and API endpoints** for the Ragil Aluminium website.  
It connects the System Architecture, database schema, and UI flows (admin + public store) into a concrete map of URLs and controllers.

All agents must use these routes and endpoints as the primary integration surface; do not add ad‑hoc endpoints that bypass the documented modules.

---

## 1. Public Store – Web Routes

### 1.1 Homepage & Static Pages

- `GET /`
  - Controller: `HomeController@index`
  - Purpose:
    - Render homepage: hero, category highlights, featured products, benefits, promos.
  - Data sources:
    - Featured `products` / `product_variants` and media.
    - CMS content (hero text, benefits, promos).

- `GET /about`
  - Controller: `PageController@about`
  - Purpose:
    - Show About Ragil Aluminium page.

- `GET /faq`
  - Controller: `PageController@faq`
  - Inertia: `Public/Faq` — props `guide` dari `FaqSettings::forStorefront()` (`cms_faq_items` per kategori)

- `GET /contact`
  - Controller: `PageController@contact`

- `GET /policy/privacy`
  - Controller: `PageController@privacy`

- `GET /policy/terms`
  - Controller: `PageController@terms`

### 1.2 Catalog Browsing

- `GET /products`
  - Controller: `CatalogController@index`
  - Purpose (Inertia):
    - **Default (no listing query):** hub **Semua Model Produk** — `Public/ModelProduk`, kartu `card-model-produk` (bukan daftar SKU).
    - Optional `?design=POLOS|ORNAMEN|KOMBINASI` filters model cards.
    - **With listing query** (`sort`, `q`, `model`, `price_*`): daftar produk SKU — `Public/Catalog`, kartu `card-produk` (mis. `/products?sort=popular` = Paling Banyak Dipesan).
  - API (`Accept: application/json` / `/api/*`): selalu payload daftar produk.

- `GET /promo`
  - Controller: `CatalogController@promo`
  - Purpose (Inertia):
    - Listing produk SKU (`Public/Catalog`, `listingMode: promo`, `basePath /promo`, `categoryName "Promo"`) yang punya atribut promo eksplisit. **Tanpa sidebar**; filter model via toggle pill di atas galeri (`?model=`). Props tambahan: `flashSaleSpotlight` (maks. 8 kartu untuk strip Flash Sale). Query `sort` / `q` didukung.

- `GET /flash-sale`
  - Controller: `CatalogController@flashSale`
  - Purpose (Inertia):
    - Listing produk SKU (`Public/Catalog`, `listingMode: flash`, `basePath /flash-sale`, `categoryName "Flash Sale"`) hanya yang bertanda `promo_flash_sale` / `flash_sale` **dan** periode kampanye `live` (`cms_pages.flash-sale.content.period`). Props: `flashSalePeriod`. UI: banner Signal Red marketplace (petir kuning, countdown Jam/Menit/Detik), tanpa sidebar, tanpa Urutkan; filter model via toggle pill (`?model=`). Tidak ada carousel Flash Sale di homepage.

- `GET /windows`
  - Controller: `CatalogController@windows`
  - Purpose:
    - List WINDOW products, with filters for model & design variant.

- `GET /doors`
  - Controller: `CatalogController@doors`

- `GET /bouven`
  - Controller: `CatalogController@bouven`

Common query parameters for category pages:

- `model` (e.g. `JUNGKIT`, `SLIDING`, `SWING`, `KACA_MATI`, `ZIGZAG`)  
- `design` (e.g. `POLOS`, `ORNAMEN`, `KOMBINASI`, `SERIES_A`)  
- `price_min`, `price_max`  
- `sort` (`newest` / `baru`, `name_asc` / `abjad`, `price_asc`, `price_desc`, `popular`)  
  - `newest` / default = baru ditambahkan (`created_at` desc).  
  - `name_asc` / `abjad` = urut nama A–Z (`short_name` lalu `name`).  
  - `popular` = ranking by website `SUM(order_items.quantity)` (bukan Shopee).  
  - Home **Paling Banyak Dipesan** = maksimal 10 produk aktif bertanda `homepage_popular` (admin), diurutkan oleh `homepage_popular_sort`; tidak memakai item dummy atau filler otomatis.

Example:

- `/windows?model=SLIDING&design=POLOS&sort=popular`

- `GET /search`
  - Redirect ke `catalog.index` (`/products`) dengan query string yang sama (`q`, dll.).
  - Hasil pencarian storefront dirender oleh `CatalogController` → `Public/Catalog`.
  - JSON search tetap di `GET /api/search` (`SearchController@index`).

- `GET /products?q=`
  - Controller: `CatalogController@index` → listing produk
  - Query params:
    - `q` – search term (name, parent_sku, short_name, attributes).
  - Purpose:
    - Pencarian storefront (menggantikan halaman `/search` terpisah).
  - Saat periode Flash Sale live: produk flash terkait (match teks atau model yang sama) diurutkan di depan; prop `youMightLike` (maks. 8) tampil di atas hasil dengan heading **Anda mungkin suka**.

### 1.3 Product Detail

- `GET /product/{parent_sku}`
  - Controller: `ProductController@show`
  - Purpose:
    - Show product detail page, gallery, variant selector, attributes.
    - Inertia props include `reviews`: published `cms_testimonials` where `product_id` matches (Ulasan tab).
    - Inertia `media[]` includes `product_variant_id`; PDP gallery switches when warna/varian dipilih.
  - Route model binding:
    - `parent_sku` maps to `products.parent_sku`.

Optional alternative:

- `GET /product/{id}` if you prefer numeric IDs, but `parent_sku` is recommended for consistency with Shopee.

---

## 2. Public Store – Cart & Checkout Routes

### 2.1 Cart

- `GET /cart`
  - Controller: `CartController@index`
  - Purpose:
    - Show cart contents, summary, and actions.

- `GET /cart/count`
  - Controller: `CartController@count`
  - Response JSON: `{ "count": <int> }` — total quantity of products in session cart (navbar badge).

- `POST /cart/add`
  - Controller: `CartController@add`
  - Payload:
    - `parent_sku`, `variant_sku` (optional if variant), `quantity`.
  - Behavior:
    - Add item to cart; respond with updated cart state.

- `POST /cart/update`
  - Controller: `CartController@update`
  - Payload:
    - `line_id` or `(parent_sku, variant_sku)` and new `quantity`.

- `POST /cart/remove`
  - Controller: `CartController@remove`
  - Payload:
    - `line_id` or `(parent_sku, variant_sku)`.

Implementation detail:

- Cart can be session‑based, cookie‑based, or user‑based (if authenticated); the routes abstract this away.

### 2.2 Checkout

- `GET /checkout`
  - Controller: `CheckoutController@index`
  - Purpose:
    - Render checkout page (steps for customer details, shipping, payment).

- `POST /checkout/validate`
  - Controller: `CheckoutController@validateDetails`
  - Payload:
    - `name`, `phone`, `email` (optional)
    - Wilayah (required names + ids): `province`, `city`, `district`, `village`, `province_id`, `city_id`, `district_id`, `village_id`
    - Manual: `address_line1` (required), `address_line2` (optional patokan), `postal_code` (required), `notes` (optional)
  - Purpose:
    - Validate inputs, store session `checkout_details`, optionally estimate shipping.

- `POST /checkout/place-order`
  - Controller: `CheckoutController@placeOrder`
  - Payload:
    - `payment_method` (`cod` / `transfer`). Opsi lain tidak ditawarkan di form publik — diproses manual via WhatsApp/admin.
  - Behavior:
    - Create `orders` (incl. `shipping_district`, `shipping_village`), `order_items`, and initial `payments` records.
    - Trigger domain events for order creation.

- `GET /api/wilayah/provinces`
  - Controller: `WilayahController@provinces`
  - Query: `q` (optional name filter)
  - Response: `{ "data": [{ "id": "...", "name": "..." }, ...] }`

- `GET /api/wilayah/regencies/{provinceId}`
  - Controller: `WilayahController@regencies`
  - Query: `q` (optional)
  - Response: `{ "data": [{ "id": "...", "name": "..." }, ...] }`

- `GET /api/wilayah/districts/{regencyId}`
  - Controller: `WilayahController@districts`
  - Query: `q` (optional)

- `GET /api/wilayah/villages/{districtId}`
  - Controller: `WilayahController@villages`
  - Query: `q` (optional)

- `POST /consultation/whatsapp`
  - Controller: `ConsultationController@send`
  - Payload:
    - `phone` (required) — customer WhatsApp number (normalized server-side).
    - `source` (optional) — e.g. `model_produk`.
  - Behavior:
    - Sends outbound WhatsApp template `consultation_request` (config: `storefront.consultation_template_key`) via `WhatsAppService`.
    - Logs row in `whatsapp_messages`. Graceful degrade when template/token missing (flash error + suggest direct chat).
  - Rate limit: `throttle:10,1`.
  - Shared Inertia prop `consultationWhatsApp.directUrl` — wa.me link for **Chat Langsung** (customer initiates chat without entering their number).

- `GET /order/{order_number}/confirmation`
  - Controller: `OrderController@confirmation`
  - Purpose:
    - Show post‑checkout confirmation page.

- `GET /order/count`
  - Controller: `OrderController@count`
  - Response JSON: `{ "count": <int> }` — sum of `order_items.quantity` for orders in session `confirmed_orders` (navbar Pesanan badge).

---

## 3. Public Store – Order Status View (Optional)

- `GET /order/status`
  - Controller: `OrderController@statusForm`
  - Purpose:
    - **Session first (guest, no login):** if session `confirmed_orders` has numbers, load those orders (J&T refresh when waybill present), show detail — **no lookup form**.
    - **Fallback:** if session empty (cache/data sementara hilang), show lookup form (order number + phone/email).
  - Inertia props: `has_session_orders`, `orders[]`, `order` (active/latest or null), `searched`.

- `POST /order/status`
  - Controller: `OrderController@statusLookup`
  - Payload:
    - `order_number`, `customer_phone` or `customer_email`.
  - Behaviour:
    - Guest-safe (no login). When the matched order has a J&T waybill, refresh carrier track via `ShippingService::refreshStatus` (skipped if refreshed within ~2 minutes).
    - On match: append `order_number` to session `confirmed_orders` so next visit skips the form.
  - Response (Inertia `Public/OrderStatus`):
    - Order summary, tri-status timeline, items, and optional `shipping` (`carrier_name`, `waybill_number`, `status`, `status_raw`, `tracking_url`, `last_status_at`).

- `GET /api/orders/{order_number}/status`
  - Same identity gate + J&T refresh behaviour; JSON payload mirrors the public order summary including `shipping`.

---

## 4. Admin – Web Routes

All admin routes are typically prefixed with `/admin` and protected by auth + role middleware.

### 4.1 Admin Dashboard

- `GET /admin`
  - Controller: `Admin\DashboardController@index`
  - Purpose:
    - Render Beranda admin with KPIs, pipeline overview, operational alerts.

### 4.2 Catalog – Products, Variants, Attributes, Media

- `GET /admin/products`
  - Controller: `Admin\ProductController@index`
  - Inertia: `Admin/Products/Index` (list/grid, search, filter kategori/model/status)

- `GET /admin/products/export`
  - Controller: `Admin\ProductController@export`
  - CSV download mengikuti filter aktif

- `GET /admin/products/create`
  - Controller: `Admin\ProductController@create`

- `POST /admin/products`
  - Controller: `Admin\ProductController@store`
  - Optional initial variant fields:
    - `create_initial_variant` (boolean).
    - When true: `initial_variant_sku`, `initial_price`, and `initial_stock` are required; product and initial variant are created atomically.

- `GET /admin/products/{id}`
  - Controller: `Admin\ProductController@show`

- `GET /admin/products/{id}/edit`
  - Controller: `Admin\ProductController@edit`

- `PUT /admin/products/{id}`
  - Controller: `Admin\ProductController@update`

- `POST /admin/products/{id}/archive`
  - Controller: `Admin\ProductController@archive`

- `POST /admin/products/{id}/unarchive`
  - Controller: `Admin\ProductController@unarchive`

#### Variants (per product)

- `GET /admin/products/{id}/variants`
  - Controller: `Admin\ProductVariantController@index`

- `POST /admin/products/{id}/variants`
  - Controller: `Admin\ProductVariantController@store`

- `GET /admin/variants/{variant_id}/edit`
  - Controller: `Admin\ProductVariantController@edit`

- `PUT /admin/variants/{variant_id}`
  - Controller: `Admin\ProductVariantController@update`

- `POST /admin/variants/{variant_id}/archive`
  - Controller: `Admin\ProductVariantController@archive`

#### Attributes

- `GET /admin/products/{id}/attributes`
  - Controller: `Admin\ProductAttributeController@index`

- `POST /admin/products/{id}/attributes`
  - Controller: `Admin\ProductAttributeController@store`

- `PUT /admin/attributes/{attribute_id}`
  - Controller: `Admin\ProductAttributeController@update`

#### Media

- `GET /admin/media`
  - Controller: `Admin\ProductMediaController@index`

- `GET /admin/products/{id}/media`
  - Controller: `Admin\ProductMediaController@byProduct`
  - Inertia: `Admin/Products/Media`
  - Query: `variant` = `{variant_id}` | `shared` | (kosong = semua)
  - Props: daftar varian + baris media dengan `product_variant_id`, thumb, aksi

- `POST /admin/products/{id}/media`
  - Body: `source_url` / `upload`, `position`, `visibility`, `is_main_image`, **`product_variant_id` (nullable)** — tautkan foto ke kombinasi warna/kaca

- `PUT /admin/media/{media_id}`
  - Boleh update `position`, `visibility`, **`product_variant_id`** (null = gambar bersama produk)

- `POST /admin/media/{media_id}/set-main`
  - Controller: `Admin\ProductMediaController@setMain`

- `POST /admin/media/{media_id}/archive`
  - Controller: `Admin\ProductMediaController@archive`

- Edit varian (`Admin/VariantEdit`) juga bisa unggah foto dengan `product_variant_id` terisi otomatis.

---

## 5. Admin – Imports

### 5.1 Import Jobs

- `GET /admin/imports`
  - Controller: `Admin\ImportJobController@index`

- `GET /admin/imports/create`
  - Controller: `Admin\ImportJobController@create`
  - Purpose:
    - Form to upload Shopee Excel or internal bulk files.

- `POST /admin/imports`
  - Controller: `Admin\ImportJobController@store`
  - Payload:
    - `type`, `file`.
    - `stock_mode`: `file` or `manual`.
    - `manual_stock`: required non-negative integer when `stock_mode = manual`.
  - Behavior:
    - Save file, persist the stock rule on `import_jobs`, and dispatch the job to the queue. Retry reuses the persisted rule.

- `GET /admin/imports/{id}`
  - Controller: `Admin\ImportJobController@show`
  - Purpose:
    - Detail view with row stats and failed rows.

- `POST /admin/imports/{id}/retry`
  - Controller: `Admin\ImportJobController@retry`
  - Purpose:
    - Re‑run job (with safeguards).

### 5.2 Failed Rows & Correction Files

- `GET /admin/imports/{id}/failed-rows`
  - Controller: `Admin\ImportJobController@failedRows`
  - Purpose:
    - Focused view of `import_job_rows` with errors.

- `GET /admin/imports/{id}/correction-file`
  - Controller: `Admin\ImportJobController@downloadCorrectionFile`
  - Purpose:
    - Download Excel containing failed rows + error reasons.

---

## 6. Admin – Orders, Payments, Shipping

### 6.1 Orders

- `GET /admin/orders`
  - Controller: `Admin\OrderController@index`
  - Inertia: `Admin/Orders/Index` (tabs status, search, sort, kartu pesanan)

- `GET /admin/orders/export`
  - Controller: `Admin\OrderController@export`
  - CSV download (mengikuti filter `q` / `order_status`)

- `GET /admin/orders/{id}`
  - Controller: `Admin\OrderController@show`
  - Inertia: `Admin/Orders/Show`
  - Blok **Lacak pesanan** per order: baca `shipping_records`, poll J&T (`refreshStatus`) bila resi ada & update >~2 menit.

- `POST /admin/orders/{id}/shipping`
  - Controller: `Admin\OrderController@storeShipping`
  - Payload: `mode=jnt|manual`, `waybill_number` (manual), `weight_kg` (jnt), `mark_shipped` (opsional → `order_status=shipped`)
  - `mode=jnt` → `ShippingService::createShipment`; `mode=manual` → `attachManualWaybill`

- `POST /admin/orders/{id}/shipping/refresh`
  - Controller: `Admin\OrderController@refreshShipping`
  - Re-query J&T trace untuk resi aktif order ini.

- `PUT /admin/orders/{id}/status`
  - Controller: `Admin\OrderController@updateStatus`
  - Payload:
    - New `order_status` (validated against allowed transitions).
    - Opsional: `redirect_to=index` + filter query untuk kembali ke daftar.
  - Alur berbeda per metode:
    - **Transfer** (`payment_method=transfer`): dari `pending_payment` → `processing` mengonfirmasi pembayaran pending (lunas) lalu memproses.
    - **COD** (`cod_flag` / `payment_method=cod`): dari `pending_payment` → `processing` tanpa menandai lunas; pembayaran COD dikonfirmasi saat status `delivered` / `completed`.

### 6.2 Payments

- `GET /admin/payments`
  - Controller: `Admin\PaymentController@index`

- `GET /admin/orders/{id}/payments`
  - Controller: `Admin\PaymentController@byOrder`

- `POST /admin/orders/{id}/payments`
  - Controller: `Admin\PaymentController@store`
  - Purpose:
    - Add payment record (e.g. manual transfer confirmation).

- `PUT /admin/payments/{payment_id}`
  - Controller: `Admin\PaymentController@update`

### 6.3 Shipping Records

- `GET /admin/shipping`
  - Controller: `Admin\ShippingRecordController@index`

- `GET /admin/shipping/{id}`
  - Controller: `Admin\ShippingRecordController@show`

- `POST /admin/shipping/{id}/refresh`
  - Controller: `Admin\ShippingRecordController@refreshStatus`
  - Purpose:
    - Trigger re‑query to carrier API.

---

## 7. Admin – WhatsApp

### 7.1 Templates

- `GET /admin/whatsapp/templates`
  - Controller: `Admin\WhatsAppTemplateController@index`
  - Inertia: `Admin/WhatsApp/Index` — fixed Stage-8 automations (COD / transfer / diproses / resi / sampai) with toggle + edit

- `GET /admin/whatsapp/connection`
  - Controller: `Admin\WhatsAppTemplateController@connection`
  - Inertia: `Admin/WhatsApp/Connection` — Cloud API config status + outbound stats (not unofficial QR Web link)

- `POST /admin/whatsapp/templates`
  - Controller: `Admin\WhatsAppTemplateController@store`
  - Catalog-owned automations; free-form create redirects with error

- `GET /admin/whatsapp/templates/{id}/edit`
  - Controller: `Admin\WhatsAppTemplateController@edit`
  - Inertia: `Admin/WhatsApp/Edit` — provider name, language, body_preview + variable chips

- `PUT /admin/whatsapp/templates/{id}`
  - Controller: `Admin\WhatsAppTemplateController@update`

- `POST /admin/whatsapp/templates/{id}/activate`
  - Controller: `Admin\WhatsAppTemplateController@activate`

- `POST /admin/whatsapp/templates/{id}/deactivate`
  - Controller: `Admin\WhatsAppTemplateController@deactivate`

### 7.2 Messages

- `GET /admin/whatsapp/messages`
  - Controller: `Admin\WhatsAppMessageController@index`

- `GET /admin/orders/{id}/whatsapp`
  - Controller: `Admin\WhatsAppMessageController@byOrder`

- `GET /admin/whatsapp/messages/{id}`
  - Controller: `Admin\WhatsAppMessageController@show`

---

## 8. Admin – Analytics & CMS

### 8.1 Analytics

- `GET /admin/analytics/store-performance`
  - Controller: `Admin\AnalyticsController@storePerformance`
  - Inertia: `Admin/Analytics/StorePerformance`
  - Query: `period` (`today|yesterday|last_7|last_30|this_month|this_year|all|custom`), optional `from`/`to`, `granularity` (`hour|day|week|month`)
  - KPI sections: Penjualan / Kunjungan & Layanan / Operasional; charts; top products; customers; payment mix
  - Omzet hanya dari `order_status` ∈ `processing|shipped|delivered|completed`
  - Unique visitors dari `performance_metrics.storefront_unique_visitors` (middleware storefront)

- `GET /admin/analytics/store-performance/export`
  - Controller: `Admin\AnalyticsController@exportStorePerformance`
  - CSV UTF-8 (KPI + produk + customer + series)

- `GET /admin/analytics/import-performance`
  - Controller: `Admin\AnalyticsController@importPerformance`

### 8.1c Log Aktivitas (Monitoring)

- `GET /admin/activity-logs`
  - Controller: `Admin\ActivityLogController@index`
  - Inertia: `Admin/ActivityLogs/Index`
  - Query: `category` (`all|attendance|product|order|whatsapp|backup|settings`), `q`, `sort` (`newest|oldest`)
  - Source: append-only `event_logs` (order/payment/shipping, import, WhatsApp template, auth login/logout)
  - Aksi baris: tautan Detail ke entity terkait (bukan hapus — audit trail)

- `GET /admin/activity-logs/export`
  - Controller: `Admin\ActivityLogController@export`
  - CSV UTF-8 filtered by current category/`q`

### 8.1b Customers (Monitoring)

- `GET /admin/customers`
  - Controller: `Admin\CustomerController@index`
  - Inertia: `Admin/Customers/Index`
  - Syncs missing phones from `orders` → `customers`; search/sort; derived status + fraud score; summary cards; CSV export link

- `GET /admin/customers/export`
  - Controller: `Admin\CustomerController@export`

- `GET /admin/customers/{id}` / `GET /admin/customers/{id}/edit`
  - Controller: `Admin\CustomerController@show` / `@edit`
  - Inertia: `Admin/Customers/Edit` — profile edit + order history + fraud/duplicate warnings

- `PUT /admin/customers/{id}`
  - Controller: `Admin\CustomerController@update`
  - Phone is immutable (identity key); name/email/default address editable

Checkout `OrderService::createFromCart` upserts `customers` by phone and sets `orders.customer_id`.

### 8.2 CMS

- `GET /admin/pages`
  - Controller: `Admin\PageController@index`

- `GET /admin/pages/create`
  - Controller: `Admin\PageController@create`

- `POST /admin/pages`
  - Controller: `Admin\PageController@store`

- `GET /admin/pages/{id}/edit`
  - Controller: `Admin\PageController@edit`

- `PUT /admin/pages/{id}`
  - Controller: `Admin\PageController@update`

### 7.0b Beranda Pembeli (Tata Letak)

- `GET /admin/beranda` — `Admin\BerandaController@index` → `Admin/Beranda/Index`
- `PUT /admin/beranda` — save `content.layout.sections` on `cms_pages.beranda`
- `GET|PUT /admin/beranda/service-highlights` — `Admin/Beranda/ServiceHighlightsForm`
- `GET|PUT /admin/beranda/how-to-order` — `Admin/Beranda/HowToOrderForm`
- Public Home props: `homepageLayout` from `HomepageLayoutSettings::forStorefront()`

### 7.0c Model Produk (CMS Showcase)

- `GET /admin/model-products` — `Admin\ModelProductController@index` → `Admin/ModelProducts/Index`
  - List/kurasi `cms_model_products` + stats katalog (aktif/arsip/varian/sub-model), filter `q`/`status`, mode reorder
- `GET /admin/model-products/create` / `POST /admin/model-products`
- `POST /admin/model-products/sync` — buat baris CMS dari pasangan `product_category`+`product_model` yang belum ada
- `PUT /admin/model-products/reorder` — body `{ rows: [{ id, sort_order }] }`
- `GET /admin/model-products/{id}/edit` / `PUT /admin/model-products/{id}`
- `POST /admin/model-products/{id}/activate` / `POST /admin/model-products/{id}/deactivate`
- Storefront: `HomeController` / `CatalogController@modelsHub` / shared `modelMenu` memakai `ModelProductService::storefrontCards()` (aktif CMS; fallback `CatalogTaxonomy::modelCards`)

### 7.0d Cara Pemesanan (CMS Page)

- `GET /admin/cara-pemesanan` — `Admin\CaraPemesananController@edit` → `Admin/CaraPemesanan/Edit`
- `PUT /admin/cara-pemesanan` — simpan `cms_pages.slug = cara-pemesanan` (`heading`, `subtitle`, `body`, `steps`, `info_cards`, `published`)
- Public: `GET /cara-pemesanan` → `Public/HowToOrder` props `guide` dari `CaraPemesananSettings::forStorefront()`

### 7.0e Sering Ditanyakan (FAQ)

- `GET /admin/faq` — `Admin\FaqController@index` → `Admin/Faq/Index`
- `PUT /admin/faq/meta` — meta `cms_pages.faq` (`title`, `heading`, `subtitle`, `published`)
- `PUT /admin/faq/reorder` — `{ rows: [{ id, sort_order }] }`
- `GET /admin/faq/create` / `POST /admin/faq`
- `GET /admin/faq/{id}/edit` / `PUT /admin/faq/{id}` / `DELETE /admin/faq/{id}`
- Public: `GET /faq` → `Public/Faq` props `guide` dari `FaqSettings::forStorefront()`

### 7.0f Masalah & Solusi

- `GET /admin/masalah-solusi` — `Admin\MasalahSolusiController@index` → `Admin/MasalahSolusi/Index`
- `PUT /admin/masalah-solusi/meta` — meta `cms_pages.masalah-solusi`
- `PUT /admin/masalah-solusi/reorder`
- `GET /admin/masalah-solusi/create` / `POST /admin/masalah-solusi`
- `GET /admin/masalah-solusi/{id}/edit` / `PUT` / `DELETE`
- Public: `GET /masalah-dan-solusi` → `Public/MasalahSolusi` props `guide` dari `ProblemsSolutionsSettings::forStorefront()`

### 7.0g Informasi Toko (CMS Document)

- `GET /admin/tentang-kami` — `Admin\TentangKamiController@edit` → `Admin/CmsDocument/Edit`
- `PUT /admin/tentang-kami` — simpan `cms_pages.slug = tentang-kami` (`title`, `heading`, `body`, `published`)
- Public: `GET /about` → `Public/CmsPage` (body dari `content.body`, sanitize)

### 7.0h Ketentuan Layanan (CMS Document)

- `GET /admin/ketentuan-layanan` — `Admin\KetentuanLayananController@edit` → `Admin/CmsDocument/Edit`
- `PUT /admin/ketentuan-layanan` — simpan `cms_pages.slug = ketentuan-layanan`
- Public: `GET /policy/terms` → `Public/CmsPage`

### 7.0i Kebijakan Privasi (CMS Document)

- `GET /admin/kebijakan-privasi` — `Admin\KebijakanPrivasiController@edit` → `Admin/CmsDocument/Edit`
- `PUT /admin/kebijakan-privasi` — simpan `cms_pages.slug = kebijakan-privasi`
- Public: `GET /policy/privacy` → `Public/CmsPage`

### 7.0j Apa Kata Pelanggan Kami (Testimoni)

- `GET /admin/apa-kata-pelanggan` — `Admin\TestimonialController@apaKata` → `Admin/Testimonials/Index` (website list + meta form)
- `PUT /admin/apa-kata-pelanggan/meta` — meta `cms_pages.slug = testimoni` (`title`, `heading`, `subtitle`, `published`) via `TestimonialPageSettings`
- Item CRUD tetap `admin.testimonials.*` (Monitoring → Ulasan memakai index yang sama tanpa meta surface)
- Public: `GET /reviews` → `Public/Reviews` props `pageMeta` dari `TestimonialPageSettings::forStorefront()` + published `cms_testimonials` / gallery

### 7.0k Hasil Pemasangan Kami (Galeri)

- `GET /admin/hasil-pemasangan` — `Admin\TestimonialController@hasilPemasangan` → `Admin/Testimonials/Index` (foto list + meta form)
- `PUT /admin/hasil-pemasangan/meta` — meta `cms_pages.slug = hasil-pemasangan` via `InstallationPageSettings`
- Item CRUD tetap `admin.gallery-items.*` (Monitoring → Ulasan tab foto)
- Public: `GET /reviews` → ulasan saja; `GET /hasil-pemasangan` → listing hasil pemasangan; `GET /hasil-pemasangan/{parent_sku}` → galeri per produk. Kartu produk terkait dapat memuat `installation_href` bila ada media instalasi.

- `GET /admin/banners`
  - Controller: `Admin\BannerController@index`
  - Inertia: `Admin/Banners/Index` (Promo Toko — list/grid, search, filter status, auto-promotions)
  - Props: `banners`, `pagination`, `viewMode`, `filters`, `createHref`, `autoPromotions`

- `GET /admin/banners/create` / `POST /admin/banners`
  - Create form + store (`title`, `link_url`, `sort_order`, `published`, `image`)

- `GET /admin/banners/{id}/edit` / `PUT /admin/banners/{id}`
  - Edit form + update (gambar opsional; jika tidak diunggah ulang, gambar lama / resolve dari link produk)

- `POST /admin/banners/{id}/publish` / `POST /admin/banners/{id}/unpublish`
  - Toggle `published` (aktif di beranda publik)

- `PUT /admin/banners/auto-promotions`
  - Controller: `Admin\BannerController@updateAutoPromotions`
  - Body: `enabled` (bool, required), `max_slides` (int 1–8, optional; default 3).
  - Persists to `cms_pages.slug = beranda` → `content.auto_promotions` (no new table).

- `GET /admin/flash-sale`
  - Controller: `Admin\FlashSaleController@index`
  - Inertia: `Admin/FlashSale/Index` (list/grid produk dengan atribut `promo_flash_sale` / `flash_sale`)
  - Props: `products`, `pagination`, `viewMode`, `activeStatus`, `summary`, `createHref`, `period`, `periodUpdateUrl`
  - Periode kampanye: `cms_pages.slug = flash-sale` → `content.period` (`enabled`, `starts_at`, `ends_at`). Tidak ada tabel kampanye terpisah.

- `PUT /admin/flash-sale/period`
  - Controller: `Admin\FlashSaleController@updatePeriod`
  - Body: `enabled` (bool), `starts_at` / `ends_at` (nullable datetime; ends setelah starts)
  - Menyimpan `content.period` pada `cms_pages.flash-sale`. Storefront hanya menampilkan label/listing Flash Sale saat status `live`.

- `GET /admin/flash-sale/create` / `POST /admin/flash-sale`
  - Form pilih produk + `flash_sale` + opsional `compare_price` → menulis `product_attributes` (`promo_flash_sale`, `promo_compare_price`, source `internal`)

- `GET /admin/flash-sale/{product}/edit` / `PUT /admin/flash-sale/{product}`
  - Edit flag Flash Sale + harga coret produk

- `POST /admin/flash-sale/{product}/enable` / `POST /admin/flash-sale/{product}/disable`
  - Toggle `promo_flash_sale` true/false

- `GET /admin/vouchers`
  - Controller: `Admin\VoucherController@index`
  - Inertia: `Admin/Vouchers/Index` (list/grid `store_vouchers`)

- `GET /admin/vouchers/create` / `POST /admin/vouchers`
  - Create voucher (`name`, `code`, `discount_type`, `discount_value`, `min_purchase`, `starts_at`, `ends_at`, optional `publish_now`)

- `GET /admin/vouchers/{id}/edit` / `PUT /admin/vouchers/{id}`
  - Update voucher fields

- `POST /admin/vouchers/{id}/publish` / `POST /admin/vouchers/{id}/unpublish`
  - Publish is exclusive (other published vouchers set unpublished)

- `POST /checkout/voucher`
  - Apply code → session `checkout_voucher`; validates published + schedule + min_purchase

- `POST /checkout/voucher/remove`
  - Clear session voucher

- `GET /admin/cod-settings` / `PUT /admin/cod-settings`
  - Controller: `Admin\CodSettingsController@edit` / `@update`
  - Inertia: `Admin/CodSettings/Edit`
  - Persists to `cms_pages.slug = checkout` → `content.cod` (`enabled`, `fee_type`, `fee_value`, `max_order_amount`)

- `GET /admin/shipping-subsidy` / `PUT /admin/shipping-subsidy`
  - Controller: `Admin\ShippingSubsidyController@edit` / `@update`
  - Inertia: `Admin/ShippingSubsidy/Edit`
  - Persists to `cms_pages.slug = checkout` → `content.shipping_subsidy` (`enabled`, `subsidy_type`, `subsidy_value`, `carriers.jnt`)
  - Checkout applies via `ShippingService::estimateBreakdown`; order stores net `shipping_amount` + `shipping_subsidy_amount`

- `GET /admin/testimonials`
  - Controller: `Admin\TestimonialController@index`
  - Inertia: `Admin/Testimonials/Index`
  - Query: `tab=website|foto`, `q`, `sort`, `published`
  - Purpose: Monitoring → Ulasan — dual list for `cms_testimonials` (website) and `cms_gallery_items` (foto / hasil pemasangan). Meta halaman `/reviews` diedit lewat `admin.apa-kata-pelanggan.*`.

- `GET /admin/testimonials/create` / `POST /admin/testimonials`
- `GET /admin/testimonials/{id}/edit` / `PUT /admin/testimonials/{id}`
  - Inertia: `Admin/Testimonials/Form`
- `POST /admin/testimonials/{id}/publish` / `POST /admin/testimonials/{id}/unpublish`

- `GET /admin/gallery-items/create` / `POST /admin/gallery-items`
- `GET /admin/gallery-items/{id}/edit` / `PUT /admin/gallery-items/{id}`
  - Controller: `Admin\GalleryItemController`
  - Inertia: `Admin/Testimonials/GalleryForm`
  - Attaches to `cms_pages.slug = hasil-pemasangan`
- `POST /admin/gallery-items/{id}/publish` / `POST /admin/gallery-items/{id}/unpublish`

---

## 9. Admin – Settings & Users

### 9.1 Users / Manajemen Admin

- `GET /admin/users`
  - Controller: `Admin\UserController@index`
  - Inertia: `Admin/Users/Index`
  - Query: `q`, `role` (`super_admin|admin|staff|viewer`), `status` (`active|inactive`), `sort` (`newest|oldest|name|role`)
  - Purpose: Manajemen Admin — daftar akun panel (`users`)

- `GET /admin/users/create` / `POST /admin/users`
  - Inertia: `Admin/Users/Form`
  - Body: `name`, `email`, `password` + `password_confirmation`, `role`, `status`

- `GET /admin/users/{id}/edit` / `PUT /admin/users/{id}`
  - Inertia: `Admin/Users/Form`
  - Password opsional; tidak boleh menonaktifkan akun sendiri; tidak boleh menurunkan/nonaktifkan Super Admin terakhir yang aktif

- `POST /admin/users/{id}/activate` / `POST /admin/users/{id}/deactivate`
  - Toggle `status`; deactivate self / last active super_admin ditolak

### 9.1b Profil Saya (akun login)

- `GET /admin/profile` — `Admin\ProfileController@edit` → `Admin/Profile/Edit`
- `PUT /admin/profile` — update `name`, `email`, optional `password` (+ `current_password` + `password_confirmation`)
- Tidak mengubah `role` / `status` (itu `admin.users.*`)

### 9.2 System Settings

- `GET /admin/settings`
  - Controller: `Admin\SettingsController@index`
  - Inertia: `Admin/ResourceShow` (judul Pengaturan Sistem; nilai integrasi read-only dari config/env)

- `PUT /admin/settings`
  - Controller: `Admin\SettingsController@update`
  - Konfirmasi saja; kredensial tetap di `.env`

This includes:

- WhatsApp API keys and configuration.  
- Shopee import settings (template references).  
- Shipping provider settings.

---

## 10. External API Endpoints

### 10.1 WhatsApp Webhook

- `GET /webhook/whatsapp`
  - Controller: `Webhook\WhatsAppController@verify`
  - Purpose:
    - Handle verification handshake (e.g. `hub.challenge`).

- `POST /webhook/whatsapp`
  - Controller: `Webhook\WhatsAppController@handle`
  - Purpose:
    - Receive inbound messages and status updates.
  - Behavior:
    - Parse payload.  
    - Store `whatsapp_messages`.  
    - Link messages to `orders` where applicable.

### 10.2 Shipping Provider Webhook (optional)

- `POST /webhook/shipping/jnt`
  - Controller: `Webhook\ShippingController@handleJnt`
  - Purpose:
    - Receive status updates from JNT or similar carriers.
  - Behavior:
    - Update `shipping_records` and cascade `shipping_status` on `orders`.

---

## 11. Agent Checklist for Routes & APIs

When adding or modifying routes/APIs, agents must:

- Keep public store routes focused on catalog, cart, and checkout; avoid exposing internal data unnecessarily.  
- Map admin routes to the functional sections defined in the Admin UI flows (Dashboard, Catalog, Imports, Orders, Shipping, WhatsApp, Analytics, CMS, Settings).  
- Ensure API endpoints for imports, orders, payments, shipping, and WhatsApp go through domain modules, not ad‑hoc logic.  
- Secure admin and webhook routes with appropriate middleware and validation.  
- Update this routes document whenever new major endpoints or route groups are introduced.  
- Avoid introducing overlapping or duplicate endpoints that bypass logging and domain contracts.

---
