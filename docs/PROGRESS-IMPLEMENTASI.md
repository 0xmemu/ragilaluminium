# PROGRESS IMPLEMENTASI SPESIFIKASI-FINAL (2026-08-09)

Dokumen log pengerjaan. Setiap perubahan terdokumentasi di sini sebelum/ketika di-deploy.
Referensi keputusan bisnis: KEPUTUSAN-BISNIS-2026-08-08.md dan SPESIFIKASI-FINAL.md (dokumen induk di D:\website_5.0\_analisa).

## FASE 1 — Fondasi Harga & Kampanye ✅
Migrations promotions/promotion_items + status produk active|archived + enum return_completed; models Promotion/PromotionItem; PriceService (bandrol, rounding Rp1.000, FS menggantikan Promo); CampaignService (1 promo/produk, 1 FS aktif, FS > Diskon Produk, konfirmasi dampak, duplikat/akhiri/aktifkan + log); patch scopeVisible, validasi status produk/order; CampaignService singleton. Smoke test penuh PASS.

## FASE 2 — Admin Produk ✅ (lengkap, 2026-08-09)

### Migrations
- `2026_08_08_040000_create_sub_models_table.php` — tabel `sub_models` (product_model, code, name, description, image_url, sort_order, is_active; unique per (product_model, code)) + seed 6 desain legacy × 5 model = 30 baris.
- `2026_08_08_040100_change_product_design_variant_to_string.php` — `products.design_variant` dari enum → string nullable (persiapan sub model bebas).

### Sub model bebas (Keputusan #13)
- Model `app/Models/SubModel.php` (MODELS, scope active/forModel, relasi products via design_variant+product_model).
- `app/Http/Controllers/Admin/SubModelController.php` — index (tab per model, urut, count produk aktif), create/edit/store/update (kode dinormalisasi huruf besar + `-`/spasi → `_`, unik per model dengan pesan khusus, kode read-only saat edit), toggle aktif, reorder; log `product.sub_model_*`.
- Routes `admin/sub-models*` (7 route) + use import; menu admin **Sub Model** di grup Produk (config/admin-sitemap.php).
- Halaman `resources/js/pages/Admin/SubModels.tsx` (tab model, panah ↑↓ urut + Simpan Urutan, toggle aktif, gambar, count produk) & `SubModelForm.tsx`.
- `CatalogLabels::design()` → label dari sub_models aktif (cache 1 jam) fallback map legacy; `designCodes(?model)` dinamis; storefront tak berubah (daftar design dihitung dari data produk).

