# Skill: Stage 10 – Public Store UI & Checkout Contract (Ragil Aluminium)

This document connects the **public store data & behaviour** to backend modules (Catalog, Order, Payment, Shipping, WhatsApp, CMS) defined in Stage 1–9.  
**Visual SoT:** `docs/DESIGN.md` Bagian A + `resources/views/public/partials/home-desktop.blade.php` + `docs/sitemap/public-*`.  
**Do not** use Next.js (`website_2.0/ui`) or legacy `public_store_ui_blueprint.md` as visual source of truth.

---

## 1. Beranda Publik (Homepage)

### 1.1 Data Sources

Sections mirror Home Desktop / DESIGN: hero, value propositions, category showcase, portofolio, testimonials, header/footer.

Beranda reads data from:

- **CMS / Pengaturan Website** (Stage 9A):
  - Hero text (headline, subheadline) and banner imagery.  
  - Value proposition copy (COD, garansi, kirim Nusantara).  
  - Portofolio photos & labels (Hasil Pemasangan).  
  - Testimonial cards (Apa Kata Pelanggan).  
  - Footer legal & contact info (Informasi Toko, Ketentuan Layanan, Kebijakan Privasi).  

- **Catalog Module** (Stage 3):
  - Showcase “Kategori Produk” (Casement, Sliding, Bouven) and possibly a few featured models.

### 1.2 Behaviour Contract

- **Dual CTA Buttons**:
  - “Pilih Model Produk”:
    - navigates to **Katalog Produk** route (e.g. `/produk`), pre-filtered to main categories or models.  
  - “Konsultasi WhatsApp”:
    - opens WhatsApp chat deep link using store business number, with a prefilled message template.  
    - message template is managed by WhatsApp Module templates (Stage 8).

- **Header Search Pill**:
  - dispatches a search query to Catalog Module:
    - filters products by name/model/category.  
    - redirects or updates Katalog Produk view with results.

- **Portofolio Gallery Carousel**:
  - uses CMS `cms_gallery_items` data (Stage 9A).  
  - clicking an image opens a lightbox; no backend state change required.

Error/loading/fallback behaviours (blur-up placeholder, SVG fallback) do not change contracts; they must still display CMS and catalog data when available.

---

## 2. Katalog Produk (Product Catalog)

### 2.1 Data Sources

DESIGN / public-wireframes define: sidebar filters, sort bar, grid of product cards, pagination.

Katalog reads from:

- **Catalog Module** (Stage 3):
  - `products` and aggregated `product_variants`.  
  - attributes for filtering: category (Window/Door/Bouven), model (Casement, Sliding, Bouven), price range, color, glass type, dimensions.  

- **Performance & Caching** (Stage 7):
  - query results should be cached (Redis) for common filters to keep UI responsive.

### 2.2 Filter & Sort Contract

Filter Sidebar:

- CategoryAccordionFilter:
  - maps to internal `product_category` and `product_model`.  
- PriceRangeRangeSlider:
  - filters min/max based on variant prices.  
- ColorCheckboxGroup:
  - filters by variant color attribute.  
- GlassTypeFilter:
  - filters by glass attribute.  
- DimensionCustomFilter:
  - filters by width/height attributes (either direct or via a size category).

SortAndResultCountBar:

- sorts by:
  - newest (created_at desc),  
  - most popular ( orders count or featured flag ),  
  - lowest price,  
  - highest price.

### 2.3 Product Card Behaviour

Each `ProductGridCard` must:

- show:
  - thumbnail (from Media Module, `stored_url`).  
  - title/model.  
  - starting price (min variant price).  
  - discount badge if applicable (promo data from Harga & Promo module).  

- behaviours:
  - hover reveals “Detail Produk” and slight zoom effect (frontend only).  
  - click “Detail Produk” or card → navigate to **Detail Produk** route with product ID/slug.  
  - Quick View (if enabled) uses an API to fetch product details + variants in a lightweight modal, but does not create orders; it only prepares data.

Empty/Loading/Error states must still call catalog APIs; they change only presentation.

---

## 3. Detail Produk (Product Details)

### 3.1 Data Sources

Layout (DESIGN / wireframes): split-screen layout gaya Zalora — galeri grid 2 kolom di kiri (semua foto langsung tampil, mengikuti varian terpilih), buy box sticky di kanan (header subtitle + pill rating, nama produk, harga + harga coret + chip diskon + Flash sale dari metadata promo, pemilih variasi/ukuran pill, CTA merah + quantity, box Pengiriman, 3 kartu benefit, accordion Informasi produk / Tentang produk, blok Penilaian & ulasan). Metadata promo PDP memakai `ProductPromotionMetadata::forProduct` (prop Inertia `promo`), sama dengan product card.

