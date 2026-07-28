# Coding Agents – Ragil Aluminium (`website.4.0`)

Laravel modular monolith: Inertia + React storefront and admin panel.  
**Orchestration:** read [`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md) first.  
**Server / production migrate:** only when product is final — out of scope until then.  
**DATABASE SAFETY:** never wipe/reset app DB (`migrate:fresh`, `db:wipe`, truncate massal) unless the user explicitly orders it — see § Agent Rules.

## Always read before code

1. [`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md) — SoT hierarchy & skill map  
2. Architecture / schema / API (as needed for the task):
   - `docs/architecture/system-architecture-ragil-aluminium.md`
   - `docs/database-schema-ragil-aluminium.md`
   - `docs/api-and-routes-ragil-aluminium.md`
3. UI work additionally:
   - `frontend/README.md`
   - `frontend/brand/BRAND-KIT.md` + `frontend/docs/DESIGN-SYSTEM.md`
   - `docs/sitemap/*` + `config/sitemap.php` / `config/admin-sitemap.php`
   - `frontend/skills/ragil-public-ui/SKILL.md` or `frontend/skills/ragil-admin-ui/SKILL.md`
   - **`frontend/skills/ragil-ui-functional-integration/SKILL.md`** — UI/fitur wajib fungsional + terintegrasi backend (bukan mockup)
4. Domain stage skill under `skills/stage-*.md` when touching that domain

`skills/` domain files are flat `.md` (e.g. `stage-1-foundation.md`). Treat each as a skill.  
Marketplace skills live in `.agents/skills/` (technique helpers only).

**Do not** port UI from `website_2.0/ui` (Next.js). Functional contracts live in `docs/PRODUCT-HANDOFF.md`; visual governance lives in `frontend/`.

**UI / fitur:** setiap perubahan tampilan harus dianalisis fungsinya lalu disambungkan ke route/controller/service/schema yang ada sehingga **langsung fungsional**. Jangan kirim mockup atau data palsu sebagai selesai. Rule Cursor: `.cursor/rules/ui-must-be-functional.mdc`.

---

[AGENT REPORT FORMAT — MUST FOLLOW]

Every time you change code or fix an error, you MUST report using EXACTLY this structure.
Do NOT add extra narrative or steps.

1) SCOPE:
   - One short line.
   - Example: "Admin product create form"
              "API /api/products detail WIN-JUNG-001"

2) ROOT_CAUSE:
   - One line, directly stating the real cause.
   - Example: "Null product_media->url caused blade error"
              "variants relation not loaded, property access in loop"

3) CHANGE:
   - Maximum two lines.
   - Name the files and what you changed.
   - Example: "Added null-check in resources/views/admin/products/create.blade.php"
              "Loaded variants relation in ProductController@show before rendering"

4) SPEC_IMPACT:
   - Choose ONE of these and write it exactly:
     - "SPEC_UNCHANGED" → schema, routes, and JSON contracts are all unchanged.
     - "SPEC_CHANGED_AND_DOCS_UPDATED" → spec changed AND docs have been updated.

5) TEST_STATUS:
   - One line about tests or manual checks.
   - Example: "Smoke test admin create product: PASS"
              "Route /api/products/WIN-JUNG-001: 200 OK, payload matches api-and-routes spec"

Extra rules:
- Do NOT describe your internal process (e.g. "let me check the log", "let me run the request").
- Do NOT mention misleading stack frames or line numbers once you know they are not the real source.
- Focus only on: scope, root cause, concrete code changes, impact on spec, and test status.
---

## SKILL USAGE RULES

