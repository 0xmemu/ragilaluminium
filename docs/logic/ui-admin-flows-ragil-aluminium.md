# Admin UI Flows – Ragil Aluminium Website

This document describes the **admin UI structure and flows** for the Ragil Aluminium website.  
It connects Stage 9a/9b UI contracts with the underlying modules and data model, so agents can design and implement the admin interface consistently.

Admin UI must always:

- Reflect the domain model defined in Stage 1–8.  
- Use the Brandkit & Design Tokens for styling.  
- Avoid introducing new business logic; it should surface and control existing modules.

---

## 1. Global Structure & Navigation

### 1.1 Admin Entry Point

- Admin base URL: `/admin` (or similar).  
- Default landing page: **Dashboard / Beranda**.  
- Authentication:
  - Only `users` with appropriate roles (super_admin, admin, staff, viewer, etc.) can access.  
  - Role definitions follow Stage 2 (Actors & Roles).

### 1.2 Sidebar Layout

The sidebar is **tree‑based** and grouped by functional area:

1. **Dashboard**
   - `Beranda` (Main admin dashboard).

2. **Catalog**
   - `Products` – Parent products and variants.  
   - `Attributes` – Product attributes and taxonomies.  
   - `Media` – Product media manager.

3. **Imports**
   - `Import Jobs` – Overview of Shopee & internal import jobs.  
   - `Failed Rows` – Focused view for errors and correction.

4. **Orders & Payments**
   - `Orders` – Order list & detail.  
   - `Payments` – Payment records.

5. **Shipping**
   - `Shipping Records` – Waybills, statuses, carriers.

6. **WhatsApp**
   - `Templates` – WhatsApp template configuration.  
   - `Messages` – Message logs (inbound/outbound).

7. **Analytics & Performance**
   - `Store Performance` – metrics, charts.  
   - `Import Performance` – job stats, error rates.

8. **CMS / Content**
   - `Pages` – informational pages (About, FAQ, etc.).  
   - `Banners` / `Promo` – homepage hero, promo blocks.

9. **Settings**
   - `Users` – admin/staff management.  
   - `System Settings` – environment, integration keys, basic configs.

Each section/page described below must be reachable from this sidebar.

---

## 2. Dashboard / Beranda

### 2.1 Purpose

The Dashboard is the **main snapshot** of:

- Order pipeline health.  
- Store performance (sales, conversions, top products).  
- Operational alerts (imports, media, WhatsApp, shipping issues).

### 2.2 Layout

Recommended layout:

1. **Top KPIs row**
   - Cards showing:
     - Today’s orders count & total value.  
     - Orders pending payment / pending processing.  
     - Orders in transit / delivered.  
     - Today’s revenue vs recent average.

2. **Order Pipeline Overview**
   - Funnel or stacked bar:
     - pending_payment → processing → shipped → delivered → completed → issue/return.  
   - Clicking a segment takes admin to filtered `Orders` list.

3. **Store Performance Snapshot**
   - Chart(s):
     - Sales over last 7/30 days.  
     - Top categories/models (WINDOW/DOOR/BOUVEN, JUNGKIT, SLIDING, etc.).  
   - Link to detailed `Store Performance` page.

4. **Operational Alerts / “Needs Attention”**
   - Panels or list widgets:
     - Import jobs with high failure rate.  
     - Media records with `status = failed`.  
     - Orders with `order_status = issue` or `return_in_process`.  
     - WhatsApp messages with `status = failed` or unusual error counts.

5. **Shortcuts**
   - Buttons:
     - “Add Product” (goes to Products > Create).  
     - “Start Shopee Import” (goes to Import Jobs > New).  
     - “View Orders Pending Payment” (goes to Orders filtered).

### 2.3 Data Sources

Dashboard aggregates data from:

- `orders`, `order_items`, `payments`, `shipping_records`.  
- `products`, `product_variants`, internal taxonomy.  
- `import_jobs`, `import_job_rows`.  
- `product_media`.  
- `whatsapp_messages`.  
- Optionally `performance_metrics`.

---

## 3. Catalog – Products, Attributes, Media

### 3.1 Products List Page

#### Purpose

