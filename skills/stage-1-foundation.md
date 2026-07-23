# Skill: Stage 1 – Business Foundation & System Scope for Ragil Aluminium

This document defines the business foundation and system scope for the Ragil Aluminium website (initial focus on windows/doors/bouven), as a core skill that **must be understood** by all agents before designing any module, database, or UI.

Any agent working on this project must treat this document as a **context contract**: do not design features that conflict with Stage 1.

---

## 1. Business Scope & Product Focus

### 1.1 Product focus

In its initial phase, the Ragil Aluminium website only handles **main aluminium products**:

- **Windows** (WINDOW).
- **Doors** (DOOR).
- **Bouven** (BOUVEN) – top‑mounted window above a door or main window.

Interior items and accessories are **outside the initial scope**.  
If they are added later, this will be done by adding categories and models to the internal taxonomy, **without changing the core structure**.

### 1.2 Internal product taxonomy

To keep the catalog easy to navigate and scalable, every product uses 3 layers of internal taxonomy:

- `product_category` – high‑level category:
  - `WINDOW` – Window.
  - `DOOR` – Door.
  - `BOUVEN` – Bouven.

- `product_model` – model/type within the category:
  - For `WINDOW`:
    - `JUNGKIT` – Awning / tilting window.
    - `SLIDING` – Sliding window.
    - `SWING` – Swing / casement window.
    - `FIXED` – Fixed / non‑opening glass.
    - `ZIGZAG` – Zigzag / folding window.
  - For `DOOR`:
    - `SWING` – Swing door.
    - `SLIDING` – Sliding door.
  - For `BOUVEN`:
    - `JUNGKIT` – Bouven tilting.
    - `SLIDING` – Bouven sliding.
    - `SWING` – Bouven swing.
    - `ZIGZAG` – Bouven zigzag.

- `design_variant` – design layer:
  - `PLAIN` – Plain.
  - `ORNAMENT` – With ornaments.
  - `COMBINATION` – Combination (active leaf + fixed leaf, etc.).
  - `SERIES_A`, `SERIES_B`, `SERIES_C` – Design series A/B/C (especially for doors/windows).

**Important for agents:**

- This taxonomy is **internal to the website**, not the official Shopee structure.
- Do not use `product_category` / `product_model` / `design_variant` to form official SKUs.
- Use this taxonomy for:
  - navigation menus,
  - catalog filters,
  - reporting groups (per category, per model, per design).

---

## 2. Channels Involved in the Ecosystem

The Ragil Aluminium website is part of an ecosystem that involves several channels:

1. **Website**
   - Product catalog.
   - Cart & checkout.
   - Orders & statuses.
   - Admin dashboard (product management, orders, imports, etc.).

2. **Shopee**
   - Source of product data format:
     - *Mass Upload* and *Mass Update* templates.
     - Item + variant structure (2‑tier variation).
   - Source of official SKUs:
     - `parent_sku` for parent products.
     - `variant_sku` for each variant.
   - Source of `category_id` and category attributes.

3. **WhatsApp**
   - Automatic notification channel:
     - order created,
     - payment received,
     - shipping status (shipped, delivered),
     - completion or complaints.
   - Manual communication channel:
     - payment proof (photos/text),
     - customer confirmations,
     - complaints & return process.
   - Important conversations are documented and linked to orders in the admin website (WhatsApp log per order).

4. **JNT Cargo**
   - Shipping cost calculation.
   - Waybill creation and tracking.
   - Official source of shipping status:
     - picked up, in process/sorting, in transit, delivered, etc.
   - Synchronization of shipping status into `shipping_status` in the website.

5. **Database & Media Storage**
   - Stores structured data:
     - products (`products`),
     - variants (`product_variants`),
     - attributes (`product_attributes`),
     - media (`product_media`),
     - import staging (`import_jobs`, `import_job_rows`).
   - Manages media:
     - reads image URLs from Shopee files,
     - downloads and stores them in internal storage/CDN,
     - exposes final URLs (`stored_url`) for the frontend.

**Important for agents:**

- The website **does not live alone**; it sits at the center of other channels (Shopee, WhatsApp, JNT, DB/Media).
- Every module must consider integration with at least:
  - Shopee (format & SKUs),
  - WhatsApp (notifications),
  - JNT (shipping),
  - database/media (data & image storage).

---

## 3. Role of the Website in the Ecosystem

Stage 1 locks the model:

> Website = full transaction engine, WhatsApp = notification & communication channel.

### 3.1 Website

The Ragil Aluminium website acts as:

