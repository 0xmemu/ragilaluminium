# Backend Audit & Improvement Plan — Ragil Aluminium (`website_3.0`)

> **Tanggal audit:** 2026-07-12  
> **Cakupan:** Seluruh backend Laravel di `d:\website_3.0` (70 file PHP: controllers, services, jobs, imports, events, listeners, models, middleware, routes, config, migrations).  
> **Metode:** Read-only static audit + cross-check terhadap `docs/` dan `skills/stage-*`. Setiap temuan diverifikasi di file sumber (`file:line`).  
> **Status:** AUDIT SELESAI — perbaikan **sudah diimplementasikan** (2026-07-12). Lihat §8 *Implementation Log* & `docs/jnt-cargo-integration.md`. C1 sengaja dipertahankan (backup antar-staf, atas keputusan pemilik).

Prioritas audit sesuai permintaan: **(1) arsitektur keseluruhan, (2) integrasi JNT Cargo, (3) logic performa toko, (4) web routing** — namun temuan minor lintas modul tetap dicatat lengkap di §7.

---

## 1. Ringkasan Eksekutif

Backend sudah memiliki **fondasi modular yang baik**: service layer (Cart/Order/Shipping/WhatsApp), event–listener, migrations lengkap sesuai schema, dan dual-mode controller (web + API JSON). Namun audit menemukan **celah keamanan kritis, kebocoran integritas data, dan beberapa fitur inti yang masih scaffold** (belum diimplementasikan penuh).

### Temuan paling kritis (harus diperbaiki lebih dulu)

| # | Area | Temuan | Dampak |
|---|------|--------|--------|
| C1 | Keamanan/Auth | Middleware `admin` tidak memeriksa role — `isAdmin()` ada tapi **tak pernah dipakai** | Semua user aktif (`staff`/`viewer`) punya akses penuh panel admin + kelola user & role |
| C2 | Web routing | `GET /api/orders/{order_number}/status` memanggil `OrderController@confirmation` yang **return Blade HTML**, bukan JSON | Konsumen API menerima HTML; endpoint status salah semantik |
| C3 | Integritas transaksi | Harga & stok **tidak divalidasi ulang dari DB** saat `placeOrder`; harga diambil dari session | Harga kadaluarsa, overselling, `product_id=0` melanggar FK → order gagal / manipulasi total |
| C4 | Privasi/Data | Lookup & confirmation pesanan **tanpa verifikasi identitas** (phone/email nullable) | Siapa pun dengan `order_number` bisa lihat PII pelanggan (nama, HP, alamat) |
| C5 | Keamanan webhook | Webhook JNT & WhatsApp **tanpa verifikasi signature** | Pihak luar bisa memalsukan update status pengiriman & pesan masuk |
| C6 | Performa toko | `PerformanceMetric` **tak pernah ditulis/dibaca**; metrik visitor/konversi/customer belum ada | Kontrak Stage 9A tidak terpenuhi; dashboard sebagian hardcoded |
| C7 | JNT Cargo | `estimateCost()` selalu `Rp15.000` (bug ternary), `ShippingRecord::create` **tidak ada** di codebase | Ongkir tidak nyata; tidak ada alur buat shipment/waybill |
| C8 | SSRF | `DownloadProductMedia` GET URL eksternal tanpa allowlist/limit | SSRF ke IP internal + DoS via file besar |

### Distribusi temuan (agregat 5 area audit)

| Severity | Perkiraan jumlah |
|----------|------------------|
| CRITICAL | 8 |
| HIGH | ~30 |
| MEDIUM | ~45 |
| LOW | ~30 |
| MINOR | ~25 |

---

## 2. Penilaian per Area Prioritas

### 2.1 Arsitektur Keseluruhan — **Cukup baik, ada gap implementasi**

**Kuat:**
- Service layer terpisah bersih (`app/Services/*`), constructor injection konsisten.
- Event–listener untuk WhatsApp (`OrderCreated`, `PaymentConfirmed`) — dekopling baik.
- Migrations & model relationships lengkap dan sesuai `docs/database-schema`.
- Dual-mode controller (web Blade + API JSON) via deteksi `is('api/*')`.

