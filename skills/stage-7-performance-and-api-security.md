# Skill: Stage 7 – Performance & API Security for Ragil Aluminium

This document defines the **performance and API security principles** for the Ragil Aluminium system, built on Laravel with the modular architecture defined in Stage 1–6.  
All agents must treat these as **non‑negotiable constraints**: do not ship code that breaks these performance or security rules.

---

## 1. Performance Goals & Threat Model

Ragil Aluminium is not a global high‑traffic marketplace, but the system must:

- Handle:
  - tens of thousands of products & variants,
  - heavy bulk imports,
  - frequent media downloads.  
- Still keep:
  - catalog pages responsive,
  - checkout smooth,
  - admin operations usable.

Threats to performance:

- Slow catalog queries due to missing indexes or bad joins.  
- Blocking HTTP requests caused by heavy imports or media processing.  
- Uncached repeated reads (e.g., homepage, category pages).  

Stage 7 ensures:

- Data access is optimized (indexes, query shape).  
- Heavy work runs in queues.  
- Smart caching is applied where it matters.

---

## 2. Database Performance Principles

### 2.1 Indexing Mandatory Fields

Agents must ensure proper indexes exist on these columns:

- Product & variant identity:
  - `products.parent_sku`
  - `product_variants.variant_sku`
- Relations:
  - `product_variants.product_id`
  - `product_media.product_id`
  - `product_media.product_variant_id`
- Taxonomy & filters:
  - `products.product_category`
  - `products.product_model`
  - `products.design_variant`
- Order relations:
  - `order_items.order_id`
  - `orders.customer_whatsapp_number` (if used for lookup)
- Status fields:
  - `orders.order_status`
  - `orders.payment_status`
  - `shipments.shipping_status`

Guidelines:

- Use composite indexes when filtering by multiple columns (e.g., `product_category + product_model`).  
- Regularly review slow queries and add or adjust indexes based on actual usage.

### 2.2 Query Design

Agents must design queries so that:

- Catalog queries:
  - use pagination (limit/offset or cursor),
  - never load entire catalog in one go for public pages.
- Detail pages:
  - fetch a single product plus its variants and media with **bounded joins**.
- Admin listings:
  - use indexed filters (status, SKU, category),
  - avoid N+1 queries.

For complex read needs, consider:

- Read‑optimized views or denormalized tables for heavy reports, separate from transactional tables.

---

## 3. Caching Strategy

### 3.1 Redis as Cache Layer

Redis is used as the primary cache backend:

- `.env` baseline:

  ```env
  CACHE_DRIVER=redis
  ```

Key caching targets:

- Homepage catalog highlights (e.g., featured products).  
- Category listings (e.g., “WINDOW / JUNGKIT” first few pages).  
- Common lookups (e.g., taxonomy lists, settings, WhatsApp templates).  

### 3.2 Cache Patterns

Agents should:

- Use Laravel’s cache APIs:

  ```php
  $products = Cache::remember("category:{$category}:model:{$model}:page:{$page}", 600, function () {
      return ProductRepository::getCategoryModelPage($category, $model, $page);
  });
  ```

- Set sensible TTLs (e.g., 5–15 minutes) for catalog lists.  
- Invalidate or update cache when:
  - relevant imports complete (Stage 5),
  - product/variant changes in admin UI.

Do **not** cache:

- Highly dynamic, per‑user data (cart contents, checkout forms).  
- Sensitive data (admin dashboards with personal information).

---

## 4. Queue Separation & Non‑Blocking Operations

### 4.1 Heavy Work Offloaded to Queues

Any of the following must **never** run synchronously in HTTP requests:

- Bulk imports (Stage 5).  
- Media downloads (Stage 5).  
- Large email/notification batches.  

They must be:

- Dispatched as jobs to appropriate queues (`imports`, `media`, `default`).  
- Processed by workers managed via Supervisor/Horizon.

### 4.2 Queue Priorities

Guidelines:

- `imports` queue:
  - Prioritized for catalog/inventory imports.  
  - Can be slower; user expectations are “background process”.
- `media` queue:
  - Handles image download; may be long‑running.  
- `default` queue:
  - For lighter jobs (notifications, simple asynchronous tasks).

Avoid mixing:

- heavy import/media jobs on the same queue worker that handles time‑sensitive tasks (e.g., order confirmation emails).  

Workers should be tuned with `--max-jobs` and `--max-time` to avoid memory issues and maintain responsiveness.

---

## 5. API Security – Admin vs Public

### 5.1 Admin API Security

Admin endpoints include:

- Catalog CRUD (products, variants, taxonomy).  
- Import job management.  
- Media management.  
- Order, payment, shipping status management.  
- WhatsApp template & log views.

Requirements:

- All admin routes must be protected by authentication middleware:
  - Laravel session auth for web admin, or
  - API token (Sanctum) if using SPA/admin frontends.
- Sensitive actions (import, mass updates, deleting products) should be further protected:
  - CSRF for web forms,
  - optional additional confirmation flows.

Checklist:

- No admin route exposed without auth.  
- No “hidden” route for bulk updates bypassing auth or logging.

### 5.2 Public API Security

Public endpoints include:

- Catalog browsing (listing, detail).  
- Cart and checkout.  
- Order status checks (using order ID + WhatsApp number or token).

Requirements:

- All public APIs must validate inputs and avoid:
  - blind SQL queries based on user input,
  - exposure of internal IDs or sensitive data.
- Implement **rate limiting** on:
  - search endpoints,
  - status check endpoints,
  - any route that could be abused (e.g., form submissions).

Example (Laravel rate limiter):

```php
Route::middleware('throttle:60,1')->group(function () {
    Route::get('/catalog', ...);
    Route::get('/product/{id}', ...);
    Route::post('/checkout', ...);
    Route::get('/order-status', ...);
});
```

Tuning:

- Differentiate guest vs authenticated user limits if needed.  
- Reduce rate limits on particularly abuse‑prone endpoints.

---

## 6. Transport Security & CORS

### 6.1 HTTPS Everywhere

Requirements:

- All production traffic must use HTTPS:
  - Redirect HTTP to HTTPS at the load balancer/web server.  
- Backend URLs for WhatsApp webhooks and other integrations must be HTTPS.

Do not:

- Serve admin endpoints over plain HTTP in production.  
- Expose API tokens over unencrypted channels.

### 6.2 CORS & Origin Control

If using separate frontend domains (e.g., SPA admin, public store):

- Configure CORS to:
  - allow only known origins,
  - restrict methods and headers to what’s required.

Example (conceptual):

```php
'paths' => ['api/*'],
'allowed_origins' => ['https://ragil-store.com', 'https://ragil-admin.com'],
'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE'],
'allowed_headers' => ['Content-Type', 'Authorization'],
```

Avoid wildcard `*` for origins in production.

---

## 7. Secrets Management & API Keys

For external integrations (WhatsApp, S3, future services):

- Store secrets in `.env`:
  - `WHATSAPP_API_KEY`, `WHATSAPP_API_BASE_URL`, `WHATSAPP_BUSINESS_NUMBER`.  
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, etc.
- Do not:
  - hardcode secrets in code,
  - commit `.env` or secret values to version control.

Use Laravel config helpers (`config('services.whatsapp')`) so application logic reads from config, not raw env calls scattered everywhere.

---

## 8. Observability: Logging & Monitoring (High‑Level)

Before going deep into a separate logging skill, Stage 7 requires:

- Log key events:
  - import job start/completion,
  - media download failures,
  - API errors or unexpected exceptions.
- Aggregate logs and metrics:
  - track slow endpoints,
  - monitor queue job failures,
  - track cache hit/miss ratios (if possible).

Tools can be:

- Basic: Laravel logs + server monitoring.  
- Advanced: Laravel Telescope, Horizon, external APM (optional).

Core requirement:

- Don’t ignore performance/security issues; they must be visible.

---

## 9. Agent Checklist

Before shipping any backend feature, agents must:

- [ ] Ensure database queries for catalog and orders use proper indexes and pagination; no “load all” patterns for public pages.  
- [ ] Use Redis for caching frequently accessed catalog data; implement cache invalidation when imports or admin edits change catalog.  
- [ ] Offload heavy operations (imports, media downloads) to queues (`imports`, `media`) and tune queue workers for stability.  
- [ ] Protect all admin routes with authentication and, where appropriate, CSRF; never expose bulk or sensitive actions without auth.  
- [ ] Apply rate limiting to public APIs (catalog search, checkout, order status) to prevent abuse and protect performance.  
- [ ] Require HTTPS for all production traffic and avoid insecure origins; configure CORS to only allow trusted frontends.  
- [ ] Keep all integration secrets (WhatsApp, S3, etc.) in `.env` and config, never hardcoded in source.  
- [ ] Implement logging for critical operations (imports, media, queue failures, API errors) to support monitoring and debugging.  
- [ ] Verify that new code does not bypass established performance and security patterns (e.g., bypassing queue or cache, ignoring auth/rate limits).

Any backend implementation that violates these performance or security principles must be refactored before being considered acceptable for Ragil Aluminium.
