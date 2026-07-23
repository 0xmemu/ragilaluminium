# Skill: Stage 3 – System Modules & Boundaries for Ragil Aluminium

This document defines the **core system modules** and their **boundaries** in the Ragil Aluminium website, following a modular‑monolith mindset: one deployable app, but clearly separated internal modules (catalog, orders, imports, media, WhatsApp, shipping, etc.).  
All agents must treat these module boundaries as **architecture rules**: do not design features that blur responsibilities or bypass module contracts.

---

## 1. High‑Level Module Map

The Ragil Aluminium system is composed of these main modules:

1. **Catalog Module** – manages products, variants, taxonomy, and media references.  
2. **Order Module** – manages carts, orders, line items, and order statuses.  
3. **Payment Module** – manages payment status and links to payment proofs (via WhatsApp or uploads).  
4. **Shipping Module** – manages shipping addresses, shipping cost, carrier integration (JNT Cargo), and shipping statuses.  
5. **Import Module** – handles bulk upload/update pipelines for catalog and inventory.  
6. **Media Module** – processes and stores product media (images/videos) referenced by catalog.  
7. **WhatsApp Module** – manages templates, triggers, logs, and communication between system and customers.  
8. **Admin UI Module** – provides backend interfaces for Store Admins to operate all the above modules.  
9. **Public UI Module** – provides customer‑facing views (catalog, cart, checkout, basic order status).

Each module owns its **own data and logic**.  
Modules interact via defined contracts (APIs, services, events), not by reaching into each other’s internals directly.

---

## 2. Catalog Module

### 2.1 Responsibilities

The Catalog Module is responsible for:

- Defining and storing products and variants.
- Managing internal taxonomy:
  - `product_category`,
  - `product_model`,
  - `design_variant`.
- Storing business attributes:
  - names, descriptions,
  - prices (base list prices),
  - stock levels,
  - attributes (color, size, glass type, etc.).
- Linking products/variants to media (image/video references).
- Aligning internal catalog data with Shopee data (SKUs, category IDs, variation structures).

### 2.2 Data Owned by Catalog Module

Example entities owned:

- `products`
  - `id`
  - `parent_sku`
  - `product_category`
  - `product_model`
  - `design_variant`
  - `name`
  - `description`
  - `shopee_category_id`
  - other base attributes.

- `product_variants`
  - `id`
  - `product_id`
  - `variant_sku`
  - `variation_1_name` / `variation_1_option`
  - `variation_2_name` / `variation_2_option`
  - `price`
  - `stock_quantity`
  - `weight`
  - `dimensions`
  - references to media.

- `product_attributes`
  - structured attributes (e.g., material, glass type, frame thickness).

- `product_taxonomy`
  - lists of allowed values for `product_category`, `product_model`, `design_variant`.

Catalog data is the **source of truth** for what can be ordered.

### 2.3 Boundaries

The Catalog Module:

- Does **not** manage:
  - cart logic,
  - order pricing calculations,
  - payment or shipping statuses.
- Exposes:
  - product and variant data,
  - stock and base price,
  - media references,
  - taxonomy lists.

Other modules (Order, Payment, Shipping) **consume** catalog data; they do not directly edit catalog internals except via catalog APIs.

---

## 3. Order Module

### 3.1 Responsibilities

The Order Module is responsible for:

- Cart management (temporary selection and configuration before checkout).
- Order creation from carts.
- Order line items:
  - referencing catalog products/variants,
  - storing snapshot of prices and quantities at order time.
- Maintaining `order_status` across the lifecycle:
  - `pending_payment`,
  - `processing` / `awaiting_fulfillment`,
  - `packing`,
  - `shipped`,
  - `delivered`,
  - `completed`,
  - `issue` / `return_in_process`.

### 3.2 Data Owned by Order Module

Examples:

- `carts`
  - customer identifier (session/temporary),
  - items (product_variant_id, quantity),
  - computed totals (pre‑checkout).

- `orders`
  - `id`
  - customer info snapshot (name, address, WhatsApp number),
  - timestamps (created_at, updated_at),
  - `order_status`,
  - links to payment and shipping records.

- `order_items`
  - `id`
  - `order_id`
  - `product_id` / `product_variant_id` references,
  - snapshot of product name and attributes at time of order,
  - unit price at time of order,
  - quantity,
  - line subtotal.

The Order Module stores **snapshots** of catalog information necessary for long‑term record‑keeping.

### 3.3 Boundaries

The Order Module:

- Does not own catalog data (products, variants) beyond snapshots.
- Does not implement payment gateways; it only tracks payment status via the Payment Module.
- Does not implement shipping logic or carrier APIs; it links to Shipping Module records.