**Lemah:**
- **Fitur "diklaim ada" tapi scaffold:** `PerformanceMetric` (dead), shipment creation JNT (tidak ada), estimasi ongkir (placeholder), WhatsApp `order_shipped/delivered` (tidak ada listener).
- **Listener WhatsApp sinkron** (tidak `implements ShouldQueue`) dan di-dispatch **di dalam** `DB::transaction` → latency HTTP masuk ke request user + memperpanjang lock.
- **Tidak ada `EventLog` audit** untuk shipping & payment (hanya order status admin).
- **Coupling:** `OrderService` meng-hardcode `\App\Models\Product::where(...)` inline (baris 55, 61) alih-alih lewat repository/CartService.
- **Inkonsistensi enum lintas tabel:** `orders.payment_method` (`cod,transfer,other`) vs `payments.payment_method` (`cod,transfer,gateway`); `shipping_records.status` punya `returned`, `orders.shipping_status` tidak.

### 2.2 Integrasi JNT Cargo — **Belum production-ready (scaffold tracking pasif)**

Implementasi saat ini **hanya menerima update status** (webhook + admin refresh). Tidak ada: pembuatan shipment ke JNT, pengisian `waybill_number`, estimasi ongkir nyata, autentikasi webhook, atau `shipping_status_logs` (Stage 4).

| Requirement Stage 4 | Status |
|---------------------|--------|
| Estimasi ongkir via JNT/rules | ❌ placeholder, tak dipanggil |
| Buat shipment → waybill dari JNT | ❌ tidak ada |
| Simpan waybill + status awal | ❌ tak ada `ShippingRecord::create` |
| Webhook carrier | ⚠️ minimal, tanpa auth |
| WhatsApp `order_shipped`/`delivered` | ❌ tidak ada event |
| `order_status=shipped` saat handoff | ❌ hanya `delivered` |
| `shipping_status_logs` | ❌ tidak ada |

Bug spesifik: `estimateCost()` (`ShippingService.php:15`) `(float) config(...) ? 15000 : 15000` — ternary tak bermakna, selalu 15000; `$destinationCity` & `customer_id` tak dipakai; `refreshStatus` tanpa timeout/retry; cascade `returned` → enum `orders.shipping_status` invalid = **error SQL**.

### 2.3 Logic Performa Toko — **Sebagian besar belum diimplementasi**

- `PerformanceMetric` model ada tapi **nol writer/reader** di seluruh `app/` → tabel selalu kosong.
- `AnalyticsController::storePerformance` menghitung langsung dari `orders` **tanpa filter status** → revenue termasuk order `cancelled`/`pending_payment` (angka salah). Tak ada caching, tak ada timezone handling eksplisit.
- `importPerformance` pakai `total_rows` yang **tak pernah di-set importer** → `rowFailureRate` selalu 0.
- Dashboard "Top Categories" & pipeline sudah wired ke data nyata (baik), tapi trend/tren penjualan di Blade masih hardcoded.
- **Belum ada** metrik visitor, konversi, customer dataset (kontrak Stage 9A).
- `EventLog` hanya ditulis di `Admin/OrderController` (status change) — tidak dipakai untuk analitik.

### 2.4 Web Routing — **Struktur benar, 2 bug + hardening**

- ✅ Semua route name di `config/sitemap.php` & `admin-sitemap.php` **cocok** dengan `web.php`; semua controller method ada; route model binding benar.
- ❌ **C2**: `api.php:29` memanggil `confirmation` (return View) untuk endpoint status JSON.
- ❌ API endpoint tanpa `->name()`, closure catalog duplikasi logic web.
- ⚠️ Rate limiting hilang di: `POST /login` (brute force), cart POST, checkout, order lookup/confirmation.
- ⚠️ `admin.settings.update` route hidup tapi controller no-op; `admin.banners.index` orphan (tanpa nav).
- Minor: param `{shipping}` vs `{shipping_record}` tidak konsisten; `console.php` masih command `inspire` bawaan.

---

## 3. Temuan Kritis (detail + rekomendasi)

