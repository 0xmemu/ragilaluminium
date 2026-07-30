# System Architecture – Ragil Aluminium Website

This document is the **high-level architecture overview** for the Ragil Aluminium
website. It is derived strictly from the existing project sources:

- `skills/stage-1-foundation.md` (business scope & ecosystem)
- `skills/stage-3-modules.md` (module map & boundaries)
- `docs/database-schema-ragil-aluminium.md` (canonical data model)
- `docs/api-and-routes-ragil-aluminium.md` (route & API surface)

It does **not** introduce new tables, routes, or flows. Where the current
implementation differs from the doc contracts (and the contracts are authoritative),
this document describes the contracted design.

---

## 1. System Posture

Ragil Aluminium is a **modular monolith**: one deployable Laravel application, but
internally organized into clearly separated modules with their own data and
responsibilities. Modules coordinate through services, domain events, and
defined route/controller contracts — not by reaching into each other's tables.

The website is the **transaction engine** at the center of an ecosystem:

```
            ┌────────────┐
            │   Shopee   │  (product data, SKUs, templates)
            └─────┬──────┘
                  │ Mass Upload / Update import
                  ▼
        ┌─────────────────────────┐
        │   Ragil Aluminium App   │
        │  (Laravel modular monolith)
        │  Catalog · Order · Media │
        │  Import · WhatsApp ·     │
        │  Shipping · Admin · Public│
        └─────┬───────────────┬────┘
              │ outbound/inbound │ webhook push
              ▼                 ▼
        ┌──────────┐      ┌────────────┐
        │ WhatsApp │      │ JNT Cargo  │  (shipping, waybill, status)
        │ Business │      └────────────┘
        └──────────┘
```

---

## 2. Main Modules

### 2.1 Catalog Module
**Source of truth for products, variants, attributes, taxonomy, and base prices.**
- Tables: `products`, `product_variants`, `product_attributes`, `product_media`
  (media records are owned by the Media Module but linked here).
- Internal 3-layer taxonomy: `product_category` (WINDOW, DOOR, BOUVEN),
  `product_model` (JUNGKIT, SLIDING, SWING, FIXED, ZIGZAG, …),
  `design_variant` (PLAIN, ORNAMENT, COMBINATION, SERIES_A/B/C).
- Official SKU references are Shopee `parent_sku` / `variant_sku`; the internal
  taxonomy is for navigation, filters, and reporting only — not for SKU formation.
- Exposes product/variant data, stock, base price, media references, and taxonomy
  lists. Does **not** own cart, order pricing, payment, or shipping logic.

### 2.2 Order Module
**Source of truth for the order lifecycle.**
- Tables: `orders`, `order_items`. (Carts are transient session/cookie state
  managed via `CartService`; persisted only when an order is placed.)
- Owns `order_status` (pending_payment → processing → shipped → delivered →
  completed, plus issue / return_in_process / cancelled).
- Stores **snapshots** of catalog data (name, SKU, variation, unit price, quantity)
  in `order_items` for long-term record-keeping.
- Does not own payment or shipping state; it links to `payments` and
  `shipping_records`.

### 2.3 Payment Module
**Source of truth for payment status.**
- Table: `payments`.
- Tracks `status` (pending, completed, failed, refunded), method
  (cod, transfer, gateway), `evidence_url` (proof, often shared via WhatsApp),
  and `paid_at`.
- On confirmation, updates payment status and drives order forward (via events).

### 2.4 Shipping Module
**Source of truth for shipping status.**
- Table: `shipping_records`.
- Integrates carrier (JNT Cargo) for cost, waybill, and tracking; reflects carrier
  status into `shipping_records.status` and cascades `orders.shipping_status`
  (pending_pickup → in_process → in_transit → delivered, plus returned/cancelled).

### 2.5 Import Module
**Source of truth for bulk catalog operations.**
- Tables: `import_jobs`, `import_job_rows`.
- Handles Shopee Mass Upload / Mass Update files. Row-level failures are preferred
  over whole-job failure; correction files are derived from failed rows. All bulk
  catalog changes go through this module — no ad-hoc bulk scripts.

### 2.6 Media Module
**Source of truth for product images/media URLs.**
- Table: `product_media`.
- Reads image URLs from Shopee source files, downloads and stores them in internal
  storage/CDN, and exposes `stored_url`. Frontend consumes `stored_url` and respects
  `visibility`. Uses archive-style flags (`visibility = archived` / `hidden`) instead
  of deleting media.

### 2.7 WhatsApp Module
**Source of truth for messaging logs; notification & communication channel.**
- Tables: `whatsapp_templates`, `whatsapp_messages`.
- Uses dual-provider gateway: `meta` resmi and optional `waha`.
  Templates map internal keys (`order_created`, `payment_confirmed`,
  `order_shipped`, `order_delivered`, `order_issue_followup`) to Meta templates;
  WAHA sends rendered `body_preview` text for compare/switch mode.
- Reflects order/payment/shipping state; does **not** own business state or perform
  verification. Logs outbound and inbound messages, linked to `orders` where applicable.

