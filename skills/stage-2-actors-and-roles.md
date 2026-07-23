# Skill: Stage 2 – System Actors & Roles in Ragil Aluminium

This document defines the **actors** and their **roles** in the Ragil Aluminium system, from the perspective of the website and its backend, not from traditional company hierarchy (owner, staff, etc.).  
All agents must treat this as a **role contract**: do not introduce new roles or permissions that conflict with this Stage 2 definition.

---

## 1. Overview of System Actors

The Ragil Aluminium system recognizes three primary actor types:

1. **Customer** – public website visitor who creates orders and communicates with the store, mainly through WhatsApp.  
2. **Store Admin** – all humans who operate the system on the backend (catalog, orders, warehouse, production, customer support).  
3. **System / Worker** – non‑human background processes that handle imports, media processing, shipping integration, and WhatsApp automation.

There is **no owner/superadmin role** with special technical powers.  
Every human with backend access is treated as a **Store Admin** with equal technical rights, and differences in responsibilities are handled by team SOP, not by complex permissions.

---

## 2. Customer

### 2.1 Definition

A Customer is a person who:

- Accesses the public Ragil Aluminium website.
- Browses the catalog and configures products/variants.
- Creates orders through the website checkout.
- Communicates with the store primarily via WhatsApp (notifications and manual chat).

The Customer never logs into the admin dashboard and has no backend rights.

### 2.2 Customer Rights (System Perspective)

From the system’s perspective, the Customer can:

- View the full catalog and available variants.
- Use cart and checkout to create an order.
- Receive automated messages via WhatsApp about their order (created, payment instructions, shipped, delivered, etc.).
- Send WhatsApp messages to the store (e.g., payment proof, questions, complaints).
- View order status summaries via a public interface, if provided (e.g., “track my order” page).

The Customer cannot:

- Change catalog data (products, variants, prices, stock, images).
- Directly change order status in the backend (they can only trigger system‑provided actions like “confirm received” when allowed).

### 2.3 Customer Actions on the Website

Typical Customer actions:

1. **Catalog navigation**
   - Choose `product_category` (WINDOW / DOOR / BOUVEN).
   - Choose `product_model` (e.g., JUNGKIT, SLIDING, SWING, FIXED, ZIGZAG).
   - Browse `design_variant` and other attributes (color, size, glass type, etc.).
   - View prices, photos, and basic specs.

2. **Cart & configuration**
   - Add products/variants to cart.
   - Adjust quantity per item.
   - Fill in name, shipping address, and primary WhatsApp number.

3. **Checkout & order creation**
   - Review cart contents and details.
   - Submit the order via the website.
   - Receive an order ID and summary stored in the system.

4. **WhatsApp interaction**
   - Receive auto messages when the order is created.
   - Receive payment instructions and send payment proof.
   - Receive updates for shipping and delivery.
   - Send questions or complaints.

---

## 3. Store Admin (Equal‑Admin)

### 3.1 Definition

“Store Admin” covers all humans operating the Ragil Aluminium backend:

- Catalog admins (manage products/variants).
- Order admins (monitor and update orders).
- Warehouse and production staff (fulfillment).
- Customer support (handles communication and issues).

All of them are treated as a **single role type**: Store Admin.

### 3.2 Equal‑Admin Principle

The equal‑admin principle means:

- All Store Admins have the same technical access level to core modules (catalog, orders, shipping, imports, WhatsApp settings), unless explicitly restricted at deployment level.
- There is no separate “owner” or “superadmin” role with extra exclusive features.
- Differences in responsibility (who handles catalog vs warehouse vs support) are handled via **team SOP**, not via per‑field permission systems.

This keeps the system simple and easier to operate by a small team.

### 3.3 Store Admin Capabilities

Store Admins can:

- Manage the full product catalog and variants.
- Add and update products via **bulk operations** and **single‑item forms**.
- Manage prices and stock (bulk and single).
- View and update order lifecycles.
- Manage shipping data and integrate with carriers (e.g., JNT Cargo).
- Configure WhatsApp templates and review WhatsApp logs.
- Trigger and monitor import jobs and media processing.
- Access operational logs (imports, WhatsApp, shipping).

They are the primary human operators of the system.

---

## 4. Store Admin – Catalog Management

### 4.1 Bulk Upload & Bulk Update (Fundamental)

Bulk operations are the **fundamental** way to manage the catalog at scale:

- Admin downloads or uses Shopee‑style Excel/CSV templates for:
  - product definitions (names, descriptions, categories, models),
  - variant definitions (color, size, glass type, etc.),
  - prices, stock, and media URLs.