### C1 — Middleware admin tidak cek role `[CRITICAL]`
`app/Http/Middleware/EnsureUserIsAdmin.php:15` hanya cek `isActive()`. `User::isAdmin()` (`User.php:41`) ada tapi **tak pernah dipanggil** (diverifikasi via grep: satu-satunya kemunculan adalah definisinya).
```php
// SEKARANG (rentan)
if (! $user || ! $user->isActive()) { return redirect()->route('login'); }
// SEHARUSNYA
if (! $user || ! $user->isActive()) { return redirect()->route('login'); }
if (! $user->isAdmin()) { abort(403); }
```
Tambahan: `LoginController` juga harus menolak non-admin; `UserController` harus RBAC (hanya `super_admin` kelola role & cegah demote super_admin terakhir / self-lockout).

### C2 — API status mengembalikan HTML `[CRITICAL]`
`routes/api.php:29` → `OrderController@confirmation` (`OrderController.php:11`, `: View`). Buat method `statusApi()` yang `response()->json([...])` + verifikasi ownership, beri `->name('api.orders.status')`.

### C3 — Harga & stok tidak divalidasi ulang `[CRITICAL]`
`OrderService::createFromCart` (`OrderService.php:27,54`) memakai `unit_price` dari session (`CartService.php:43`). Tidak ada cek/kurangi `stock` (kolom ada di `product_variants`). `product_id => $product?->id ?? 0` (`OrderService.php:59`) melanggar FK `restrictOnDelete`.
Rekomendasi: dalam transaksi, `lockForUpdate()` variant, validasi `status=active` & `stock>=qty`, set harga dari DB, `decrement('stock')`, throw `DomainException` (bukan fallback `0`) jika produk hilang. Simpan hanya `variant_sku`+`qty` di session, bukan harga.

### C4 — Kebocoran data pesanan `[CRITICAL]`
`OrderController::statusLookup` (`OrderController.php:33-43`) — `customer_phone`/`customer_email` nullable; jika kosong query hanya `order_number` → full disclosure. `confirmation` (`:11`) tanpa auth sama sekali.
Rekomendasi: wajibkan `required_without` phone/email + normalisasi E.164; confirmation via signed URL/token sekali pakai di session pasca-checkout; throttle `10,1` + backoff.

### C5 — Webhook tanpa signature `[CRITICAL]`
`Webhook/ShippingController::handleJnt` (`:17`) & `Webhook/WhatsAppController::handle` (`:29`) menerima payload apa saja. WhatsApp: verifikasi HMAC `X-Hub-Signature-256` (app secret). JNT: shared secret/signature + IP allowlist. Gunakan `hash_equals()` untuk verify_token GET. Tambah throttle & logging inbound.

### C6 — Performa toko belum ada `[CRITICAL/HIGH]`
Implementasikan penulisan `PerformanceMetric` (scheduled aggregation harian) + `EventLog` untuk event bisnis (order, payment, shipping). Perbaiki `AnalyticsController` agar revenue **hanya** dari order valid (`whereIn('order_status', ['processing','shipped','delivered','completed'])` atau berdasarkan `payment_status='paid'`), tambah caching, dan set `total_rows` di importer.

### C7 — JNT belum fungsional `[CRITICAL/HIGH]`
Perbaiki `estimateCost` (config `base_rate`/`per_kg_rate` terpisah dari `base_url`, gunakan `destinationCity`), wire ke checkout (`CheckoutController.php:65` `shippingCost:0`). Implementasi `createShipment(Order): ShippingRecord` + path input resi manual admin. Tambah `returned` ke enum `orders.shipping_status` atau map ke status valid. Cascade `order_status=shipped` saat pickup/in_transit.

### C8 — SSRF di download media `[CRITICAL]`
`DownloadProductMedia.php:35` `Http::get($media->source_url)` — allowlist host (Shopee/CDN), blokir IP privat/metadata (`169.254.169.254`, `localhost`), streaming + `max_bytes`, validasi Content-Type/magic bytes, `ShouldBeUnique`, `$tries`/`$timeout`. `ProductMediaController.php:67` batasi host `source_url`.

---

## 4. Temuan Keamanan (menyeluruh)