Detail page reads from:

- **Catalog Module**:
  - main product record.  
  - list of `product_variants` with attributes (color, glass type, dimensions, price, stock).  
  - detailed description/specs.  

- **Media Module**:
  - product media gallery (images/videos).
  - Gallery follows selected variant / warna via `product_media.product_variant_id` (dedicated variant images first; fallback: product-level media where `product_variant_id` is null).

- **CMS & Reviews**:
  - video tutorial or content from CMS.  
  - customer reviews from Ulasan module.

### 3.2 Variant & Price Behaviour

Configurators:

- Selecting options (Warna Kusen, Jenis Kaca, Dimensi Ukuran) must:
  - map to specific `product_variant` record.  
  - update displayed price to variant’s unit price.  
  - check stock availability.

- Buttons:

  - “Tambah ke Keranjang”:
    - calls Public UI → Order Module to add chosen variant to cart (Stage 4).  
    - if variant unavailable (stock 0), show appropriate UI message; do not create cart item.

  - “Beli sekarang”:
    - adds the chosen variant and quantity through the same cart action.
    - continues directly to the existing checkout page after the cart update succeeds.
    - does not preselect COD or create a separate order path; payment remains a checkout decision.

### 3.3 Tabs Below

- Spesifikasi teknis:
  - reads from product attributes/specs stored in Catalog Module or CMS.  
- Video:
  - content from CMS / a media URL.  
- Ulasan:
  - reads from Ulasan module (`cms_testimonials`), filtered by `product_id` (published only).
  - Ulasan boleh berasal dari entri manual (Shopee / WhatsApp / website); admin menautkan ke produk terkait.
  - Bukan digabung ke galeri hasil pemasangan; halaman `/reviews` menampilkan semua published (umum + tertaut produk).

UI tabs do not change backend state; they only display different slices of existing data.

---

## 4. Cart / Keranjang

### 4.1 Data Sources & Storage

Cart is the pre-order stage:

- Uses **Order Module** cart structure:
  - per session or per customer.  
  - each item references `product_variant_id`, quantity, price snapshot.

- State:
  - stored server-side (session, DB) or client-side (tokenized) but must map to backend cart entity before checkout.

### 4.2 Behaviour Contract

Cart page must:

- display list of items:
  - product name & variant attributes.  
  - price per unit & subtotal.  
  - quantity control (increment/decrement, with min 1 and stock-aware max).  
- maintain totals:
  - sum of line items, pre-shipping.

Validations:

- quantity changes must:
  - call backend to update cart.  
  - enforce stock limits (cannot exceed available stock).  

Actions:

- remove item → removes from cart entity.  
- “Lanjut ke Checkout”:
  - moves user to Checkout page, carrying cart ID/state.

Empty state:

- if no items, show message + CTA back to Katalog.

---

## 5. Checkout

### 5.1 Data Sources

Checkout forms gather data required for order creation:

- Customer details:
  - name, phone (WhatsApp), email (optional).  
  - shipping address: **pilih** province → city/kabupaten → district (kecamatan) → village (desa/kelurahan) dari data wilayah lokal; **isi manual** address detail (`address_line1`), patokan (`address_line2`, opsional), dan kode pos.  

- Order summary:
  - cart items and prices.  

- Payment method:
  - public checkout: bank transfer / COD only (mapping to Payment Module).  
  - permintaan metode lain dari pelanggan diproses manual admin via WhatsApp (bukan opsi form).

Checkout uses:

- **Order Module**:
  - to create `order` from cart, with snapshot of items and customer details (including `shipping_district` / `shipping_village`).  

- **Wilayah API** (`GET /api/wilayah/*`):
  - cascading options for province / regency / district / village (searchable via `?q=`).  

- **Shipping Module**:
  - to estimate shipping cost and store address.  

- **Payment Module**:
  - to create initial `payment` record with status `unpaid`.

### 5.2 Behaviour Contract

Form fields:

- must be validated on:
  - required presence (name, WhatsApp, province, city, district, village, address_line1, postal_code).  
  - format (phone number, postal codes if used).  
  - wilayah names must come from the cascaded selectors (not free-typed for province/city/district/village).  
  - restrictions (only shipping areas supported).

On “Buat Pesanan” / “Konfirmasi Pesanan”:

- backend must:
  - create `order` entity as per Stage 4:  
    - `order_status = pending_payment`  
    - `payment_status = unpaid`  
    - `shipping_status = awaiting_shipment` (or equivalent initial)  
  - create `payment` record (Payment Module).  
  - create `shipping` record with address (Shipping Module).  

