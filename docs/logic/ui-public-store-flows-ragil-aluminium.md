# Public Store UI Flows – Ragil Aluminium Website

This document describes the **public store UI structure and flows** for the Ragil Aluminium website.  
It connects Stage 10 (Public Store UI & Checkout Contract) with the underlying modules and data model, so the storefront can be implemented consistently.

Public store UI must:

- Reflect the product taxonomy (WINDOW/DOOR/BOUVEN, models, design variants).  
- Use Shopee‑aligned catalog and media from the backend.  
- Provide a clear, frictionless path from browsing → cart → checkout → order confirmation.

---

## 1. Global Structure & Navigation

### 1.1 Main Entry Points

The public store has several main entry points:

- **Homepage**  
  - Hero section (brand messaging, primary CTA).  
  - Featured categories (Window, Door, Bouven).  
  - Featured products / promos.  

- **Category pages**  
  - Window, Door, Bouven views.  

- **Model/series filters**  
  - JUNGKIT, SLIDING, SWING, FIXED, ZIGZAG, etc.  
  - Design variants (PLAIN, ORNAMENT, COMBINATION, SERIES_A/B/C).

- **Search**  
  - Keyword search across product names, SKUs, attributes.

- **Cart & Checkout**  
  - Cart overview.  
  - Checkout flow (address, shipping, payment, confirmation).

### 1.2 Top Navigation & Footer

- Top navigation:
  - Logo → Homepage.  
  - Catalog menu (Windows, Doors, Bouven).  
  - Search bar.  
  - Cart icon with item count.  

- Footer:
  - Links to static pages (About, FAQ, contact, policies).  
  - Contact information.  
  - Optional trust signals (certifications, payment badges).

---

## 2. Homepage Flow

### 2.1 Purpose

The homepage introduces Ragil Aluminium and quickly directs visitors to:

- Browse relevant product categories.  
- See key value propositions (durability, design, custom sizing).  
- Engage with promos or featured collections.

### 2.2 Layout

Suggested sections:

1. **Hero section**
   - Background visual (sample window/door installation).  
   - Headline: value proposition (e.g. premium aluminium windows & doors).  
   - Primary CTA buttons:
     - “Browse Windows”.  
     - “Browse Doors”.

2. **Category highlights**
   - Three cards:
     - Window.  
     - Door.  
     - Bouven.
   - Each card links to respective category page and shows short text.

3. **Featured models/series**
   - Carousels or grids:
     - e.g. Sliding Windows, Swing Doors, Bouven Jungkit.  
     - Each item shows main image, name, price range, and CTA to product detail.

4. **Benefits section**
   - Icons/text for benefits:
     - Weather resistance.  
     - Anti‑termite, durability.  
     - Custom sizing, installation support.

5. **Testimonials / projects (optional)**
   - Show examples or customer stories.  

6. **Promo / banner**
   - Seasonal or limited‑time promotions.  
   - CTA to relevant category or product set.

---

## 3. Catalog Browsing – Category & Listing Pages

### 3.1 Category Pages (Window / Door / Bouven)

#### Purpose

Provide structured browsing for customers focused on a specific category.

#### Layout

- Header:
  - Category name and description.  
  - Optionally highlight sub‑models (e.g. “Sliding Windows”).

- Filters:
  - Product model (JUNGKIT, SLIDING, SWING, FIXED, ZIGZAG).  
  - Design variant (PLAIN, ORNAMENT, COMBINATION, SERIES_A/B/C).  
  - Price range.  
  - Attributes (e.g. color, glass type).  

- Sorting:
  - By price (low → high, high → low).  
  - By popularity.  
  - By newest.

- Product grid:
  - Each card shows:
    - Main image (from `product_media` main image).  
    - Name.  
    - Price or price range.  
    - Key attributes or descriptors.  
    - CTA: “View Details”.

### 3.2 Listing Behavior

- Pagination:
  - Standard paged list or “load more” to avoid infinite scroll issues.  

- Filter persistence:
  - Filters remain active when navigating back from product detail.  

- Mobile:
  - Filters accessible via drawer.  
  - Cards adapt to smaller screens.

---

## 4. Product Detail Page

### 4.1 Purpose

Provide detailed information for a selected product and its variants, and enable adding to cart.

### 4.2 Layout

Sections:

1. **Gallery**
   - Main image plus thumbnails from `product_media`.  
   - Zoom or full‑screen view.

2. **Title & taxonomy**
   - Product name.  
   - Category / model / design variant.  
   - Short descriptor.

3. **Pricing & variants**
   - Price (for selected variant).  
   - Variant selector:
     - Variation 1 (e.g. color).  
     - Variation 2 (e.g. size).  
   - Stock indication (in stock, low stock, out of stock) if applicable.

4. **Key attributes**
   - Structured attributes (material, glass type, thickness, etc.).  
   - Sizing info (width/height ranges).  

5. **Description & usage**
   - Long description, context of usage (e.g. living room window, kitchen, commercial building).  