- Admin fills or edits the file to:
  - add many products in one go,
  - add or modify many variants in one go,
  - change prices and stock en masse,
  - manage media references at scale.
- Admin uploads the file into the system via the import module.
- System/Worker:
  - reads the file,
  - validates each row,
  - writes or updates products and variants in the database,
  - logs successes and failures in `import_jobs` and `import_job_rows`.

Typical use cases:

- Initial catalog setup (large number of products).
- Synchronizing website catalog with Shopee.
- Seasonal or large price and stock changes.
- Large corrections after stock audits.

Bulk upload/update is the **primary operational tool** for catalog management.

### 4.2 Single Product & Variant Add/Edit (Mandatory)

Besides bulk operations, the system **must always provide** single‑item add/edit via the admin dashboard:

- Admin can add a single product via a form:
  - Set name and description.
  - Assign `product_category`, `product_model`, and `design_variant`.
  - Add variants one by one (color, size, glass type, etc.).
  - Set price and stock per variant.
  - Upload or link media for this product/variant.

- Admin can edit an existing product:
  - Adjust name or description.
  - Change category or model if needed.
  - Add or remove specific variants.
  - Change price and stock for a specific variant.
  - Fix media issues for one product/variant.

Single‑item operations are essential for:

- Quick corrections to a specific product or variant.
- Adding new products in small batches or experimental lines.
- Emergency fixes when bulk import templates are not yet prepared.

**Principle locked:**  
Bulk upload/update = fundamental for scale.  
Single add/edit = **mandatory** and cannot be removed.

### 4.3 Internal Taxonomy Management

Store Admins also maintain the internal taxonomy:

- Manage the list of `product_category` values relevant to Ragil Aluminium (WINDOW / DOOR / BOUVEN).
- Manage the list of `product_model` values (JUNGKIT, SLIDING, SWING, FIXED, ZIGZAG, etc.).
- Manage `design_variant` and other internal design attributes that drive UI and reporting.

This ensures:

- Customers can navigate the catalog easily.
- Bulk upload/update files stay consistent with the website’s internal structure.

---

## 5. Store Admin – Price & Stock Management

Store Admins manage price and stock in two ways:

1. **Bulk price/stock update**
   - Export current catalog or use a mass‑update template.
   - Edit prices and stock in Excel/CSV for many items.
   - Upload the updated file.
   - Review detected changes and errors.
   - Apply changes in bulk.

2. **Single price/stock edit**
   - Open a specific product/variant in the admin UI.
   - Directly change price and stock for that one variant or product.
   - Save changes immediately.

This dual approach allows:

- Efficient large‑scale changes.
- Fast small corrections without preparing files.

---

## 6. Store Admin – Orders & Statuses

### 6.1 Order Lifecycle Management

Store Admins manage the full order lifecycle:

- View orders in an admin list/grid.
- Filter by:
  - payment status (e.g., pending, paid, refunded),
  - shipping status (e.g., awaiting fulfillment, shipped, delivered),
  - order status (e.g., pending_payment, processing, completed, return_in_process).

They can update statuses at key points:

- `order_status` examples:
  - `pending_payment` – order created, awaiting payment confirmation.
  - `processing` / `awaiting_fulfillment` – payment confirmed, order waiting to be processed by warehouse/production.
  - `packing` – items are being packed.
  - `shipped` – order handed to carrier.
  - `delivered` – carrier reports delivery to destination.
  - `completed` – transaction finalized with no issues.
  - `issue` / `return_in_process` – order has problems or is in a return flow.

- `payment_status` examples:
  - `unpaid` – no validated payment proof.
  - `paid` – admin has verified payment.
  - `refunded` – money returned to customer.

Admin actions connect business events to system states:

- When payment_status becomes `paid`, order_status is usually moved from `pending_payment` to `processing`.
- When carrier reports delivery, order_status can be moved from `shipped` to `delivered`, and later to `completed` if no issues arise.

### 6.2 Coordination with Warehouse & Production

Warehouse and production staff, acting as Store Admins, use the same order module to:

- See orders in statuses that require fulfillment (processing/awaiting_fulfillment, packing, ready_to_ship).
- Mark:
  - when production starts and finishes,
  - when items are ready for packing,
  - when parcels are ready for pickup/shipping.
- Record issues that affect fulfillment (e.g., stock shortages, damaged items).

The system does not technically restrict which Store Admin can change which status; who does what is controlled by internal SOP.

---

## 7. Store Admin – WhatsApp

