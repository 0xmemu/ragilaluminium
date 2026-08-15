# API & Routes – Ragil Aluminium Website

This document defines the **core routes and API endpoints** for the Ragil Aluminium website.  
It connects the System Architecture, database schema, and UI flows (admin + public store) into a concrete map of URLs and controllers.

This historical copy is not an active integration surface; use the canonical route contract referenced below.

> **Status: HISTORICAL / NON-CANONICAL.** This duplicate logic document is retained for audit context only. Do not use its route, controller, taxonomy, or enum examples for implementation. The active contract is `docs/api-and-routes-ragil-aluminium.md`, supported by `docs/contracts/ROLE-AND-STATUS-CONTRACT.md` and the active sitemap files. In particular, the runtime uses `/products` and `/products/all`, redirects `/search` to `/products`, and uses `POLOS` rather than `PLAIN`.

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

- `GET /contact`
  - Controller: `PageController@contact`

- `GET /policy/privacy`
  - Controller: `PageController@privacy`

- `GET /policy/terms`
  - Controller: `PageController@terms`

### 1.2 Catalog Browsing

- `GET /products/windows` (legacy `/windows` redirects 301)
  - Controller: `CatalogController@windows`
  - Purpose:
    - List WINDOW products, with filters for model & design variant.

- `GET /products/doors` (legacy `/doors` redirects 301)
  - Controller: `CatalogController@doors`

- `GET /products/bouven` (legacy `/bouven` redirects 301)
  - Controller: `CatalogController@bouven`

Common query parameters for category pages:

- `model` (e.g. `JUNGKIT`, `SLIDING`, `SWING`, etc.)  
- `design` (e.g. `PLAIN`, `ORNAMENT`, `COMBINATION`, `SERIES_A`)  
- `price_min`, `price_max`  
- `sort` (`price_asc`, `price_desc`, `popular`, `newest`)

Example:

- `/products/windows/sliding/plain?sort=popular`

- `GET /search`
  - Controller: `SearchController@index`
  - Query params:
    - `q` – search term.
  - Purpose:
    - Full‑text search across products/variants/attributes.

### 1.3 Product Detail

- `GET /product/{parent_sku}`
  - Controller: `ProductController@show`
  - Purpose:
    - Show product detail page, gallery, variant selector, attributes.
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
    - Customer info and address.
  - Purpose:
    - Validate inputs, optionally estimate shipping.

- `POST /checkout/place-order`
  - Controller: `CheckoutController@placeOrder`
  - Payload:
    - Customer details.  
    - Shipping address.  
    - Selected shipping method.  
    - Payment method.
  - Behavior:
    - Create `orders`, `order_items`, and initial `payments` records.
    - Trigger domain events for order creation.

- `GET /order/{order_number}/confirmation`
  - Controller: `OrderController@confirmation`
  - Purpose:
    - Show post‑checkout confirmation page.

---

## 3. Public Store – Order Status View (Optional)

- `GET /order/status`
  - Controller: `OrderController@statusForm`
  - Purpose:
    - **Session first:** load `confirmed_orders` and show order detail (no form).
    - **Fallback:** if session empty, show lookup form (order number + phone/email).
  - Inertia props: `has_session_orders`, `orders[]`, `order`, `searched`.

- `POST /order/status`
  - Controller: `OrderController@statusLookup`
  - Payload:
    - `order_number`, `customer_phone` or `customer_email`.
  - Behaviour:
    - Guest-safe (no login). When the matched order has a J&T waybill, refresh carrier track via `ShippingService::refreshStatus` (skipped if refreshed within ~2 minutes).
    - On match: append `order_number` to session `confirmed_orders`.
  - Response (Inertia `Public/OrderStatus`):
    - Order summary, tri-status timeline, items, and optional `shipping` (`carrier_name`, `waybill_number`, `status`, `status_raw`, `tracking_url`, `last_status_at`).

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

- `GET /admin/products/create`
  - Controller: `Admin\ProductController@create`

- `POST /admin/products`
  - Controller: `Admin\ProductController@store`

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

#### Teruskan Popularitas

- `GET /admin/products/popularity-boosts`
  - Controller: `Admin\ProductPopularityBoostController@index`
  - Purpose: daftar konfigurasi sumber → target, seed, skor efektif, ambang notifikasi, dan status audit.
- `POST /admin/products/popularity-boosts`
  - Controller: `Admin\ProductPopularityBoostController@store`
  - Purpose: snapshot penjualan valid produk A sebagai seed popularitas produk B.
- `POST /admin/products/popularity-boosts/{boost}/disable`
  - Controller: `Admin\ProductPopularityBoostController@disable`
  - Purpose: menonaktifkan boost dengan alasan wajib; seed target dikosongkan, riwayat order tetap.
- `POST /admin/products/popularity-boosts/{boost}/enable`
  - Controller: `Admin\ProductPopularityBoostController@enable`
  - Purpose: mengaktifkan kembali dengan snapshot penjualan sumber terbaru.

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

- `POST /admin/products/{id}/media`
  - Controller: `Admin\ProductMediaController@store`

- `PUT /admin/media/{media_id}`
  - Controller: `Admin\ProductMediaController@update`

- `POST /admin/media/{media_id}/set-main`
  - Controller: `Admin\ProductMediaController@setMain`

- `POST /admin/media/{media_id}/archive`
  - Controller: `Admin\ProductMediaController@archive`

- `POST /admin/media/{asset_id}/attach`
  - Controller: `Admin\ProductMediaController@bulkAttach`
  - Body: `product_ids[]`, `position`, `show_in_catalog`, `is_installation`, `is_main_image`, `visibility`.
  - One shared asset can be attached idempotently to up to 100 products; this
    does not duplicate bytes or delete a physical asset.

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
  - Behavior:
    - Save file, create `import_jobs` record, dispatch job to queue.

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

- `GET /admin/orders/{id}`
  - Controller: `Admin\OrderController@show`

- `PUT /admin/orders/{id}/status`
  - Controller: `Admin\OrderController@updateStatus`
  - Payload:
    - New `order_status` (validated against allowed transitions).

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

- `POST /admin/whatsapp/templates`
  - Controller: `Admin\WhatsAppTemplateController@store`

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

- `GET /admin/analytics/import-performance`
  - Controller: `Admin\AnalyticsController@importPerformance`

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

- `GET /admin/banners`
  - Controller: `Admin\BannerController@index`

- `POST /admin/banners`
  - Controller: `Admin\BannerController@store`

---

## 9. Admin – Settings & Users

### 9.1 Users

- `GET /admin/users`
  - Controller: `Admin\UserController@index`

- `GET /admin/users/create`
  - Controller: `Admin\UserController@create`

- `POST /admin/users`
  - Controller: `Admin\UserController@store`

- `GET /admin/users/{id}/edit`
  - Controller: `Admin\UserController@edit`

- `PUT /admin/users/{id}`
  - Controller: `Admin\UserController@update`

- `POST /admin/users/{id}/activate`
  - Controller: `Admin\UserController@activate`

- `POST /admin/users/{id}/deactivate`
  - Controller: `Admin\UserController@deactivate`

### 9.2 System Settings

- `GET /admin/settings`
  - Controller: `Admin\SettingsController@index`

- `PUT /admin/settings`
  - Controller: `Admin\SettingsController@update`

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