| Sev | Lokasi | Masalah | Rekomendasi |
|-----|--------|---------|-------------|
| HIGH | `LoginController.php:18` | `Auth::attempt` tanpa rate limit/lockout | `throttle:5,1` + `RateLimiter` |
| HIGH | `UserController.php:31` | `staff` bisa buat `super_admin` (priv-esc) | `UserPolicy`, hanya super_admin kelola role |
| HIGH | `PaymentController.php:37` | `amount` tak divalidasi vs `order.total_amount` | validasi/flag partial payment |
| HIGH | `PaymentController.php:49,69` | `PaymentConfirmed` dispatch tanpa idempotensi → WA dobel | dispatch hanya jika `getOriginal('status')!=='completed'` |
| MED | `ProductMediaController.php:63`, `PageController.php:63` | Upload SVG (XSS) | blok/sanitize SVG, serve dari domain terpisah |
| MED | `SearchController.php:14` | `q` tanpa `max:` → DoS LIKE | `max:100`, escape wildcard |
| MED | `.env.example`, `config/session.php:50` | `APP_DEBUG=true`, `SESSION_ENCRYPT=false` default | `false`/`true` untuk production |
| MED | `CartController.php:31` | `add` tak cek produk visible/variant active | validasi status + stok |
| LOW | `LoginController.php:35` | `intended()` potensi open redirect | validasi URL internal |

Positif: semua form Blade memiliki `@csrf`; webhook di-exclude CSRF dengan benar (harus diganti signature); logout invalidate+regenerate token; outbound WhatsApp selalu tercatat sebelum API call.

---

## 5. Integritas Data & Transaksi

| Sev | Lokasi | Masalah |
|-----|--------|---------|
| CRITICAL | `OrderService.php:59` | `product_id=0` langgar FK |
| HIGH | `OrderService.php:85` | Event dispatch dalam transaksi (bukan `afterCommit`) |
| HIGH | `CartService.php:30` | Fallback harga `min(price)` saat variant invalid; cross-SKU injection (variant milik produk lain) |
| MED | `OrderService.php:91` | `generateOrderNumber()` tanpa retry saat collision |
| MED | `CheckoutController.php:48` | Tanpa idempotency → double-submit = order ganda |
| MED | `PaymentController.php` + `OrderService.php:78` | Payment record ganda (1 dari order + 1 dari admin store) |
| MED | `ProductMediaController.php:86` | `setMain` dua update tanpa transaksi → dua main image |
| LOW | `OrderService.php:18` | `DomainException` cart kosong tak ditangkap → HTTP 500 |
| LOW | Enum mismatch | `payment_method`, `shipping_status` beda antar tabel |

Positif: `createFromCart` memakai `DB::transaction`; cart **di-clear** setelah order sukses (`CheckoutController.php:68`), tidak clear jika gagal (benar).

---

## 6. Performa (query, cache, index)

| Sev | Lokasi | Masalah | Rekomendasi |
|-----|--------|---------|-------------|
| HIGH | `HomeController.php:21` | `popularProducts` = `latest()`, bukan best-seller; **tanpa cache** | agregasi `order_items` + `Cache::remember` 5–15 mnt |
| MED | `HomeController.php:35-49` | N+1 loop 5 model (`first()` per model) | satu query window/subquery |
| MED | `HomeController.php:22` | eager `variants` (semua status), blade `variants->min('price')` | pakai `activeVariants` konsisten |
| HIGH | `CatalogController.php:47-50` | `price_asc/desc/popular` sort by `id`, bukan harga/penjualan | subquery `MIN(price)`/kolom `min_price` |
| HIGH | `CatalogController.php` | form `?q=` di katalog **diabaikan** controller | wire ke filter/SearchController |
| HIGH | `CatalogProductsImport.php:28`, `ShopeeCatalogExport.php:35`, `ShopeeMediaExport.php:31` | `ImportJob::find()` **per baris** | cache di property |
| HIGH | `ProcessCatalogImport.php:76` | `IOFactory::load()` seluruh workbook ke RAM + Excel load lagi | reader streaming |
| HIGH | `DownloadProductMedia.php:46` | body penuh ke memory tanpa limit | stream + max bytes |
| MED | migrations | Tak ada index `products.status`, `product_variants(product_id,status,price)`, FULLTEXT search, unique `product_media(product_id,source_url)` | tambah index |
| MED | `AnalyticsController.php:19` | revenue termasuk order cancelled/pending; tanpa cache | filter status + cache |