- **Transaction engine**:
  - Creates orders from the cart.
  - Stores orders and line items (products/variants, prices, shipping cost).
  - Maintains statuses:
    - `order_status`: pending_payment → processing → shipped → delivered → completed → issue/return.
    - `payment_status`: pending → paid.
    - `shipping_status`: follows JNT updates.
- **Main catalog**:
  - Displays categories, models, variants.
  - Displays prices, stock, and images.
- **System of record**:
  - Logs every status change and important events (including WhatsApp notifications and JNT updates).

The website is the **source of truth** for orders and their states.

### 3.2 WhatsApp

WhatsApp is **not a place to create orders**, but:

- **Communication funnel** after the order is created in the website:
  - Sends:
    - order summary (#order_id, items, total),
    - payment instructions,
    - shipping status,
    - confirmation requests after delivery.
  - Receives:
    - payment proofs,
    - confirmations,
    - complaints/returns.
- All important conversations are linked back to the corresponding order in the website.

WhatsApp is a **notification and communication layer**, not the transactional brain.

### 3.3 JNT Cargo

JNT Cargo is the **authority for shipping status**:

- The website reads official shipping statuses from JNT APIs or tracking.
- `shipping_status` in the website mirrors JNT’s timeline.
- WhatsApp sends automated shipping updates based on changes in the website.

### 3.4 Shopee

Shopee provides:

- Template formats for mass upload/mass update operations.
- Official SKUs and 2‑tier variant structures that the website follows.
- `category_id` and per‑category attributes.

The website **does not invent a new Excel format**.  
Instead, it **reads Shopee templates as the primary source** for:

- adding products,
- updating products,
- updating prices and stock.

---

## 4. Data Scale & Complexity

The Ragil Aluminium system must handle:

- **Products & SKUs**:
  - Tens of thousands of products.
  - Tens of thousands of variants.
  - Variant structures follow Shopee limits:
    - maximum 2 variation tiers (e.g., Color & Size),
    - total variants per item ≤ 50.

- **Media**:
  - Hundreds of thousands of media links (Image URL 1–9 from Shopee templates).
  - Background processes that download and store images.

- **Orders & statuses**:
  - Daily order volume with frequent status changes.
  - Need for structured status and notification logs.

**Important for agents:**

- Architecture (database, queues, caching) must be realistic for this scale.
- Import & media pipelines must be asynchronous and chunked (not blocking HTTP).

---

## 5. Locked Product Data Principles

### 5.1 SKU & product format

- The website **follows Shopee’s SKU and data structure**:
  - `parent_sku` (parent/primary SKU),
  - `variant_sku` (variant SKU),
  - `category_id`,
  - `variation_1_name` / `variation_1_option`,
  - `variation_2_name` / `variation_2_option`,
  - price, stock, weight, dimensions, media.

- There is **no second internal SKU system** with a different format:
  - Agents are forbidden from inventing another SKU scheme for internal use.

Shopee SKUs are the **one and only official SKU reference**.

### 5.2 Internal taxonomy

Internal taxonomy:

- `product_category` (WINDOW / DOOR / BOUVEN),
- `product_model` (JUNGKIT / SLIDING / SWING / FIXED / ZIGZAG),
- `design_variant` (PLAIN / ORNAMENT / COMBINATION / SERIES_A/B/C).

Used for:

- catalog navigation,
- filters,
- reporting groups.

Not sent to Shopee and does not affect official SKUs.

### 5.3 Mass upload/update pipeline

- The website accepts Shopee Excel/CSV files **as‑is**.
- Pipeline:
  - store file,
  - create job record,
  - process asynchronously,
  - allow partial success.
- `import_jobs` and `import_job_rows` log progress and errors.
- Correction files contain only failed rows plus an `Error Reason` column.

Agents must design around this pipeline, not replace it.

---

## 6. Agent Checklist

Before working on any module, agents must:

- [ ] Understand that initial products = Windows, Doors, Bouven (interior/accessories are out of initial scope).
- [ ] Understand the internal taxonomy: `product_category`, `product_model`, `design_variant`.
- [ ] Understand the roles of each channel: Website, Shopee, WhatsApp, JNT, Database/Media.
- [ ] Understand that the website is the **transaction engine**, WhatsApp is for **notifications & communication**.
- [ ] Know that the official SKU = Shopee SKU; do not design a second SKU format.
- [ ] Know that Shopee Excel/CSV templates are the **primary operational format** for import/update.

Agents who do not follow this Stage 1 skill risk designing modules that are hard to integrate or conflict with the foundational design of the Ragil Aluminium system.