6. **Add to cart section**
   - Quantity selector.  
   - “Add to Cart” button.  
   - Feedback on add:
     - Success message.  
     - Mini cart preview or cart icon highlight.

7. **Related products**
   - Suggestions based on category/model/design.  
   - Cross‑sell or upsell items.

---

## 5. Cart Flow

### 5.1 Cart Page

#### Purpose

Allow customers to review selected items, adjust quantities, and proceed to checkout.

#### Layout

- Item list:
  - Thumbnail.  
  - Name and taxonomy.  
  - Selected variant (variations shown).  
  - Unit price.  
  - Quantity input.  
  - Line total.  
  - Remove item action.

- Summary:
  - Subtotal.  
  - Estimated shipping (if possible).  
  - Potential discounts/promos.  
  - Total estimate.

- Actions:
  - “Continue Shopping” link (back to catalog).  
  - “Proceed to Checkout” primary CTA.

### 5.2 Cart Behavior

- Updates:
  - Quantity changes update line totals and summary instantly.  
- Persistence:
  - Cart items persist within a session and ideally across sessions via cookies/local storage or server‑side cart.

---

## 6. Checkout Flow

### 6.1 Flow Overview

Checkout flow typically follows:

1. **Customer details & shipping address**  
2. **Shipping method (if multiple)**  
3. **Payment method & summary**  
4. **Order review & confirmation**

Depending on implementation, these may appear as:

- A single consolidated page, or  
- A stepped flow with a progress indicator.

### 6.2 Step 1 – Customer & Shipping Details

Form:

- Contact:
  - Name.  
  - Phone.  
  - Email (optional or required based on preference).

- Shipping address:
  - Address line 1 / 2.  
  - City.  
  - Province.  
  - Postal code.  
  - Country.

- Optional extras:
  - Notes for delivery (e.g. special instructions).

Behaviors:

- Validate required fields.  
- Allow autocomplete for address if supported.  
- Provide clear messaging about delivery regions covered.

### 6.3 Step 2 – Shipping Method

Options:

- Show available shipping options (e.g. JNT Cargo service types).  
- For each option:
  - Name.  
  - Cost.  
  - Estimated delivery time.

Behaviors:

- Default selection based on best cost/speed.  
- Update order summary totals when option changes.

### 6.4 Step 3 – Payment Method & Summary

Payment methods:

- COD.  
- Transfer (manual bank transfer).  
- Optional gateways (if implemented later).

UI:

- Radio buttons or tiles for method selection.  
- If transfer:
  - Show bank account details.  
  - Instructions for sending evidence (WhatsApp or upload in admin).  

Summary:

- Itemized order:
  - Subtotal.  
  - Shipping cost.  
  - Discounts.  
  - Final total.

Trust & reassurance:

- Message about secure handling of data.  
- Clear refund/return policy link.

### 6.5 Step 4 – Order Review & Confirmation

- Final review:
  - Items, quantities, total amount.  
  - Shipping address.  
  - Selected shipping and payment.

- Confirmation action:
  - “Place Order” button.

Upon success:

- Show confirmation page:
  - Order number.  
  - Summary of items and totals.  
  - Expected next steps (e.g. “You will receive a WhatsApp message with details”).  
- Optionally allow printing or saving as PDF.

Backend:

- Creates `orders`, `order_items`, and `payments` records according to selected method.  
- Triggers domain events for order creation and potential WhatsApp notifications.

---

## 7. Order Status View for Customers

### 7.1 Order Status Page

If customers can view status via website (with order number + phone or account login):

- Entry:
  - Form to input order number and phone/email (or login).  

- Status view:
  - Summary of order.  
  - Status indicators:
    - Order status.  
    - Payment status.  
    - Shipping status.  
  - Timeline showing key events (created, payment confirmed, shipped, delivered).

---

## 8. Static Pages & Trust Elements

### 8.1 Static Content

Pages:

- About Ragil Aluminium.  
- FAQ (ordering, payment, shipping, returns).  
- Contact (WhatsApp, phone, address, maps).  
- Policies (privacy, terms, warranty).

These are managed via CMS in admin and surfaced in:

- Header (for key pages).  
- Footer (most links).

### 8.2 Trust Signals

Elements:

- Reviews or testimonials.  
- Project photos (before/after).  
- Badges (secure payments, materials quality, shipping partners).

Placement:

- Product detail pages.  
- Checkout page (near payment form).  
- Homepage.

---

## 9. Agent Checklist for Public Store UI

When designing or modifying public store UI, agents must:

- Use internal product taxonomy (category/model/design) to drive navigation and filters.  
- Display prices, stock, and media derived from backend schema without reinventing product structure.  
- Keep the checkout flow simple and clear, minimizing friction from cart to confirmation.  
- Provide transparent summaries of costs (subtotal, shipping, discounts, total) early in the flow.  
- Ensure all catalog and checkout elements respect Brandkit & Design Tokens for consistent styling.  
- Avoid adding checkout logic directly in UI; always rely on backend modules for order creation and status updates.  
- Update this flow document when introducing new major steps or variations in the public store journey.

---