---

## 7. Temuan Detail per Modul (termasuk minor)

Referensi lengkap per file (tiap baris diverifikasi). Format `[SEV] file:line`.

### 7.1 Shipping / JNT
- `[CRITICAL]` `ShippingService.php:15` — ternary `estimateCost` selalu 15000.
- `[CRITICAL]` `ShippingService.php:85` + `orders` enum — cascade `returned` = SQL error.
- `[CRITICAL]` app-wide — tidak ada `createShipment`/`ShippingRecord::create` (grep 0 hasil).
- `[HIGH]` `ShippingService.php:11` — `estimateCost` tak dipanggil; `$destinationCity` tak dipakai.
- `[HIGH]` `CheckoutController.php:65` — `shippingCost:0` hardcoded.
- `[HIGH]` `ShippingController.php:17` — webhook tanpa auth/log/validasi/idempotensi; selalu 200.
- `[HIGH]` `ShippingService.php:32` — kontrak `GET /track` + `X-API-Key` tidak realistis JNT; tanpa timeout/retry.
- `[MEDIUM]` `ShippingRecordController.php:34` — flash "disegarkan" walau API gagal.
- `[MEDIUM]` `services.php:63` — `customer_id` tak dipakai.
- `[MEDIUM]` `EventServiceProvider` — tak ada event shipping.
- `[LOW]` `web.php:142` — `{shipping}` vs `{shipping_record}`.
- `[LOW]` `order-status.blade.php` — waybill/tracking tak ditampilkan.
- `[HIGH]` `tests/Feature` — tidak ada test shipping.

### 7.2 Order / Checkout / Cart / Payment / WhatsApp
- `[CRITICAL]` harga & stok (C3), lookup PII (C4) — lihat §3.
- `[HIGH]` listener WA sinkron (`SendOrderCreatedWhatsApp.php`, `SendPaymentConfirmedWhatsApp.php`) — `implements ShouldQueue` + `ShouldDispatchAfterCommit`.
- `[HIGH]` `WhatsAppService.php:58` — HTTP tanpa timeout/retry; `:43` phone tanpa normalisasi; `order_created` hanya item pertama (`:129`).
- `[HIGH]` `CheckoutController.php:33` — phone `max:30` tanpa regex Indonesia/WA.
- `[MEDIUM]` `WhatsAppService.php` webhook tak idempotent (`create` per inbound); status overwrite tanpa state machine.
- `[MEDIUM]` `PaymentController.php:49` — payment confirmed tak set `order_status=processing`.
- `[LOW]` `CheckoutController.php:51` — `payment_method=other` diterima, UI tak punya; `checkout_details` session tanpa TTL.
- `[LOW]` `order-status.blade.php:10` — placeholder `RG-XXXXXX` vs format `RA-XXXXXXXX`.
- `[MINOR]` `Order.php` — `customer_id` tak pernah diisi (tak ada upsert Customer).

### 7.3 Katalog / Produk / Search
- `[HIGH]` sort harga/popular, `?q=` diabaikan (§6).
- `[HIGH]` `Admin/ProductController.php:16` — `orWhere('parent_sku')` tanpa grouping → filter kategori meluber.
- `[MEDIUM]` `ProductVariantController` / `ProductAttributeController` — IDOR (binding global tanpa cek `product_id`); tak ada `destroy`.
- `[MEDIUM]` `Admin/ProductController.php:39` — `category_id` `integer` tanpa `exists`.
- `[MEDIUM]` `SearchController.php:19` — LIKE multi-kolom + `whereHas` lambat; index `attribute_name` tak membantu `attribute_value`.
- `[LOW]` `ProductVariant.php:98` — `in_stock` tak cek `status`.
- `[LOW]` `Product.php:69` — `scopeCategory` dead code; `getMinPriceAttribute` query per produk jika tak eager.
- `[MINOR]` `paginate(12)` magic number berulang (Catalog/Search).