Manage catalog at product (parent SKU) level: view, search, filter, edit, archive.

#### Layout

- **Filters/search**:
  - `parent_sku`, product name.  
  - `product_category` (WINDOW/DOOR/BOUVEN).  
  - `product_model` (JUNGKIT, SLIDING, etc.).  
  - `design_variant`.  
  - `status` (active, inactive, archived, draft).

- **Table columns**:
  - Parent SKU.  
  - Name.  
  - Category / Model / Design.  
  - Status.  
  - Number of variants.  
  - Last updated at / updated by.

- **Row actions**:
  - View detail.  
  - Edit product.  
  - Manage variants.  
  - Archive / Unarchive.  
  - Quick view of main image.

#### Detail Page

- Tabs:

  1. **Overview**  
     - Basic info: name, description, taxonomy, status.  

  2. **Variants**  
     - Table of `product_variants` linked to this product.  

  3. **Attributes**  
     - Attributes for product and variants.  

  4. **Media**  
     - All media records for the product/variants.

### 3.2 Variants Management

Variants are managed from:

- Product detail > Variants tab.  
- Optional dedicated `Variants` page.

Key features:

- Create/edit/delete variants (with strict rules for deletion; archiving preferred).  
- Edit price, stock, weight and dimension fields.  
- Assign variation names/options (Color, Size, etc.).  
- Bulk update via imports (with indication when a variant is controlled by import pipeline).

### 3.3 Attributes Management

Attributes:

- Usually edited from product/variant detail pages.  
- Optionally a global `Attributes` admin view for filtering by attribute name/value.

Use cases:

- Manage attributes like material, glass type, frame thickness.  
- See which products/variants have certain attributes for reporting or SEO.

### 3.4 Media Manager

Media page:

- **Filters**:
  - product/category/model.  
  - `status` (pending, downloading, downloaded, failed).  
  - `visibility` (visible, archived).  

- **Listing**:
  - Thumbnail preview.  
  - Product and variant linkage.  
  - Position and main image flag.  
  - Status and error reason.

- **Actions**:
  - Set `is_main_image`.  
  - Archive/unarchive media.  
  - Trigger re‑download if `status = failed`.  
  - Replace image via upload.

---

## 4. Imports – Jobs & Failed Rows

### 4.1 Import Jobs List

#### Purpose

Monitor all bulk imports and updates (Shopee, internal).

#### Layout

- Filters:
  - `type` (mass upload/mass update/internal).  
  - `status` (pending, running, completed, failed).  
  - date range.  
  - triggered by.

- Table columns:
  - Job ID.  
  - Type.  
  - Source file name.  
  - Status.  
  - Rows: total / processed / success / failed.  
  - Started at / completed at.  
  - Triggered by.

- Actions:
  - View detail.  
  - Download original file.  
  - Download correction file (only failed rows).  
  - Re‑run job (with safeguards).  

### 4.2 Import Job Detail

Sections:

1. **Job summary**  
   - Basic metadata and status.  

2. **Row statistics**  
   - Pie/bar: success vs failed vs pending.  

3. **Failed rows table**  
   - row_number.  
   - raw data snippet.  
   - error reason.  
   - linked product/variant.

4. **Correction file download**  
   - Link to Excel with failed rows and reasons.

5. **Linked media**  
   - Summary of media records created/updated by this job.

---

## 5. Orders & Payments

### 5.1 Orders List Page

#### Purpose

Provide a clear view of order pipeline, allow filtering and bulk actions.

#### Layout

- Filters:
  - order_number.  
  - customer phone/name.  
  - `order_status`, `payment_status`, `shipping_status`.  
  - date range (created_at).  
  - payment method (COD/transfer/etc.).

- Table columns:
  - Order number.  
  - Customer name & phone.  
  - Status trio (order/payment/shipping).  
  - Total amount.  
  - Created at.  
  - Last update.

- Row actions:
  - View order detail.  
  - Update status (with allowed transitions).  
  - Open WhatsApp message history.  
  - Open shipping record.

### 5.2 Order Detail Page

Sections:

1. **Order summary**  
   - Order number, statuses, amounts, payment method.  

2. **Customer & shipping info**  
   - Address details, contact info.  