- WhatsApp Module:
  - triggered with event `order_created` to send order summary & payment instructions to provided WhatsApp number (Stage 4 & 8).

Error handling:

- if order creation fails:
  - show error state and avoid duplicate order creation.  
- if WA send fails:
  - record failure; order is still valid; UI may show non-blocking note.

---

## 6. Pelacakan Pesanan (Order Tracking)

### 6.1 Data Sources

Tracking page (if present) allows customers to see status of their order:

- uses **Order Module**:
  - to find order based on:
    - order code (#RA-000001) and WhatsApp number, or  
    - token generated at checkout.  

- uses **Shipping Module**:
  - to show shipping status and tracking events.

### 6.2 Behaviour Contract

UI must:

- treat **Pesanan** as the entry point (header icon beside cart; mobile nav “Pesanan”).  
  **Status pengiriman** is a section *inside* that page after an order is available — not a separate top-level nav item.
- **Session first (no login):** if the browser still has temporary `confirmed_orders` from checkout, open those orders automatically (with J&T refresh when a waybill exists). Do **not** show the lookup form.
- **Lookup form only as fallback** when session/cache is empty (data sementara hilang):
  - order ID + WhatsApp/phone or email.  
- on successful guest lookup:
  - refresh J&T Cargo track for the order’s waybill when present, then show updated `shipping_status`;
  - re-seed `confirmed_orders` so subsequent visits on the same browser skip the form.
- display:

  - summary:
    - product list (compact).  
    - payment status.  

  - status timeline:
    - same major steps as internal timeline (pending_payment, processing, shipped, delivered, completed, issue/return).  

  - shipping tracking:
    - current shipping status (in transit, delivered).  
    - tracking number and link to carrier if available.

Security:

- do not expose other customers’ orders.  
- require matching phone/email (or active session order numbers from this browser’s checkout) to access tracking data.

---

## 7. Integration with CMS & Legal Pages

Public store views for:

- Testimoni, Hasil Pemasangan, Cara Pemesanan, Informasi Toko, Ketentuan Layanan, Kebijakan Privasi, etc., must:

- read from CMS `cms_pages` & child tables (Stage 9A).  
- not hardcode text; admin edits propagate to public pages.

Beranda sections for portofolio & testimoni already follow this; other dedicated pages must follow same data contracts.

---

## 8. WhatsApp Integration in Public UI

WhatsApp actions in public UI include:

- “Konsultasi WhatsApp” from homepage.  
- Buttons in product detail (e.g., “Konsultasi ukuran”, “Tanya harga”).

Contract:

- All WhatsApp links must use WhatsApp Module configuration (Stage 8):
  - phone number from `.env` / config.  
  - prefilled message templates defined in `whatsapp_templates`.  

Frontend must not embed hardcoded numbers or random messages; it must call backend or configuration for consistency.

---

## 9. Performance & Security Considerations

Public store must respect Stage 7:

- Catalog queries:
  - indexed & paginated; no “load all products” on catalog pages.  
  - use cache for common filter/sort combos.  

- Checkout:
  - validated inputs, anti-abuse.  
  - rate limiting for order creation & order tracking endpoints.  

- HTTPS & CORS:
  - all public API calls via HTTPS.  
  - only allowed origins (store domain).

---

## 10. Agent Checklist

Before implementing or modifying public store UI or checkout, agents must:

- [ ] Treat `docs/DESIGN.md` + Home Desktop partial + `docs/sitemap/public-*` as visual source of truth; do not alter layout or menu without explicit design updates.  
- [ ] Wire Beranda Publik sections to CMS (hero, portofolio, testimoni, legal texts) and Catalog (kategori & showcase) so admin edits appear correctly.  
- [ ] Implement Katalog Produk filters & sorting as views over Catalog Module data, with proper indexing and caching to keep grid responsive.  
- [ ] Make Detail Produk variant selection drive actual `product_variant` choices and price updates, enforcing stock constraints.  
- [ ] Ensure Cart operations (add/update/remove) map to Order Module cart structures and maintain correct totals.  
- [ ] Ensure Checkout creates orders as per Stage 4 (pending_payment + payment/shipping records) and triggers WhatsApp `order_created` messages.  
- [ ] Implement Order Tracking so customers can safely view their order & shipping status based on order code + phone or secure token, without leaking other orders.  
- [ ] Use WhatsApp Module configuration for all public WhatsApp CTAs; no hardcoded numbers or message texts outside that module.  
- [ ] Apply performance & security practices from Stage 7 (pagination, caching, rate limits, HTTPS) to public APIs and interactions.  

Any public store implementation that diverges from this Stage 10 contract or from DESIGN must be reviewed and aligned before deployment.