### 7.4 Import / Media
- `[CRITICAL]` `DownloadProductMedia.php:35` — SSRF (C8).
- `[HIGH]` `ProcessCatalogImport.php:18` — tanpa `$tries/$timeout/failed()`; `:76` OOM.
- `[HIGH]` importers — `ImportJob::find()` per baris; tanpa transaksi per baris.
- `[HIGH]` `ShopeeCatalogExport.php:76` — `width_cm/height_cm` di-set tapi kolom tak ada di `products`/`$fillable` → hilang diam-diam.
- `[HIGH]` `ImportJobController.php:81` — `retry()` tak reset counter → dobel.
- `[MEDIUM]` `CatalogProductsImport.php:49` — re-import selalu `status=active` (timpa arsip manual); `category_id` default `0` tanpa validasi.
- `[MEDIUM]` `ImportJob.php:16` — `total_rows` tak pernah di-set.
- `[MEDIUM]` `CorrectionFileExport.php:23` — heading dari baris pertama saja.
- `[MEDIUM]` `BannerController` — hanya index+store (tak ada edit/delete).
- `[LOW]` `ImportJobRow` — tanpa retensi/cleanup.
- `[MINOR]` dead imports di `ShopeeCatalogExport.php:5`, `CatalogProductsImport.php:11`; magic offset `$i-3` di `ShopeeMediaExport`.

### 7.5 Analytics / Dashboard / Performa
- `[CRITICAL/HIGH]` `PerformanceMetric` dead; revenue tak filter status (§2.3, C6).
- `[MEDIUM]` `AnalyticsController.php:40` — `rowFailureRate` selalu 0 (`total_rows` null).
- `[LOW]` `DashboardController` — trend penjualan hardcoded di Blade; tak ada cache pada agregasi.
- `[MINOR]` tak ada timezone eksplisit (`DATE(created_at)` di UTC vs WIB).

### 7.6 Routing / Middleware / Auth / Config
- `[CRITICAL]` C1, C2 (§3).
- `[HIGH]` login rate limit; webhook signature (§4).
- `[MEDIUM]` cart/checkout/lookup throttle; `SESSION_ENCRYPT`, `APP_DEBUG`.
- `[LOW]` `logout` tanpa `auth`; `settings.update` no-op; `banners.index` orphan.
- `[MINOR]` API tanpa `->name()`; `console.php` `inspire`; sidebar link "Log Aktivitas" salah target.

---

## 8. Rencana Penyempurnaan (Roadmap Berfase)

Prinsip: perbaiki **keamanan & integritas data lebih dulu** (tidak mengubah struktur menu/route yang sudah cocok dengan sitemap), lalu fungsi inti, lalu performa & kualitas.

### Fase 0 — Keamanan & Integritas Kritis (P0, ~2–3 hari)
1. **Auth admin** — `EnsureUserIsAdmin` panggil `isAdmin()`; `LoginController` tolak non-admin; `UserPolicy` RBAC role.
2. **API status JSON** — method `statusApi()` + `->name()`; jangan panggil `confirmation`.
3. **Order flow integritas** — revalidasi harga/stok dari DB dalam transaksi + `lockForUpdate`; hapus fallback `product_id=0`; simpan hanya `variant_sku`+`qty` di session.
4. **Privasi pesanan** — wajibkan phone/email (`required_without`) + normalisasi; signed token confirmation; throttle lookup.
5. **Webhook signature** — HMAC WhatsApp (`X-Hub-Signature-256`) + JNT shared secret/IP allowlist; `hash_equals`; throttle + logging.
6. **SSRF media** — allowlist host, blok IP privat, stream + max bytes, `ShouldBeUnique`.
7. **Config production** — `.env.example` `APP_DEBUG=false`, `SESSION_ENCRYPT=true`, dokumentasi deploy.
8. **Enum fix** — tambah `returned` ke `orders.shipping_status` (migration) atau map ke status valid; selaraskan `payment_method`.