**Peta lengkap (tracks A–F, verify, gap):** [`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md).  
Ringkas area → skill wajib:

| Area | Track | Baca wajib |
|------|-------|------------|
| Public storefront / checkout | C | `frontend/skills/ragil-public-ui/SKILL.md`, **`ragil-ui-functional-integration`**, brand/design docs, `docs/logic/stage-10-*`, `docs/sitemap/public-*` |
| Admin UI | C | `frontend/skills/ragil-admin-ui/SKILL.md`, **`ragil-ui-functional-integration`**, brand/design docs, `docs/logic/stage-9a-*` / `9b-*`, `docs/sitemap/admin-*` |
| Import & media | B | `skills/stage-5-import-and-media-pipeline.md`, schema |
| WhatsApp (+ event order) | B | `skills/stage-8-*`; event order juga `skills/stage-4-*` |
| Queue & storage | B | `skills/stage-6-laravel-queue-and-storage.md` |
| Order / payment / shipping | B | `skills/stage-4-*`; JNT → `docs/jnt-cargo-integration.md` |
| Tests / PHPUnit | E | `.agents/skills/laravel-testing` + `tests/Feature/*` |
| Visual implementation | C | `frontend/brand/BRAND-KIT.md`, `frontend/docs/DESIGN-SYSTEM.md`, `frontend/skills/ragil-visual-qa/SKILL.md`, **`ragil-ui-functional-integration`** |
| Visual overhaul technique | C | `.agents/skills/design-taste-frontend` + tetap tunduk pada kontrak dan brand kit |

General rule:
- Read AGENTS.md → [`ORCHESTRATION.md`](docs/ORCHESTRATION.md) track → skill lokal → supporting docs.
- Do NOT rely only on docs/; `skills/` domain files are authoritative workflows for that stage.
- Marketplace `.agents/skills/` = technique only; do not override frontend governance / schema / sitemap.
- Do NOT invent beyond schema / API / Product Handoff / sitemap contracts.

---

## Phase 0 – Setup & Baseline

1. **Initialize Laravel project**
   - Ensure Laravel version (e.g. 10+).  
   - Configure environment for MySQL (local dev).

2. **Configure environment files**
   - `.env`:
     - DB connection (MySQL).  
     - queue (Redis or database).  
     - storage (local, possibly S3 later).  
     - placeholder config for WhatsApp and shipping.

3. **Create basic route groups**
   - `routes/web.php`: public + admin prefixes.  
   - `routes/api.php`: if needed for API endpoints.  
   - Webhook routes for WhatsApp and shipping.

---

## Phase 1 – Database Migrations & Models (MySQL)

1. **Implement migrations for catalog tables**
   - `products`, `product_variants`, `product_attributes`, `product_media`.  
   - Add indexes and enum fields as per `database-schema-ragil-aluminium.md`.

2. **Implement migrations for import pipeline**
   - `import_jobs`, `import_job_rows`.

3. **Implement migrations for orders & logistics**
   - `orders`, `order_items`, `payments`, `shipping_records`.

4. **Implement migrations for WhatsApp integration**
   - `whatsapp_templates`, `whatsapp_messages`.

5. **Implement migrations for users & customers**
   - `users`, `customers`.

6. **Implement migrations for analytics/logs**
   - `event_logs`, `performance_metrics`.

7. **Create Eloquent models**
   - One per table, with:
     - relationships (e.g. `Product` ↔ `ProductVariant`, `Order` ↔ `OrderItem` ↔ `Payment` ↔ `ShippingRecord`).  
     - fillable/guarded fields and casting.

---

## Phase 2 – Routing & Controller Skeletons

1. **Public store controllers**
   - `HomeController`, `PageController`, `CatalogController`, `ProductController`, `CartController`, `CheckoutController`, `OrderController`.

2. **Admin controllers**
   - `Admin\DashboardController`, `Admin\ProductController`, `Admin\ProductVariantController`, `Admin\ProductAttributeController`, `Admin\ProductMediaController`.  
   - `Admin\ImportJobController`, `Admin\OrderController`, `Admin\PaymentController`, `Admin\ShippingRecordController`.  
   - `Admin\WhatsAppTemplateController`, `Admin\WhatsAppMessageController`.  
   - `Admin\AnalyticsController`, `Admin\PageController`, `Admin\BannerController`, `Admin\UserController`, `Admin\SettingsController`.

3. **Webhook controllers**
   - `Webhook\WhatsAppController`, `Webhook\ShippingController`.

4. **Wire routes to controllers**
   - Implement route definitions as per `docs/api-and-routes-ragil-aluminium.md`.

---

## Phase 3 – Core Features Implementation

1. **Catalog browsing & product detail**
   - Implement queries for category pages, filters, and product detail.  
   - Integrate `product_media` for images.  
   - Respect `status` and `visibility` flags.

2. **Cart & checkout**
   - Implement cart storage (session or DB).  
   - Implement checkout flow: customer details, shipping, payment method, order creation.  
   - Ensure order creation writes to `orders`, `order_items`, `payments`.

3. **Admin catalog management**
   - Implement product/variant CRUD with archive behavior (no hard delete).  
   - Implement media manager UI and actions.

4. **Import & media pipeline**
   - Implement upload of Shopee Excel.  
   - Use Laravel Excel queued imports for `import_jobs` and `import_job_rows`.  
   - Implement media download jobs and update `product_media`.

5. **Order, payment, shipping management in admin**
   - Implement order list & detail.  
   - Implement payment recording & status updates.  
   - Implement shipping record creation & status refresh.

6. **WhatsApp integration**
   - Implement outbound messaging via Business API.  
   - Implement webhook handling, log messages, and link to orders.  
   - Map Stage 4 events to Stage 8 templates.

---

## Phase 4 – UI & UX Details (Admin & Public)

1. **Admin UI**
   - Implement sidebar and Dashboard / Beranda widgets.  
   - Implement views for Catalog, Imports, Orders, Shipping, WhatsApp, Analytics, CMS, Settings.  
   - Follow `frontend/brand/BRAND-KIT.md`, `frontend/docs/DESIGN-SYSTEM.md`, and the admin project skill.

2. **Public store UI**
   - Implement homepage, category, product detail, cart, checkout, order status.  
   - Follow the public project skill and `frontend/docs/UX-FLOWS.md`; mobile responsive.

---

## Phase 5 – Testing, Performance, Security

1. **Testing**
   - Add feature tests for:
     - imports.  
     - order lifecycles.  
     - checkout flow.  
     - WhatsApp integration.  

2. **Performance**
   - Optimize queries with indexes and eager loading.  
   - Tune queue workers and chunk sizes.

3. **Security**
   - Secure admin routes and webhooks with auth and validation.  
   - Protect sensitive config values.

---

## Agent Rules

- Always read orchestration + relevant docs/skills before coding.  
- Prefer updating docs/sitemap/DESIGN first when contracts change, then code.  
- Log major architecture decisions in `docs/architecture/` as needed.  
- Do not start production server migration until explicitly scoped as a mature release.

### DATABASE SAFETY (hard rule — handoff wajib baca)

**Jangan mereset / menghapus data database kecuali user memberi instruksi eksplisit di query yang sama.**

Dilarang tanpa perintah eksplisit:

- `php artisan migrate:fresh` / `migrate:refresh` / `db:wipe`
- `TRUNCATE`, `DROP DATABASE`, `DROP TABLE` (kecuali migration baru yang sudah dikontrak)
- Seeder yang menimpa / mengosongkan data nyata di MySQL `ragil` (atau DB app aktif di `.env`)
- `Artisan::call('migrate:fresh'|…)` dari skrip debug yang bootstrap `.env` production/local (bukan sqlite testing)

Uji fitur: pakai PHPUnit (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:` per `phpunit.xml`) atau DB testing terpisah. Jangan andalkan flag `--env=testing` di `Artisan::call` sebagai jaminan aman — itu **tidak** mengalihkan koneksi dari `.env` MySQL.

`migrate` biasa (forward-only) boleh jika relevan ke tugas dan tidak wipe. Jika ragu: tanya user dulu.

Insiden: 2026-07-27 — `migrate:fresh` keliru kena DB `ragil` saat debug; katalog/order hilang. Recovery = re-import Excel di `storage/app/imports/catalog/` (order/CMS tanpa backup tidak otomatis kembali).

---
---

## Resolved Issues Log (stabilization)

- **RouteNotFoundException `policy/privacy` / `policy/terms`** (500 on every page using `layouts/public.blade.php`, incl. `/`, `/windows`, `/api/catalog/*`): the public layout called `route('policy/privacy')` but the contracted route names are `privacy` and `terms` (`routes/web.php`). Fixed by using the defined names `route('privacy')` / `route('terms')` in `resources/views/layouts/public.blade.php`. No new route added.
- **API routes returned HTML instead of JSON** (`/api/catalog/{category}`, `/api/products/{sku}`, `/api/search`): per `api-and-routes.md` §10 these are API routes. Branched responses in `CatalogController`, `ProductController`, `SearchController`: when `request()->is('api/*')` **or** `request()->wantsJson()` (Accept: application/json) they return schema-shaped JSON; otherwise Blade view. Added `Product::toApiArray()` and `ProductVariant::toApiArray()` (fields taken from `database-schema.md`; no new fields). No schema/route/field changes.
- **`BadMethodCallException: whenLoaded`** in `toApiArray()`: `whenLoaded()` is not a base Eloquent Model method. Replaced with `relationLoaded(...)` guards.
- **`Error: map() on array` on `attributes` relation**: `$this->attributes` collides with Eloquent's internal `$attributes` array property. Used `getRelation('attributes')` inside the `relationLoaded` guard.
- **Return-type `TypeError`** on `CatalogController::windows/doors/bouven`: widened their return types to `JsonResponse|View` to match the branched `category()` helper.
- **`main_image` null on product-detail API**: `ProductController@show` now also eager-loads `mainImage` so the field is consistent with the catalog API.

- **Checkout → order creation flow verified (Stage 3)**: full flow `POST /cart/add` → `POST /checkout/validate` → `POST /checkout/place-order` runs end-to-end with no 500. `OrderService::createFromCart()` writes `orders` (status `pending_payment`/`pending`/`pending_pickup`), `order_items`, and `payments` per `database-schema.md`. `OrderCreated` event fires `SendOrderCreatedWhatsApp`; `WhatsAppService` degrades safely when no `whatsapp_templates` row / no API token (returns null, no partial write). Confirmation (`/order/{n}/confirmation`) and status (`/order/status`) pages render HTML 200. CSRF 419 on POST is expected framework behavior (browser supplies token); not a contract bug.


- **Stage 4 import pipeline + admin pages fixed**: (a) `CatalogProductsImport` had a `BeforeImport` handler calling `$event->reader->getActiveSheet()` which 500s (null reader delegate) — removed `WithEvents`/`registerEvents`/`RemembersRowNumber`; `total_rows` stays nullable per schema. (b) `Excel::queueImport()` requires `ShouldQueue` but making the import `ShouldQueue` crashed serialization (`"spreadsheet" ... does not exist`). Fixed by adding queued job `App\Jobs\ProcessCatalogImport` (holds only `$jobId`/`$storedPath`) and dispatching it from `ImportJobController@store`/`retry`; import runs and writes `products`/`product_variants`/`product_media`/`import_job_rows` per schema. (c) All admin pages 500'd with `Class "Auth" not found` because `config/app.php` overrode the default facade `aliases` array (only `Excel`), dropping `Auth`. Fixed view to use `auth()->user()` in `layouts/admin.blade.php`. All admin sections now 200.

- **Stage 5 (WhatsApp + Shipping webhooks & admin) verified**: webhook routes `GET/POST /webhook/whatsapp` and `POST /webhook/shipping/jnt` are CSRF-exempt (see `bootstrap/app.php` `validateCsrfTokens(except: ['webhook/*'])`). `WhatsAppController@handle` writes inbound `whatsapp_messages` (test: 1 inbound row created); `ShippingController@handleJnt` → `ShippingService::applyCarrierUpdate` updates `shipping_records` + cascades `orders.shipping_status` (graceful when waybill missing). Admin WhatsApp/Shipping/Payments pages 200; template `store` 302 + row created; shipping `refresh` 302 + graceful (`last_status_at` touched) when no carrier API key. No 500 in Stage 5.

- **Admin media manager 500 fixed**: `ProductMediaController@store` and `@redownload` called `DownloadProductMedia::dispatch($media)` (passing the model), but the job constructor requires `int $mediaId` → `TypeError`. Fixed to `DownloadProductMedia::dispatch($media->id)` (matches `CatalogProductsImport`). Media store/redownload/set-main/archive now 302, no 500.

- **Phase 5 feature tests added**: enabled SQLite (in-memory) for `phpunit.xml` (matches dev env) and added `tests/Feature/CheckoutFlowTest` (order+items+payment), `ImportPipelineTest` (via `ProcessCatalogImport` → products/variants/media, job `completed`), `WhatsAppWebhookTest` (inbound logged, verify 403). All 4 pass (17 assertions). No app code changed.