### 2.8 Admin UI Module
**Backend frontend for Store Admins** (`/admin`, auth + role middleware).
- Surfaces Catalog, Imports, Orders, Shipping, Payments, WhatsApp, Analytics, CMS,
  Settings, Users.
- Frontend only: calls each domain module's services/controllers; does not touch
  foreign tables directly.

### 2.9 Public UI Module
**Customer-facing frontend** (catalog, cart, checkout, basic order status).
- Routes under `/` (home, `/windows`, `/doors`, `/bouven`, `/search`,
  `/product/{parent_sku}`, `/cart`, `/checkout`, `/order/...`).
- Reads catalog via Catalog Module; creates orders via Order Module. Does not touch
  imports, media processing internals, or WhatsApp logs.

### 2.10 Cross-cutting
- `users` (admins/staff), `customers` (reporting & reuse), `event_logs`,
  `performance_metrics`.

---

## 3. Data Flow Between Modules

### 3.1 Import → Catalog → Media
```
Admin uploads Shopee file
  → POST /admin/imports  (ImportJobController@store)
  → import_jobs (status: pending → running)
  → Job: ProcessCatalogImport (queued; holds only jobId + storedPath)
      → parses rows → import_job_rows
      → writes products / product_variants / product_attributes
      → creates product_media (status: pending, source_url from Shopee)
  → Job: DownloadProductMedia (queued per media row)
      → downloads image → stored_path / stored_url
      → product_media.status: downloaded
  → import_jobs.status: completed (success_rows / failed_rows tallied)
```
Failed rows stay as `import_job_rows` with `error_reason`; admins download
corrections. No hard deletes — archive flags instead.

### 3.2 Checkout → Order → Payment/WhatsApp
```
Customer: POST /cart/add → CartService (session/cookie)
Customer: POST /checkout/validate → validation + shipping estimate
Customer: POST /checkout/place-order
  → CheckoutController@placeOrder
  → OrderService::createFromCart()
      → writes orders, order_items, initial payments
      → dispatches OrderCreated event
  → Listener: SendOrderCreatedWhatsApp
      → WhatsAppService renders order_created template
      → whatsapp_messages (outbound), links to orders
  → GET /order/{order_number}/confirmation
```
`WhatsAppService` degrades safely (returns null, no partial write) when no template
row or no API token exists.

### 3.3 Payment → Order → WhatsApp
```
Admin: POST /admin/orders/{id}/payments (manual transfer confirmation)
  → PaymentController@store → payments (completed, evidence_url)
  → PaymentConfirmed event
  → Listener: SendPaymentConfirmedWhatsApp
      → whatsapp_messages (outbound), order status advances
```

### 3.4 Shipping → Order / WhatsApp (two directions)
- **Outbound (admin-initiated):** `POST /admin/shipping/{id}/refresh` →
  `ShippingService::applyCarrierUpdate` re-queries carrier; updates
  `shipping_records` and cascades `orders.shipping_status`; customer is notified
  via WhatsApp template `order_shipped` / `order_delivered`.
- **Inbound (carrier webhook):** `POST /webhook/shipping/jnt` →
  `ShippingController@handleJnt` → `ShippingService::applyCarrierUpdate` updates
  `shipping_records` + cascades `orders.shipping_status` (graceful when waybill
  missing).

### 3.5 WhatsApp Inbound (customer)
```
POST /webhook/whatsapp → WhatsAppController@handle
  → parses payload Meta → whatsapp_messages (inbound, provider=meta)
POST /webhook/whatsapp/waha → WhatsAppController@handleWaha
  → parses WAHA events → whatsapp_messages (inbound, provider=waha)
  → linked to orders where applicable (manual comms: proof, confirmations)
GET /webhook/whatsapp  → verification handshake (hub.challenge)
```

---

## 4. External Integrations

### 4.1 Shopee (inbound data)
- **Role:** source of product data format (Mass Upload / Mass Update templates),
  2-tier variant structure, official `parent_sku` / `variant_sku`, and
  `category_id` / category attributes.
- **Integration point:** Import Module only. The site never writes back to Shopee.
- **Contract:** `products.parent_sku` / `product_variants.variant_sku` are the
  official SKU references; no parallel SKU system is created.

### 4.2 WhatsApp Gateway (bidirectional)
- **Outbound:** transactional/notification messages triggered by domain events
  (OrderCreated, PaymentConfirmed, shipping updates). Templates owned in
  `whatsapp_templates`; sends/receipts logged in `whatsapp_messages`.
- **Provider switch:** `WHATSAPP_PROVIDER` selects active provider; optional
  `WHATSAPP_COMPARE_PROVIDER` + `WHATSAPP_COMPARE_ALLOWLIST` duplicate sends only
  to nomor uji for direct comparison.
- **Inbound:** webhook Meta (`/webhook/whatsapp`) and webhook WAHA
  (`/webhook/whatsapp/waha`) log customer messages and link them to orders.
- **Boundaries:** WhatsApp Module reflects state; it never decides order/payment/
  shipping actions.