### Produk
- Pagination daftar 20 → 14/halaman (Keputusan #16).
- Pencarian ukuran: parser "100x50", "T100xP50", "Tinggi 100 Panjang 50", "120x60x45" → AND-filter varian aktif (lebar×tinggi 2 arah, kedalaman opsional).
- Aksi **Salin** produk: POST `admin/products/{product}/duplicate` → produk baru active + "(Salinan)", SKU baru, varian disalin (stok 0), atribut disalin, log `product.duplicated`; tombol di ⋮ menu.
- Nama produk unik termasuk arsip (Rule::unique, ignore id saat update).
- Form: default status **active** (bug draft lama diperbaiki — draft sudah dihapus dari enum), tombol **Simpan & Aktifkan / Simpan & Arsipkan**, field "Sub model" dinamis per model terpilih + opsi "Tanpa sub model", teks UI bebas-draft, peringatan keluar (beforeunload) saat form dirty.
- Validasi produk: `design_variant` nullable + harus terdaftar di sub_models model yang sama.

### Verifikasi (smoke test di server, PASS semua)
- Seed 30; label legacy tetap; buat JALUSI_BARU (kode dinormalisasi, sort=60, aktif); duplikat per model ditolak (pesan khusus); kode sama beda model boleh; reorder OK; produk JUNGKIT+JALUSI_BARU valid, KACA_MATI+JALUSI_BARU ditolak, null valid; 0 produk dengan design_variant tak terdaftar; data uji dibersihkan.
- Halaman: /products 200, /products/jendela/sliding/ornamen 200, /admin 302.
- Build frontend sukses.

## FASE 3 — Kampanye (belum mulai)
CRUD Promo Toko + Flash Sale (controller, routes, sidebar, halaman Vue) + integrasi storefront.


## FASE 3 → Kampanye Promo Toko & Flash Sale → (lengkap, 2026-08-09)

### Admin (CRUD kampanye)
- `app/Http/Controllers/Admin/PromotionController.php` → index (tab tipe store/flash_sale), create/store (draft), edit/update (saveItems delete+recreate), impact (JSON `affectedCounts` untuk konfirmasi dampak), activate (starts_at masa depan → scheduled, else active), end, duplicate via CampaignService, row mapping dengan targetLabel; formOptions (model/subModel/product) dinamis per tipe; `discount_percent` wajib 1-90.
- Routes `admin/promotions*` (9 route) + use import. Sitemap admin: **Promo Toko** → `admin.promotions.index` (icon ticket, active `admin.promotions.*`/`admin.banners.*`); **Flash Sale** → `admin.promotions.index?type=flash_sale` (icon lightning).
- Halaman `resources/js/pages/Admin/Promotions.tsx` (tab tipe, tabel nama/periode/status/diskon, ActivateAction → fetch `impact_url` POST JSON → ConfirmAction, Duplikat, Akhiri) & `PromotionForm.tsx` (info kampanye, periode datetime-local, target model/sub_model/product + exclude + override % per target, Switch sinkronisasi banner).
- Bug diperbaiki: `event_logs.entity_id` NOT NULL → log pakai id baris pertama; `Rule::unique()->withMessage()` tidak ada → pesan custom lewat array `$messages`.

### Integrasi storefront (PriceService/CampaignService sebagai sumber harga tunggal)
- `CampaignService`: + `flashProductIds()`, `promoProductIds()`, `flashPeriod()` (dari kampanye live).
- `FlashSalePeriodSettings::get()`: periode/`publicState()` kini diambil dari kampanye FS live (fallback pengaturan CMS lama bila tidak ada kampanye).
- `InertiaCatalog::productCard()`/`sizeCard()`: harga via `PriceService` (bandrol, sale, compare, diskon, flash_sale); varian spesifik → `forVariant()`; `applyVariantPromotion` (legacy) dihapus. `flashSaleProductCards()`: dari kampanye FS (fallback atribut legacy bila tidak ada kampanye).
- `CatalogController`: listing `promo` & flash → `promoProductIds()`/`flashProductIds()` (fallback legacy); pagination 24 → **14/halaman** (Keputusan #16).
- `CartService::priceFor()`: via `PriceService` (unit_price = sale, compare = bandrol, flash_sale); tanpa varian pakai min sale.
- PDP `ProductController::show()`: blok `promo` dari `PriceService::productCard()` (fallback legacy utk COD/garansi; min_price dihitung dari varian yang terfilter dimensi); tiap varian + `sale_price`, `compare_price`, `flash_sale`.
- Frontend `ProductDetail.tsx`: harga tampil = `sale_price` varian (fallback `price`/`promo.min_price`), compare/discount dari varian bila terpilih; schema.org price = sale.
- Type `ProductVariant` + `sale_price`/`compare_price`/`flash_sale`.
- `HomepagePromotions` (auto-banner lama berbasis atribut) dipertahankan apa adanya; banner kampanye dikelola via admin Promo (switch banner).
- Atribut legacy `promo_flash_sale`/`promo_compare_price` tidak dimigrasi & tidak dibaca untuk harga (hanya fallback listing bila kampanye kosong).

### Verifikasi (smoke test di server, PASS semua)
- Admin: store draft + 3 item (model, sub_model+override 20, product exclude) → activate → FS 15% vs Promo 15% ditolak → duplicate → end → store baru valid setelah ended; cleanup 0.
- Storefront (39 cek): baseline tanpa kampanye = bandrol/legacy; kampanye FS (sub_model, 20%) → publicState live, ids tercakup, sale = roundUp(80%), kartu/cart/PDP konsisten; Promo Toko (product, 10%) tanpa overlap → source=store; overlap FS menang; endEarly → fallback CMS; GET /, /flash-sale, /promo 200; cleanup 0.
- PDP (16 cek): baseline = bandrol; kampanye → promo.min_price = min sale, varian sale_price = roundUp(80%), compare = bandrol, flash_sale true; GET PDP 200 + payload `sale_price`; cleanup 0.
- Build frontend sukses.


## FASE 4 → Nomor Order Berurutan + Edit Pesanan Admin → (lengkap, 2026-08-09)

### Nomor order (Keputusan #14)
- Migration `2026_08_09_010000_create_order_number_sequences_table.php` → tabel `order_number_sequences` (sequence_key unique, seq) + model `app/Models/OrderNumberSequence.php`.
- `app/Services/SequenceService.php` → `next($key)` (row lock + increment dalam transaksi, anti-bentrok) & `current($key)`.
- `OrderService::generateOrderNumber()` → `RA-{ymd}-{seq4}` (contoh `RA-260808-0001`); key per hari `order-{Ymd}` → nomor reset setiap hari, tidak pernah dipakai ulang.

### Edit pesanan (Keputusan #7 & #23)
- `OrderService::editPolicy(Order)`: **MK** bebas tanpa catatan; **processing** wajib catatan; **terkunci** bila status cancelled ATAU sudah ada resi (`shipping_records.waybill_number` non-cancelled); mengembalikan `allowed`/`require_note`/`reason`.
- `OrderService::editOrder(Order, data, actorUserId, note)`: transaksi + lockForUpdate; update qty baris lama / tambah baris baru (via `item_id` atau `parent_sku`+`variant_sku`) / hapus baris (stok dikembalikan); stok decrement = delta qty per baris; voucher di-recalc (di-drop bila tak valid, tercatat); fee COD dihitung ulang; ongkir via `ShippingService::estimateBreakdown` + `cartWeightForLines()`; harga satuan tidak diubah (harga beli saat order dibuat); persist order + log `EventLog order.edited` (note/changes/subtotal/shipping/voucher/cod_fee/total/voucher_dropped).
- `WhatsAppService`: `sendOrderConfirmation()` dibuat publik (dipakai checkout & kirim ulang); `notifyOrderEdited()` (try/catch aman, log warning bila gagal).
- `Admin\OrderController`: + `updateItems()` (validasi lengkap, cek `editPolicy`, catch DomainException, kirim ulang WA, redirect sukses); payload `admin/orders/{order}` + `editPolicy` + `editUrl`; constructor + `WhatsAppService`.
- Route `PUT admin/orders/{order}/items` → `admin.orders.items.update`.
- Frontend `resources/js/pages/Admin/Orders/Show.tsx`: komponen `OrderEditPanel` (qty + tambah produk via SKU induk/varian, alamat, catatan, wajib isi catatan edit saat processing, submit `form.put(editUrl)`); tombol "Edit pesanan"/label "Terkunci" di SectionCard isi pesanan.

### Verifikasi (smoke test di server, PASS semua 36 cek)
- Sequence 1-3 berurutan; format `RA-{ymd}-0001`; dua nomor beda.
- Policy MK bebas; edit MK tanpa note OK (qty + tambah baris varian produk lain): stok A/B/C decrement sesuai delta, item 3, subtotal & total dihitung ulang, alamat/notes berubah, order_number tetap, log `order.edited` tercatat.
- Hapus baris → stok dikembalikan; status processing → note wajib (tanpa note ditolak, dengan note OK); resi masuk → policy locked + edit ditolak; `notifyOrderEdited` aman.
- Route PUT + controller terdaftar; GET / 200; cleanup 0 + stok varian direstore.
- Build frontend sukses.


## FASE 6 → Performa Toko: KPI Model/Sub Model Terjual → (2026-08-09)

### Perubahan
- `app/Services/StorePerformanceService.php`:
  - KPI `models_sold` (sebelumnya `COUNT(DISTINCT product_id)` = jumlah produk berbeda) diubah menjadi **jumlah pasangan (model, sub model) berbeda** yang laku di periode → join `order_items` → `products`, distinct `product_model || '|' || COALESCE(design_variant, '')` (Keputusan #17).
  - Label KPI: `"Jumlah Model Produk"` → `"Model/Sub Model Terjual"`.
  - Tetap hanya dari order berstatus revenue (`processing`/`shipped`/`delivered`/`completed`); order batal/pending tidak dihitung.

### Verifikasi (smoke test di server, PASS semua)
- Label KPI = "Model/Sub Model Terjual".
- 3 produk (JUNGKIT|ORNAMEN, JUNGKIT|POLOS, SLIDING|ORNAMEN) → 3 pasangan dari 2 model (dimensi sub model dihitung).
- Produk sama di 2 order tetap 1 pasangan (dedup); order `cancelled` tidak dihitung.
- Build frontend sukses; halaman `/admin/analytics/store-performance` terdaftar.


## FASE 6A → Performa Toko: Perbandingan Periode "Jam Sama" + Tren Pengunjung + Granularity Tahun (2026-08-09)

### Perubahan
- `app/Services/StorePerformanceService.php`:
  - **Fix bug durasi perbandingan**: Carbon 3 `diffInSeconds` default `absolute=false` sehingga `$end->diffInSeconds($start)` bertanda negatif dan `max(1, ...)` selalu menghasilkan 1 detik (window pembanding selama ini hanya 1 detik). Diperbaiki dengan menghitung dari `$start` ke `$end` + `round()`; `is_running` dipindah ke return `resolveRange()` dan dipakai di payload.
  - **Perbandingan periode berjalan (spec ??G)**: bila `$now < $end`, periode sebelumnya dipotong di **jam yang sama** (`$previousFrom = $start - fullSeconds`, `$previousTo = previousFrom + elapsed - 1`); bila periode selesai, bandingkan penuh. Berlaku untuk `today`, `last_7`, `this_month`, `this_year`, `all`, dan `custom`.
  - **Chart kedua "Tren Pengunjung"**: `series('visitors')` membaca `PerformanceMetric.storefront_unique_visitors` per hari (`'hour'` di-fallback ke `'day'`); chart `orders` diganti menjadi `visitors` di urutan `[revenue, visitors, units]`.
  - **Granularity `year`**: ditambahkan ke `bucketSelect` (SQLite `strftime('%Y')` / MySQL `DATE_FORMAT(...,'%Y')`), `emptyBuckets` (blok per tahun), whitelist granularity, dan payload.
  - Payload: `range.is_running`, `range.compare_from_date`, `range.compare_to_date`.
- `app/Http/Controllers/Admin/AnalyticsController.php`: `granularityOptions` + "Per Tahun".
- `resources/js/pages/Admin/Analytics/StorePerformance.tsx`: tipe `range` diperluas (`compare_from_date`, `compare_to_date`, `is_running`); label granularity + tahun (ternary); **banner** "Perbandingan dengan: {compare_label}" di bawah chip periode; **footer** "Keterangan perbandingan..." di bawah payment mix.

### Verifikasi (smoke test di server, 18/18 PASS)
- `today`/`last_7`/`this_month` berjalan → prev dipotong di jam sama (exact detik); `yesterday`/`custom` selesai → prev penuh (86400s / 31 hari).
- Order nyata: kemarin 09:00 + 11:00, hari ini 09:00 → KPI orders hari ini = 1, prev (kemarin s.d. jam sama, jam 19) = 2.
- Granularity `year` → bucket `2026`; `series visitors` = 7 bucket hari, `hour` → fallback `day`.
- Payload: chart `[revenue, visitors, units]`, `is_running=true`, `compare_*_date` terisi.
- Cleanup: data uji dihapus, stok varian direstore.


## FASE 5 → Dashboard & Navigasi: Notifikasi Admin + Bottom Nav Mobile → (2026-08-09)

### Notifikasi admin (spec ??F)
- Migration `2026_08_09_020000_create_admin_notifications_table.php` → `admin_notifications` (type, title, body, order_id FK nullOnDelete, href, read_at, timestamps) + model `App\Models\AdminNotification` (scope `unread`).
- Event `App\Events\OrderCancelled` (order + reason) → di-dispatch dari `OrderService::cancel()` setelah transisi sukses.
- Listener `App\Listeners\CreateAdminNotifications` (method `notify*`, bukan `handle*` agar tidak double-fire oleh event auto-discovery Laravel 11):
  - `OrderCreated` → **"Pesanan Baru {order_number}"** (customer, kota, total, href detail order).
  - `ShippingStatusUpdated` → hanya `delivered` → **"Pesanan Sampai"**.
  - `OrderCancelled` → **"Pesanan Dibatalkan"** (alasan opsional).
- `Admin\NotificationController`: `index` (daftar 100 terbaru by id, opsi filter unread, `markAllReadUrl`), `markRead` (POST), `markAllRead` (POST).
- Routes `admin/notifications*` (3 route); item menu **Notifikasi** di sitemap admin grup core (ikon bell).
- Shared props `HandleInertiaRequests`: `adminNotificationCount` (lazy, unread count) + `adminNotifications` (12 terbaru) → hanya saat login.
- Frontend:
  - `components/admin/notification-bell.tsx` → lonceng di header admin-layout: badge unread, dropdown 12 terbaru, tandai dibaca saat klik, "Tandai semua dibaca", "Lihat semua".
  - `pages/Admin/Notifications.tsx` → daftar lengkap: tab Semua/Belum dibaca, badge, tandai dibaca per item / semua.
- Ikon `bell` ditambahkan ke registry `components/shared/icon.tsx` (Phosphor).

### Bottom nav mobile (spec ??F)
- `components/admin/admin-bottom-nav.tsx` → fixed bottom (`lg:hidden`): Dashboard / Pesanan / Produk + tombol **Menu** (buka sheet navigasi penuh = hamburger semua grup Harga & Promo, Komunikasi, Monitoring, Pengaturan Website, Akun). Indikator garis aktif, safe-area padding.
- Konten admin diberi padding bawah di mobile (`pb-24`) agar tidak tertutup nav.

### Verifikasi (smoke test di server, PASS semua 18 cek)
- OrderCreated → notif baru (judul, href, unread); unread count naik.
- ShippingStatusUpdated delivered → notif "Sampai"; transisi non-delivered tidak membuat notif.
- OrderCancelled (dispatch nyata) → notif "Dibatalkan" dengan alasan; `OrderService::cancel` → notif + stok dikembalikan.
- markRead / markAllRead menurunkan unread; urutan `latest('id')` stabil (created_at tie-safe).
- GET /admin/notifications 200; cleanup 0.
- Build frontend sukses.