3. **Items**  
   - Table of `order_items` with SKUs, names, variations, quantity, prices.  

4. **Payments**  
   - List of payment records.  
   - Attach/view payment evidence.  
   - Actions: mark as paid, mark as refunded (subject to workflow rules).

5. **Shipping**  
   - Waybill, carrier, status.  
   - Link to tracking.  
   - History of status updates.

6. **WhatsApp Logs**  
   - Messages linked to `order_id`.  
   - Template keys, statuses, timestamps.  
   - Ability to send manual follow‑up (respecting WhatsApp rules).

7. **Events/History**  
   - Timeline from `event_logs`: status changes, important operations.

---

## 6. Shipping – Records & Tracking

### 6.1 Shipping Records Page

- Filters:
  - waybill number.  
  - carrier.  
  - status.  
  - date range.

- Table:
  - Waybill number.  
  - Order number.  
  - Carrier & service.  
  - Shipping cost.  
  - Current status & last update.  

- Actions:
  - View shipping detail.  
  - Refresh status (trigger API check).  

### 6.2 Shipping Detail

- Shows:
  - Basic metadata.  
  - Status timeline.  
  - Links to JNT or carrier tracking.  
  - Association with order detail.

---

## 7. WhatsApp – Templates & Messages

### 7.1 WhatsApp Templates Page

#### Purpose

Configure which templates are used for which events.

- Listing:
  - internal_key.  
  - provider_template_name.  
  - language_code.  
  - category (transactional/marketing/otp).  
  - status.  

- Actions:
  - Activate/deactivate templates.  
  - Edit mapping (internal key → provider template name).  
  - View description and guidance for each template.

### 7.2 WhatsApp Messages Page

#### Purpose

Monitor WhatsApp traffic and troubleshoot issues.

- Filters:
  - direction (outbound/inbound).  
  - status.  
  - order_id.  
  - phone_number.  
  - date range.

- Table:
  - Direction.  
  - Order number (if any).  
  - Phone number.  
  - Template key (for outbound).  
  - Status.  
  - Sent/received timestamps.

- Row actions:
  - View message detail (payload, raw JSON).  
  - Open linked order.  
  - Tag issues (e.g. for follow‑up).

---

## 8. Analytics & CMS

### 8.1 Store Performance Page

- Charts and tables:
  - Sales by day/week/month.  
  - Top categories/models/designs.  
  - Conversion rates (visits → orders).  

- Filters:
  - date range.  
  - category/model.

### 8.2 Import Performance Page

- Stats:
  - Number of jobs per period.  
  - Failure rate (rows and jobs).  
  - Impact on catalog.

### 8.3 CMS / Content Pages

- Manage:
  - Static pages (About, FAQ, contact).  
  - Banners & promos for homepage and key sections.

---

## 9. Settings – Users & System

### 9.1 Users Page

- Manage admin/staff accounts.  
- Roles and access levels must reflect Stage 2.  
- Actions:
  - Create/edit users.  
  - Activate/deactivate accounts.

### 9.2 System Settings

- Configuration for:
  - WhatsApp provider keys and options.  
  - Shopee import configurations (file location, template references).  
  - Shipping provider settings.

---

## 10. Agent Checklist for Admin UI

When designing or modifying Admin UI, agents must:

- Map every admin page and action to existing modules and tables; do not invent new business flows in UI alone.  
- Use sidebar structure as the primary navigation, keeping functional groups clear (Dashboard, Catalog, Imports, Orders, Shipping, WhatsApp, Analytics, CMS, Settings).  
- Ensure Dashboard/ Beranda surfaces both transaction and operational health (orders, performance, imports, media, WhatsApp, shipping).  
- Support archive flows for catalog via `status` flags (e.g. archived) and visibility flags for media.  
- Avoid actions that silently delete data; admin actions should log changes via events or status updates.  
- Respect WhatsApp messaging rules (templates, opt‑in, rate limits) and expose enough UI to troubleshoot messaging issues.  
- Keep admin UI consistent with Brandkit & Design Tokens for styling, without changing underlying data contracts.  
- Update this flow document if major changes to navigation or page responsibilities are introduced.

---