Order logic must use:

- Catalog data for product selection and pricing.
- Payment Module for confirming payment.
- Shipping Module for shipping states.

---

## 4. Payment Module

### 4.1 Responsibilities

The Payment Module is responsible for:

- Representing payment state for each order.
- Handling references to payment proof (e.g., WhatsApp messages, uploaded files).
- Enabling transitions in `payment_status`:
  - `unpaid` / `pending`,
  - `paid`,
  - `refunded`.

It does **not** need to implement online payment gateways initially; manual transfers via bank and proof via WhatsApp are sufficient.

### 4.2 Data Owned by Payment Module

Examples:

- `payments`
  - `id`
  - `order_id`
  - `payment_status`
  - amount,
  - payment method (e.g., bank transfer),
  - timestamps (requested, confirmed).

- `payment_proofs`
  - `id`
  - `payment_id`
  - reference to WhatsApp message ID or uploaded image/file ID.
  - verification notes (who verified, when).

### 4.3 Boundaries

Payment Module:

- Does not manage order items.
- Does not manage shipping.
- Exposes payment status and proof summaries.

Order Module **subscribes** to payment state changes to move `order_status` from `pending_payment` to `processing` when payment is confirmed.

---

## 5. Shipping Module

### 5.1 Responsibilities

The Shipping Module is responsible for:

- Managing shipping addresses and options.
- Calculating shipping cost using JNT Cargo (or other carriers).
- Storing carrier choice and waybill (tracking number).
- Maintaining `shipping_status`, aligned with carrier data:
  - e.g., `awaiting_shipment`, `in_transit`, `delivered`.

### 5.2 Data Owned by Shipping Module

Examples:

- `shipping_addresses`
  - `id`
  - `order_id`
  - full address (province, city, district, detail),
  - contact phone.

- `shipments`
  - `id`
  - `order_id`
  - carrier code (e.g., JNT Cargo),
  - waybill/tracking number,
  - `shipping_cost`,
  - timestamps (created, picked, delivered).

- `shipping_status_logs`
  - `id`
  - `shipment_id`
  - status code (e.g., in_process, sorted, in_transit, delivered),
  - raw status from carrier,
  - timestamp.

### 5.3 Boundaries

Shipping Module:

- Does not decide whether an order is paid; it relies on Payment Module.
- Does not alter order items or line prices.
- Exposes:
  - shipping cost calculations,
  - shipping status changes.

Order Module listens to shipping status changes to update `order_status` (e.g., `shipped`, `delivered`).

---

## 6. Import Module

### 6.1 Responsibilities

The Import Module handles:

- Bulk upload and update workflows for catalog and inventory.
- Staging uploaded files and processing them asynchronously.
- Providing visibility into job progress and errors.

### 6.2 Data Owned by Import Module

Examples:

- `import_jobs`
  - `id`
  - module target (e.g., `catalog_products`, `catalog_variants`, `inventory_stock`),
  - file reference (path or blob ID),
  - status (`pending`, `running`, `completed`, `failed`),
  - counters (rows total, success, failed),
  - timestamps.

- `import_job_rows`
  - `id`
  - `import_job_id`
  - raw row data or key identifiers,
  - status (`success`, `failed`),
  - `error_reason` (if failed).

### 6.3 Boundaries

Import Module:

- Does not own products or variants; it passes validated data to Catalog Module.
- Does not own stock or prices; it invokes Catalog/Inventory APIs to update them.
- Exposes:
  - job list and details for admins,
  - correction files containing failed rows only.

Catalog and Inventory logic must be agnostic of whether data came from bulk import or single‑item edits.

---

## 7. Media Module

### 7.1 Responsibilities

The Media Module is responsible for:

- Downloading and storing media referenced in bulk import files or admin forms.
- Managing internal storage/CDN URLs.
- Providing consistent media access for frontend and admin UI.

### 7.2 Data Owned by Media Module

Examples:

- `media_files`
  - `id`
  - original source URL (Shopee template, Google Drive, etc.).
  - stored path/URL (`stored_url`),
  - media type (image, video),
  - size and metadata.

- `product_media`
  - `id`
  - product or variant association,
  - media_file_id,
  - ordering/index (Image 1–9).

### 7.3 Boundaries

Media Module:

- Does not manage product definitions itself.
- Does not decide pricing or stock.
- Exposes:
  - stable media URLs,
  - metadata needed for display.

Catalog and UI modules use Media Module outputs for rendering images/videos.

---

## 8. WhatsApp Module

### 8.1 Responsibilities

The WhatsApp Module is responsible for:

- Integrating with WhatsApp provider (Business API or gateway).
- Managing message templates for:
  - order creation,
  - payment instructions and confirmations,
  - shipping updates,
  - delivery confirmations,
  - feedback requests.
- Triggering messages based on system events (order/payment/shipping).
- Logging outgoing and, optionally, incoming messages.

### 8.2 Data Owned by WhatsApp Module

Examples:

- `whatsapp_templates`
  - `id`
  - name/key,
  - template body with variables (e.g., `{order_id}`, `{total}`, `{status}`),
  - type (transactional, notification).

- `whatsapp_messages`
  - `id`
  - `order_id` (optional but recommended),
  - direction (`outbound`, `inbound`),
  - phone number,
  - template_id (for outbound),
  - rendered message content,
  - delivery status (`queued`, `sent`, `delivered`, `failed`),
  - timestamps.

### 8.3 Boundaries

WhatsApp Module:

- Does **not** own order state; it only reflects it.
- Does not perform payment verification; it only delivers messages and receives potential proof references.
- Does not decide shipping actions; it only sends shipping updates.

Order, Payment, and Shipping Modules must emit events or call WhatsApp APIs to cause messages to be sent; WhatsApp Module does not alter business logic on its own.

---

## 9. Admin UI Module

### 9.1 Responsibilities

The Admin UI Module provides backend interfaces for Store Admins to operate:

- Catalog (products, variants, taxonomy, media links).
- Orders and statuses.
- Payments and payment proofs.
- Shipping and carrier data (e.g., JNT shipments).
- Import jobs (upload files, view job status, download corrections).
- WhatsApp templates and logs.

### 9.2 Boundaries

Admin UI Module:

- Does not own domain data; it uses APIs/services from other modules.
- Must respect module boundaries:
  - Catalog actions go through Catalog services.
  - Order actions go through Order services.
  - Payment actions go through Payment services.
  - Shipping actions go through Shipping services.
  - Import actions go through Import services.
  - WhatsApp actions go through WhatsApp services.

Admin UI should **not** directly touch database tables from multiple modules; it should rely on each module’s public API.

---

## 10. Public UI Module

### 10.1 Responsibilities

The Public UI Module serves Customers:

- Displays catalog (category, model, design, variants).
- Provides cart and checkout flows.
- Optionally displays basic order status tracking.

### 10.2 Boundaries

Public UI Module:

- Reads catalog data via Catalog Module.
- Creates and manages carts and orders via Order Module.
- Does not directly interact with imports, media processing internals, or WhatsApp logs.
- Should be kept simple and focused on customer experience.

---

## 11. Cross‑Module Interaction Rules

To keep the architecture clean:

1. **No direct cross‑module data access**  
   - Catalog data is changed only through Catalog APIs (bulk or single).  
   - Orders are changed only through Order APIs.  
   - Payments, Shipping, WhatsApp each have their own APIs/services.

2. **Events or service calls for coordination**  
   - When an order is created, the Order Module may notify WhatsApp Module to send a confirmation.  
   - When payment is confirmed, Payment Module updates payment status and calls Order Module to move `order_status` forward, and WhatsApp Module to notify the customer.  
   - When shipping status changes, Shipping Module updates its own state and informs Order Module and WhatsApp Module.

3. **Single source of truth per concern**  
   - Catalog is the source of truth for product definitions and base prices.  
   - Order is the source of truth for placed orders and their lifecycle.  
   - Payment is the source of truth for payment status.  
   - Shipping is the source of truth for shipping status.  
   - WhatsApp is the source of truth for messaging logs.

---

## 12. Agent Checklist

Before designing or coding any feature, agents must:

- [ ] Identify **which module** the feature belongs to (Catalog, Order, Payment, Shipping, Import, Media, WhatsApp, Admin UI, Public UI).  
- [ ] Ensure each module only handles its own responsibilities; do not mix concerns.  
- [ ] Use module APIs or services to interact across modules; do not bypass boundaries or touch foreign tables directly.  
- [ ] Keep Catalog as the source for product data and base prices; do not replicate product definitions in other modules.  
- [ ] Keep Order as the source for order lifecycle; do not store order status in other modules.  
- [ ] Use Import Module for all bulk operations; do not build ad‑hoc bulk logic inside Catalog or Inventory code.  
- [ ] Use Media Module for handling images/videos and serving URLs; do not hardcode file paths in Catalog or UI.  
- [ ] Use WhatsApp Module for all messaging; do not embed direct WhatsApp API calls in arbitrary modules.  
- [ ] Ensure Admin UI and Public UI are **frontends only**, calling domain modules rather than implementing business logic themselves.

Any code or design that violates these module boundaries is considered **misaligned** with the Ragil Aluminium architecture and must be refactored.