### Fase 1 — Fungsi Inti yang Masih Scaffold (P1, ~1 minggu)
1. **JNT ongkir** — perbaiki `estimateCost` (config rate terpisah, pakai kota), wire ke checkout & `total_amount`.
2. **JNT shipment** — `createShipment(Order): ShippingRecord` + input resi manual admin; buat draft `shipping_records` saat ready_to_ship.
3. **Shipping cascade & event** — `order_status=shipped` saat handoff; `ShippingStatusUpdated` → listener WhatsApp `order_shipped`/`order_delivered`; `EventLog` audit.
4. **Queue WhatsApp** — listener `ShouldQueue` + `afterCommit`; timeout/retry; normalisasi nomor terpusat; idempotensi webhook & `PaymentConfirmed`.
5. **Payment** — validasi `amount` vs total; set `order_status=processing`; cegah payment ganda.

### Fase 2 — Performa Toko & Query (P2, ~1 minggu)
1. **PerformanceMetric** — scheduled command agregasi harian (orders valid, revenue, konversi, top kategori) + `EventLog` sebagai sumber event.
2. **AnalyticsController** — filter status valid, caching, timezone WIB, set `total_rows` di importer.
3. **Home & katalog** — `Cache::remember`; `popularProducts` dari `order_items`; sort harga via `MIN(price)`; wire `?q=`; hilangkan N+1.
4. **Index DB** — `products.status`, `product_variants(product_id,status,price)`, FULLTEXT search, unique `product_media(product_id,source_url)`.
5. **Import pipeline** — cache `ImportJob`, transaksi per baris, reset counter saat retry, `$tries/$timeout/failed()`, reader streaming, kolom dimensi.

### Fase 3 — Kualitas, Konsistensi, Kelengkapan (P3, ongoing)
1. Idempotency place-order, retry order_number, catch `DomainException`.
2. Lengkapi CRUD (banner edit/delete, media/variant/attribute destroy, settings form atau hapus route).
3. Rate limit cart/checkout; validasi upload (mimes eksplisit, strip EXIF, blok SVG).
4. Feature tests: shipping webhook, refresh, cascade, checkout harga/stok, auth role.
5. Rapikan: dead code/imports, magic number → config, param route konsisten, `console.php`, dokumentasi enum.
6. Sinkronkan `docs/` & `skills/stage-*` dengan realita implementasi (atau tutup gap).

---

## 9. Quick Wins (dampak tinggi, usaha rendah)

| Aksi | File | Waktu |
|------|------|-------|
| Tambah `isAdmin()` di middleware | `EnsureUserIsAdmin.php` | 5 mnt |
| `throttle:5,1` pada login | `web.php` / `bootstrap/app.php` | 10 mnt |
| Wajibkan phone/email pada lookup | `OrderController.php` | 15 mnt |
| Fix ternary `estimateCost` | `ShippingService.php` | 10 mnt |
| `.env.example` debug/encrypt | `.env.example`, `config/session.php` | 5 mnt |
| Filter status revenue analytics | `AnalyticsController.php` | 15 mnt |
| Idempotensi `PaymentConfirmed` | `PaymentController.php` | 15 mnt |
| Placeholder order number `RA-` | `order-status.blade.php` (repo UI) | 5 mnt |

---

## 10. Catatan Repo & Lampiran

- **Repo split:** backend `d:\website_3.0`; UI/Blade `d:\website_2.0` (junction `resources`). Perbaikan yang menyentuh Blade (mis. placeholder order, `variants->min('price')`) dilakukan di `website_2.0`.
- **Route/sitemap:** tidak ada route hilang; jangan ubah struktur menu tanpa update `config/sitemap.php` + `logic/`.
- **Verifikasi:** temuan CRITICAL dikonfirmasi via pembacaan sumber + grep (`isAdmin()` hanya di definisi; `PerformanceMetric`/`estimateCost`/`ShippingRecord::create` tanpa pemanggil).

### File utama yang diaudit
`routes/{web,api,console}.php` · `bootstrap/app.php` · `app/Http/Middleware/EnsureUserIsAdmin.php` · `app/Http/Controllers/**` · `app/Services/{Cart,Order,Shipping,WhatsApp}Service.php` · `app/Jobs/{ProcessCatalogImport,DownloadProductMedia}.php` · `app/Imports/**` · `app/Events/**` · `app/Listeners/**` · `app/Models/**` · `config/{services,session}.php` · `database/migrations/**`