### 4.3 JNT Cargo (shipping)
- **Role:** shipping cost, waybill creation/tracking, authoritative shipping status.
- **Integration points:**
  - Admin refresh (`/admin/shipping/{id}/refresh`) → carrier re-query.
  - Carrier push (`POST /webhook/shipping/jnt`) → status update.
- **Effect:** updates `shipping_records.status` + `status_raw`, cascades
  `orders.shipping_status`.

### 4.4 Webhooks & Security
- `webhook/*` routes are CSRF-exempt (see `bootstrap/app.php`
  `validateCsrfTokens(except: ['webhook/*'])`).
- Admin routes are protected by `auth` + `admin` (role) middleware.
- Sensitive config (WhatsApp keys, Shopee settings, shipping keys) lives in
  `admin/settings`, not hardcoded.

---

## 5. Guest-Only Checkout & WhatsApp Notification Model

### 5.1 Guest-only checkout
- Checkout requires **no customer account**. The customer supplies name, phone,
  email (optional), and shipping address inline at `POST /checkout/place-order`.
- `OrderService::createFromCart()` snapshots customer info directly onto `orders`
  (`customer_name`, `customer_phone`, `customer_email`, `shipping_address_*`).
- `customers` is an **optional reporting/reuse** table keyed by `phone`; it is not
  required to place an order, and `orders` snapshot fields remain the source of
  truth for that order.
- `users` (admin/staff) is entirely separate from customers and never participates
  in storefront checkout.

### 5.2 WhatsApp as the notification channel
- Because checkout is guest-based (no email/password account), **WhatsApp is the
  primary asynchronous notification channel** to the customer.
- Notifications are **event-driven**, not polled:
  - `OrderCreated` → `SendOrderCreatedWhatsApp` (order_created template).
  - `PaymentConfirmed` → `SendPaymentConfirmedWhatsApp` (payment_confirmed template).
  - Shipping changes → order_shipped / order_delivered templates.
- Each outbound message is logged in `whatsapp_messages` with `order_id`, phone,
  template key, status, and provider message id. Inbound customer replies are logged
  and, where possible, linked to the related order for admin follow-up.
- The WhatsApp Module never alters order/payment/shipping state; it only reflects it.

### 5.3 Order status visibility (guest)
- Customers track status without login via `GET /order/status` +
  `POST /order/status` (order number + phone/email) or the post-checkout
  confirmation page (`GET /order/{order_number}/confirmation`).

---

## 6. Cross-Module Interaction Rules (Architecture Constraints)

1. **No direct cross-module data access** — catalog/order/payment/shipping/WhatsApp
   each change only through their own APIs/services.
2. **Coordinate via events or service calls** — order creation notifies WhatsApp;
   payment confirmation advances order + notifies WhatsApp; shipping updates inform
   Order and WhatsApp.
3. **Single source of truth per concern** — Catalog (products/prices), Order
   (lifecycle), Payment (payment status), Shipping (shipping status), WhatsApp
   (message logs).
4. **Archive, don't delete** — use `status`/`visibility` flags (`archived`,
   `hidden`) for catalog and media rather than hard deletes.
5. **Frontends stay thin** — Admin UI and Public UI call domain modules; they do
   not implement business logic or touch foreign tables.

---

## 7. Route Surface Summary (per `api-and-routes-ragil-aluminium.md`)

- **Public web:** `/`, `/about`, `/faq`, `/contact`, `/cara-pemesanan`,
  `/policy/privacy`, `/policy/terms`, `/windows`, `/doors`, `/bouven`, `/search`,
  `/product/{parent_sku}`, `/cart*`, `/checkout*`, `/order/*`.
- **Auth:** `/login`, `/logout` (admin only).
- **Admin (`/admin`, auth+role):** dashboard, products/variants/attributes/media,
  imports, orders, payments, shipping, whatsapp (templates/messages), analytics,
  cms (pages/banners), users, settings.
- **API (schema-shaped JSON on `api/*` or `Accept: application/json`):** catalog
  category, product detail (`Product::toApiArray()` / `ProductVariant::toApiArray()`),
  search.
- **Webhooks (CSRF-exempt):** `GET/POST /webhook/whatsapp`,
  `POST /webhook/whatsapp/waha`, `POST /webhook/shipping/jnt`.

---

## 8. Agent Checklist (Architecture Alignment)

Before designing or coding any feature, confirm:
- [ ] The feature is assigned to the correct module (Catalog, Order, Payment,
      Shipping, Import, Media, WhatsApp, Admin UI, Public UI).
- [ ] The module only handles its own responsibilities; cross-module work uses
      APIs/services/events.
- [ ] Catalog remains source of truth for products/prices; Order for lifecycle;
      Payment for payment status; Shipping for shipping status; WhatsApp for logs.
- [ ] All bulk catalog changes go through `import_jobs` / `import_job_rows`.
- [ ] `product_media.stored_url` is the image source; `visibility` is respected.
- [ ] WhatsApp is event-driven and never mutates business state.
- [ ] Checkout stays guest-only; customer data is snapshotted onto `orders`.
- [ ] No new tables/fields/routes are invented beyond the schema and routes docs.