Store Admins manage WhatsApp usage as a communication layer:

- Configure message templates for:
  - order created,
  - payment instructions,
  - payment confirmed,
  - order shipped,
  - order delivered,
  - feedback or confirmation requests.
- Review WhatsApp logs:
  - timestamp of each message,
  - destination number,
  - message summary,
  - delivery status (success/failure).
- Optionally send manual messages in special cases:
  - clarifying specs or changes,
  - explaining delays or issues,
  - handling complex complaints.

WhatsApp is designed as:

- An automatic notification channel driven by order and payment events.
- A manual communication channel used by admins when necessary.

The **source of truth** for state remains the website; WhatsApp simply reflects and supports that state.

---

## 8. Store Admin – Imports, Media & Logs

Store Admins also oversee background operations:

- **Import jobs**
  - View `import_jobs` list with statuses (pending, running, completed, failed).
  - Inspect `import_job_rows` for row‑level success/failure and error reasons.
  - Download correction files that contain only failed rows plus an error column.
  - Re‑upload corrected files.

- **Media processing**
  - Ensure bulk upload files contain valid image/video URLs.
  - Monitor that workers successfully download and store media.
  - Fix issues when media fails to process.

- **System logs**
  - Use logs (imports, WhatsApp, shipping) to investigate issues.
  - Cross‑check events when something goes wrong (order state mismatch, missing notifications, etc.).

---

## 9. System / Worker

### 9.1 Definition

System / Worker is a non‑human actor that runs in the background:

- Executes heavy or repetitive tasks.
- Integrates with external services (Shopee files, storage, JNT Cargo, WhatsApp provider).
- Has no UI like a human; it operates via queues, schedules, and configurations.

Workers implement “mechanical” parts of the system design.

### 9.2 Worker Responsibilities

Key worker responsibilities:

- **Catalog & inventory import**
  - Read uploaded Excel/CSV files.
  - Validate and transform data.
  - Create or update products and variants.
  - Record job and row results.

- **Media processing**
  - Fetch images/videos from remote URLs.
  - Store them into internal media storage.
  - Update references (e.g., `stored_url`) for frontend usage.

- **WhatsApp automation**
  - Send messages based on triggers:
    - order creation,
    - payment confirmation,
    - shipping updates,
    - delivery confirmation.
  - Record delivery statuses in logs.

- **Shipping integration**
  - Communicate with carriers (e.g., JNT Cargo APIs).
  - Send shipment data (name, address, weight, etc.).
  - Retrieve tracking updates.
  - Update `shipping_status` in orders.

### 9.3 Transparency & Traceability

Worker actions must be transparent:

- Every significant operation has a job/log entry (import, WhatsApp, shipping).
- Errors are recorded with enough context (which file, which row, which order).
- Changes made by workers should be traceable to a job or event so admins can audit and debug.

---

## 10. Design Principles Locked by Stage 2

Stage 2 locks the following role‑related principles:

1. **Actor set is fixed** for this phase:
   - Customer,
   - Store Admin (equal‑admin),
   - System/Worker.
2. The website is the **central transaction engine** and source of truth for orders and statuses.
3. WhatsApp is a **notification + communication channel**, not a separate transaction engine.
4. All humans with backend access are **Store Admins with equal technical rights**; role separation is handled by SOP, not complex permission trees.
5. Catalog management is built around:
   - Bulk upload/update for large‑scale operations.
   - Single add/edit operations which are mandatory and cannot be removed.
6. Worker processes must be logged and traceable; they act as automation of admin tasks, not as opaque black boxes.

---

## 11. Agent Checklist

Before working on any module that touches users or permissions, agents must:

- [ ] Recognize **three** main actors: Customer, Store Admin, System/Worker.
- [ ] Understand that **Store Admin is equal‑admin**: same technical rights, different responsibilities via SOP.
- [ ] Know that Customers only use the **public website + WhatsApp**, never the admin dashboard.
- [ ] Design all order, payment, and shipping flows assuming the website is the transaction engine.
- [ ] Use WhatsApp strictly as a notification and communication layer, not as a primary data source.
- [ ] Implement catalog features with both **bulk** and **single‑item** operations; do not design a system that relies only on bulk.
- [ ] Ensure worker jobs (imports, media, WhatsApp, shipping) are always **logged and traceable**.
- [ ] Avoid introducing new technical roles (e.g., “superadmin with special features”) unless Stage 2 is explicitly updated.

Any module, permission system, or workflow that conflicts with this Stage 2 skill is considered misaligned with the Ragil Aluminium system design and must be revised.