> **Langkah berikut:** setujui roadmap ini, lalu implementasi mulai **Fase 0**. Setiap perubahan perilaku wajib mengikuti format laporan di `AGENTS.md`.

---

## 8. Implementation Log (2026-07-12)

Semua temuan **kecuali C1** telah dikerjakan. C1 (middleware admin tanpa cek role) **sengaja dipertahankan** atas keputusan pemilik: staf saling membackup pekerjaan. Verifikasi: `php artisan test` → **14 passed (42 assertions)**.

| # | Temuan | Status | Perubahan utama |
|---|--------|--------|-----------------|
| C2 | API status return HTML | ✅ | `OrderController@statusApi` (JSON) + `routes/api.php` diarahkan ulang |
| C3 | Harga/stok tak divalidasi | ✅ | `OrderService::createFromCart` revalidasi harga & stok dari DB, `lockForUpdate`, kurangi stok, FK `product_id` valid, retry nomor order |
| C4 | Privasi lookup order | ✅ | `statusLookup`/`statusApi` wajib phone/email (`required_without`) + normalisasi; confirmation dijaga token session; throttle |
| C5 | Webhook tanpa signature | ✅ | JNT: `digest` = Base64(MD5(bizContent+privateKey)); WhatsApp: HMAC `X-Hub-Signature-256`; idempotensi; throttle |
| C6 | Performa toko | ◑ | Analytics: revenue hanya status valid + cache; agregat import dari seluruh job. `PerformanceMetric` scheduled aggregation = sisa (lihat catatan) |
| C7 | JNT Cargo | ✅ | Integrasi penuh sesuai spec resmi — lihat `docs/jnt-cargo-integration.md` |
| C8 | SSRF media | ✅ | `UrlGuard` (allowlist host + blok IP privat), streaming ke temp, `max_bytes`, MIME check, `ShouldBeUnique`, `$tries/$timeout/backoff` |

**Lain-lain yang dikerjakan:** ongkir di-wire ke checkout & `total_amount`; `ShippingStatusUpdated` event + listener WhatsApp (`order_shipped`/`delivered`/`returned`); listener WA `ShouldQueue` + `afterCommit`; idempotensi `PaymentConfirmed` + cascade `order_status`; login throttle (RateLimiter per email+IP); throttle checkout/lookup/webhook; migration `shipping_status` fleksibel (dukung `returned`); index `orders.created_at`; sort katalog harga (`MIN(price)`) & populer (`order_items` count); normalisasi telepon terpusat (`App\Support\PhoneNumber`); **penamaan produk mengikuti xlsx Shopee persis** (tidak tertimpa sel kosong baris varian); `ProcessCatalogImport` `$tries/$timeout/failed()`.

**Sisa (rekomendasi lanjutan, prioritas rendah):**
- `PerformanceMetric` scheduled command agregasi harian (visitor/konversi) — tabel & kontrak sudah ada; butuh sumber event visitor.
- Transaksi per-baris + reset counter saat retry di importer (saat ini increment per baris = N query; fungsional, belum dioptimasi).
- FULLTEXT index untuk search; strip EXIF/blok SVG pada upload; RBAC granular bila kebijakan C1 berubah.

### Catatan strategi media (jawaban atas pertanyaan pemilik)
Gambar Shopee **diunduh & disimpan sebagai salinan kanonik** di disk `media` (`stored_url` untuk tampilan; `source_url` hanya arsip). Ini sudah cukup dan **lebih aman** daripada hotlink langsung ke URL Shopee (risiko: link berubah/mati, hotlink-block, kehilangan kontrol, potensi ToS). **Belum perlu** database eksternal seperti Supabase pada fase ini — filesystem/disk (lokal atau S3-compatible via `config/filesystems`) sudah memadai; migrasi ke object storage cukup mengubah disk `media` tanpa mengubah kode. Supabase baru relevan bila butuh CDN global + auth storage; bisa jadi opsi lanjutan, bukan keharusan sekarang.
