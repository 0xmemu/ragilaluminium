# API & Routes - Ragil Aluminium Website

**Generated 2026-08-16 from `php artisan route:list`.**
Canonical route map; do not add ad-hoc endpoints outside the documented modules.

Total: 320 routes (regenerated 2026-08-16).

## 1. Public Storefront

- `GET /` -> `HomeController@index`  (name: `home`)
- `GET /about` -> `PageController@about`  (name: `about`)
- `GET /api/catalog/{category}` -> `Closure`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/health/ready` -> `ReadinessController`  (name: `health.ready`)  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/orders/{order_number}/status` -> `OrderController@statusApi`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/products/{parent_sku}` -> `ProductController@show`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/search` -> `SearchController@index`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
  - Response menambah metadata `search` (original/normalized/changed/replacements),
  - `dimension` (exact/range, orientasi Tinggi × Panjang), `nearest_sizes`, dan `suggestions`
  - (lihat PRODUCT-HANDOFF §8.3.1). Query asli selalu dipertahankan di `query`.

- `GET /api/wilayah/districts/{regencyId}` -> `WilayahController@districts`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/wilayah/provinces` -> `WilayahController@provinces`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/wilayah/regencies/{provinceId}` -> `WilayahController@regencies`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/wilayah/villages/{districtId}` -> `WilayahController@villages`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- Wilayah village payload items expose id, name, and nullable postal_code; the active versioned postal dataset populates postal_code when available.
- `GET /cara-pemesanan` -> `PageController@howToOrder`  (name: `cara-pemesanan`)
- `GET /cart` -> `CartController@index`  (name: `cart.index`)
- `POST /cart/add` -> `CartController@add`  (name: `cart.add`)
- `GET /cart/count` -> `CartController@count`  (name: `cart.count`)
- `GET /cart/preview` -> `CartController@preview`  (name: `cart.preview`)
- `POST /cart/remove` -> `CartController@remove`  (name: `cart.remove`)
- `POST /cart/remove-selected` -> `CartController@removeSelected`  (name: `cart.remove-selected`)
- `POST /cart/restore` -> `CartController@restore`  (name: `cart.restore`)
- `POST /cart/select` -> `CartController@select`  (name: `cart.select`)
- `POST /cart/update` -> `CartController@update`  (name: `cart.update`)
- `GET /checkout` -> `CheckoutController@index`  (name: `checkout.index`)
- `POST /checkout/place-order` -> `CheckoutController@placeOrder`  (name: `checkout.place-order`)  [Illuminate\Routing\Middleware\ThrottleRequests:10,1]
- `POST /checkout/validate` -> `CheckoutController@validateDetails`  (name: `checkout.validate`)
- `POST /checkout/last-details` -> `CheckoutController@lastDetails`  (name: `checkout.last-details`, throttle 20/menit; prefill detail pengiriman dari order terakhir per HP)
- `POST /checkout/voucher` -> `CheckoutController@applyVoucher`  (name: `checkout.voucher.apply`)  [Illuminate\Routing\Middleware\ThrottleRequests:20,1]
- `POST /checkout/voucher/remove` -> `CheckoutController@removeVoucher`  (name: `checkout.voucher.remove`)
- `POST /consultation/whatsapp` -> `ConsultationController@send`  (name: `consultation.whatsapp.send`)  [Illuminate\Routing\Middleware\ThrottleRequests:10,1]
- `GET /contact` -> `PageController@contact`  (name: `contact`)
- `GET /faq` -> `PageController@faq`  (name: `faq`)
- `GET /flash-sale` -> `CatalogController@flashSale`  (name: `catalog.flash-sale`)
- `GET /hasil-pemasangan` -> `PageController@installations`  (name: `installation.index`)
- `GET /hasil-pemasangan/{category}/{model}` -> `PageController@installationModel`  (name: `installation.model`)
- `GET /hasil-pemasangan/{parent_sku}` -> `PageController@installationShow`  (name: `installation.show`)
- `GET /login` -> `Auth\LoginController@showLoginForm`  (name: `login`)
- `POST /login` -> `Auth\LoginController@login`  (name: `login.post`)  [Illuminate\Routing\Middleware\ThrottleRequests:20,1]
- `POST /logout` -> `Auth\LoginController@logout`  (name: `logout`)
- `GET /masalah-dan-solusi` -> `PageController@problemsSolutions`  (name: `masalah-dan-solusi`)
- `GET /order/count` -> `OrderController@count`  (name: `order.count`)
- `GET /order/status` -> `OrderController@statusForm`  (name: `order.status`)
- `POST /order/status` -> `OrderController@statusLookup`  (name: `order.status.lookup`)  [Illuminate\Routing\Middleware\ThrottleRequests:15,1]
- `GET /order/{order_number}/confirmation` -> `OrderController@confirmation`  (name: `order.confirmation`)
- `GET /policy/privacy` -> `PageController@privacy`  (name: `privacy`)
- `GET /policy/terms` -> `PageController@terms`  (name: `terms`)
- `GET /product/{parent_sku}` -> `ProductController@show`  (name: `product.show`)
- `POST /product/{product}/engage` -> `ProductEngagementController@store`  (name: `product.engage`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]
- `GET /products` -> `CatalogController@index`  (name: `catalog.index`): hub "Semua Model Produk" (kartu kategori x model). Query `sort=latest|oldest` mengubah urutan kartu (default: urutan manual admin `sort_order` CMS); nilai sort lain dialihkan ke `catalog.all`.
- `GET /products/all` -> `CatalogController@all`  (name: `catalog.all`)  `sort=popular` mengikuti urutan kurasi admin bila `from=paling-banyak-dipesan` (halaman Lihat Semua carousel Paling Banyak Dipesan); tanpa penanda tetap murni skor penjualan.
- `GET /products/{category}` -> `CatalogController@categoryShow`  (name: `catalog.category`)
- `GET /products/{category}/{model}` -> `CatalogController@modelShow`  (name: `catalog.model`)
- `GET /products/{category}/{model}/{design}` -> `CatalogController@designShow`  (name: `catalog.design`)
- Ukuran halaman katalog menyesuaikan perangkat (kontrak owner 2026-09-18). Desktop memakai
  `storefront.catalog_page_size` (default 15 kartu, pas untuk grid 3 kolom sm/md dan 5 kolom xl).
  Telepon memakai `storefront.catalog_page_size_mobile` (default 16 kartu; pada grid 2 kolom berarti
  8 baris penuh tanpa kartu menggantung). Urutan keputusan di server:
  1. Query `per_page` dari klien. Klien yang mengukur lebar viewport sendiri paling akurat, jadi
     nilai resmi yang dikirimnya menang. Dipakai saat jendela desktop dipersempit atau telepon
     diputar ke lanskap.
  2. User-Agent telepon, supaya pelanggan HP menerima 16 kartu SEJAK RENDER PERTAMA tanpa permintaan
     ulang dan tanpa URL berisi parameter. Pelanggan memakai satu perangkat secara konsisten, jadi
     sinyal ini stabil untuk mereka. Tablet Android (`Android` tanpa `Mobile`) dan iPad TIDAK
     dihitung telepon karena lebarnya masuk grid 3 kolom (15 kartu pas).
  3. Default config (desktop, 15 kartu).
  Nilai `per_page` di luar dua ukuran resmi itu diabaikan dan halaman kembali ke ukuran default.
- Respons listing katalog (Inertia maupun `/api/catalog/{category}`) membawa `pagination.per_page`,
  dan prop `catalogPageSize` berisi `{ desktop, mobile }` sebagai satu-satunya sumber angka resmi
  untuk klien. Query `per_page` hanya mengubah UKURAN halaman, tidak pernah mengubah isi atau urutan.
- Canonical category slug is always Indonesian: `jendela` / `pintu` / `boven`.
- Legacy English aliases `window|windows|door|doors|bouven` under `/products/...` are no longer routes; they `301` (moved permanently) to the canonical Indonesian slug so there is no duplicate content:
  - `GET /products/windows` -> `301 /products/jendela`; `GET /products/doors` -> `301 /products/pintu`; `GET /products/bouven` -> `301 /products/boven`.
- Top-level `GET /windows`, `GET /doors`, `GET /bouven` no longer exist (404) and are not re-added.
- `GET /promo` -> `CatalogController@promo`  (name: `catalog.promo`)
- `GET /reviews/web` -> `PageController@reviewsWebsite`  (name: `reviews.website`)
  - Tiga pill filter di halaman ini (berlaku mobile dan desktop): urutan, Foto/Video, dan Bintang.
  - Query param filter (semuanya bisa dipakai bersamaan, HANYA di route ini):
    - `model` = `KATEGORI|MODEL` (mis. `WINDOW|JUNGKIT`). Format salah diabaikan, tidak memfilter. Tidak ada kontrol UI untuk ini; parameternya tetap dibawa agar URL lama tidak kehilangan filter saat pembeli mengganti filter lain.
    - `rating` = satu nilai (`4`) atau daftar dipisah koma (`4,5`). Hanya `1`..`5` yang diterima; nilai lain, duplikat, dan nilai kosong dibuang. Tanpa nilai sah berarti tanpa filter rating.
    - `media_only` = `1` untuk hanya ulasan yang punya foto atau video.
    - `sort` = `newest` atau `oldest`. Selain itu (termasuk kosong) berarti urutan bawaan halaman, yaitu `sort_order` admin lalu terbaru.
  - Opsi filter rating (`ratingNav`) dihitung dari basis SESUDAH filter model dan filter media, tetapi TANPA filter rating, sehingga jumlah tiap rating tetap terbaca saat salah satu rating dipilih. Hanya rating yang punya ulasan tayang yang ditawarkan, urut menaik dari 1 bintang.
  - Statistik `stats.website_total` dan `stats.average_rating` MENGIKUTI filter yang aktif, supaya angka pada pill filter konsisten dengan daftar yang tampil.
  - Bentuk satu ulasan pada props storefront (dipakai kartu ulasan di `/reviews/web`, `/reviews/ss`, carousel beranda, dan popup ulasan halaman produk): `id`, `customer_name`, `message`, `rating`, `source`, `location`, `created_at`, `variant_label`, `image_url`, `images`, `media`, `verified_purchase`, `admin_reply`, `admin_replied_at`, dan `product`.
  - `created_at` = waktu ulasan dibuat, format ISO 8601. Kartu ulasan menampilkannya di samping kota, bersama nama produk dan varian, pada ukuran 11px.
  - `variant_label` = varian yang dipilih pembeli, dibaca dari `order_items` pesanan terkait lalu digabung dengan pemisah ` · ` (mis. `Warna: Putih · Kaca: Kaca Es`). Bernilai null pada ulasan yang tidak tertaut pesanan (mis. ulasan buatan admin), dan kartu cukup tidak menampilkannya. Sumbernya `order_items`, bukan kolom di `cms_testimonials`, karena pilihan varian hanya hidup di baris pesanan. Schema tidak berubah karena itu.
  - `product.name` = nama pendek (`short_name`), sedangkan `product.line` = label garis produk dari kategori, model, dan sub-model (`design_variant`), mis. `Jendela Jungkit Ornamen`, dihitung oleh `CatalogLabels::productLine()`. Kartu ulasan memakai `line`. Judul katalog lengkap tidak dipakai karena memuat dimensi seperti `Tinggi 200cm x Panjang 180cm (200x180)` sehingga barisnya panjang dan tidak membantu pembeli mengenali model.
  - Pemakaian `media_only` disaring di PHP, bukan dengan klausa JSON pada SQL: kolom media bertipe json dan perilakunya berbeda antara MySQL (produksi) dan SQLite (test). Karena itu daftar dibentuk sebagai koleksi lalu dipaginasi manual 12 per halaman.
- `GET /reviews/ss` -> `PageController@reviewsScreenshots`  (name: `reviews.screenshots`)
  - Halaman ini SENGAJA tidak memakai filter: daftar screenshot dirender apa adanya. Param `rating`, `media_only`, dan `sort` diabaikan di sini, karena permintaan owner hanya menyebut `/reviews/web`.
- `GET /reviews` -> `Closure`  (301 redirect ke `/reviews/web`, query diteruskan)
- `GET /sanctum/csrf-cookie` -> `Laravel\Sanctum\Http\Controllers\CsrfCookieController@show`  (name: `sanctum.csrf-cookie`)
- `GET /search` -> `Closure`  (name: `search`)
- `GET /sitemap.xml` -> `SitemapController`  (name: `sitemap`)
- `GET /storage/{path}` -> `Closure`  (name: `storage.local`)
- `GET /ulasan` -> `PageController@ulasan`  (name: `ulasan`)
- `GET /up` -> `Closure`
- `POST /webhook/shipping/jnt` -> `Webhook\ShippingController@handleJnt`  (name: `webhook.shipping.jnt`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]
- `POST /webhook/whatsapp/baileys` -> `Webhook\WhatsAppController@handleBaileys`  (name: `webhook.whatsapp.baileys`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]

## 2. Admin

- `GET /admin` -> `Admin\DashboardController@index`  (name: `admin.dashboard`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/activity-logs` -> `Admin\ActivityLogController@index`  (name: `admin.activity-logs.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/activity-logs/export` -> `Admin\ActivityLogController@export`  (name: `admin.activity-logs.export`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/analytics/import-performance` -> `Admin\AnalyticsController@importPerformance`  (name: `admin.analytics.import-performance`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/analytics/store-performance` -> `Admin\AnalyticsController@storePerformance`  (name: `admin.analytics.store-performance`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/analytics/store-performance/export` -> `Admin\AnalyticsController@exportStorePerformance`  (name: `admin.analytics.store-performance.export`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]

Kontrak payload Performa Toko: report.sections berisi lima grup KPI, dan jumlah KPI per grup bisa bertambah bila ada metrik baru (mis. sub_models pada grup Penjualan dan open_orders_in_period pada grup Operasional). report.financial.buyers memuat jumlah pembeli unik apa adanya, supaya tampilan tidak menghitungnya ulang dari persentase yang sudah dibulatkan. report.metric_basis memuat cakupan setiap metrik (scope period atau current, plus anchor tanggal acuannya) dan dipakai halaman untuk tabel Dasar Setiap Metrik. KPI bercakupan sekarang mengirim previous dan change_percent bernilai null, dan itu penanda satu satunya; lihat docs/sitemap/admin-sitemap.md untuk daftar metrik periode versus snapshot. report.financial berisi gross_revenue, refund_adjustments, net_revenue, dan definisi; report.financial_previous memuat kunci yang sama untuk periode pembanding, dipakai sheet Ringkasan Finansial pada ekspor XLSX supaya kolom pembandingnya tidak lagi berupa keterangan tetap. Nilai report.financial_previous hanya bermakna bila report.previous_has_data bernilai true. Gross memakai order fulfillment/return (processing, shipped, delivered, completed, return_in_process, return_completed); issue bukan retur. Net hanya mengurangi refund pada return case selesai dengan barang benar-benar kembali. completed_orders dihitung dari waktu pesanan berpindah ke status completed (event_logs), bukan dari created_at. Timing memakai event pending_payment ke processing dan timestamp pembuatan resi pertama. Semua angka mengikuti rentang dan timezone aplikasi.

- `GET /admin/announcements` -> `Admin\AnnouncementController@index`  (name: `admin.announcements.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/announcements` -> `Admin\AnnouncementController@store`  (name: `admin.announcements.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/announcements/create` -> `Admin\AnnouncementController@create`  (name: `admin.announcements.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/announcements/{announcement}` -> `Admin\AnnouncementController@update`  (name: `admin.announcements.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/announcements/{announcement}/edit` -> `Admin\AnnouncementController@edit`  (name: `admin.announcements.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/announcements/{announcement}/publish` -> `Admin\AnnouncementController@publish`  (name: `admin.announcements.publish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/announcements/{announcement}/unpublish` -> `Admin\AnnouncementController@unpublish`  (name: `admin.announcements.unpublish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/apa-kata-pelanggan` -> `Admin\ApaKataController@index`  (name: `admin.apa-kata-pelanggan.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/apa-kata-pelanggan/meta` -> `Admin\ApaKataController@updateMeta`  (name: `admin.apa-kata-pelanggan.meta.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/apa-kata-pelanggan/reorder` -> `Admin\ApaKataController@reorder`  (name: `admin.apa-kata-pelanggan.reorder`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/kelola/atribut/{attribute}` -> `Admin\ProductAttributeController@update`  (name: `admin.attributes.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/banners` -> `Admin\BannerController@index`  (name: `admin.banners.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/banners` -> `Admin\BannerController@store`  (name: `admin.banners.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/banners/auto-promotions` -> `Admin\BannerController@updateAutoPromotions`  (name: `admin.banners.auto-promotions.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/banners/create` -> `Admin\BannerController@create`  (name: `admin.banners.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/banners/{banner}` -> `Admin\BannerController@update`  (name: `admin.banners.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/banners/{banner}/edit` -> `Admin\BannerController@edit`  (name: `admin.banners.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/banners/{banner}/publish` -> `Admin\BannerController@publish`  (name: `admin.banners.publish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/banners/{banner}/unpublish` -> `Admin\BannerController@unpublish`  (name: `admin.banners.unpublish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/beranda` -> `Admin\BerandaController@index`  (name: `admin.beranda.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/beranda` -> `Admin\BerandaController@update`  (name: `admin.beranda.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/beranda/how-to-order` -> `Admin\BerandaController@editHowToOrder`  (name: `admin.beranda.how-to-order.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/beranda/how-to-order` -> `Admin\BerandaController@updateHowToOrder`  (name: `admin.beranda.how-to-order.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/beranda/paling-banyak-dipesan` -> `Admin\BerandaPopularController@index`  (name: `admin.beranda.popular.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/beranda/paling-banyak-dipesan` -> `Admin\BerandaPopularController@update`  (name: `admin.beranda.popular.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]  Payload `product_ids[]` = urutan prioritas carousel; 10 produk aktif teratas memperoleh `homepage_popular=true`.
- `GET /admin/beranda/service-highlights` -> `Admin\BerandaController@editServiceHighlights`  (name: `admin.beranda.service-highlights.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/beranda/service-highlights` -> `Admin\BerandaController@updateServiceHighlights`  (name: `admin.beranda.service-highlights.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/branding` -> `Admin\PageController@updateBranding`  (name: `admin.pages.branding`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/cara-pemesanan` -> `Admin\CaraPemesananController@edit`  (name: `admin.cara-pemesanan.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/cara-pemesanan` -> `Admin\CaraPemesananController@update`  (name: `admin.cara-pemesanan.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/cod-settings` -> `Admin\CodSettingsController@edit`  (name: `admin.cod-settings.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/cod-settings` -> `Admin\CodSettingsController@update`  (name: `admin.cod-settings.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/customers` -> `Admin\CustomerController@index`  (name: `admin.customers.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/customers/export` -> `Admin\CustomerController@export`  (name: `admin.customers.export`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/customers/{customer}` -> `Admin\CustomerController@show`  (name: `admin.customers.show`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/customers/{customer}` -> `Admin\CustomerController@update`  (name: `admin.customers.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/customers/{customer}/edit` -> `Admin\CustomerController@edit`  (name: `admin.customers.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/faq` -> `Admin\FaqController@index`  (name: `admin.faq.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/faq` -> `Admin\FaqController@store`  (name: `admin.faq.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/faq/create` -> `Admin\FaqController@create`  (name: `admin.faq.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/faq/meta` -> `Admin\FaqController@updateMeta`  (name: `admin.faq.meta.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/faq/reorder` -> `Admin\FaqController@reorder`  (name: `admin.faq.reorder`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/faq/{faq}` -> `Admin\FaqController@update`  (name: `admin.faq.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `DELETE /admin/faq/{faq}` -> `Admin\FaqController@destroy`  (name: `admin.faq.destroy`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/faq/{faq}/archive` -> `Admin\FaqController@archive`  (name: `admin.faq.archive`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/faq/{faq}/edit` -> `Admin\FaqController@edit`  (name: `admin.faq.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/faq/{faq}/unarchive` -> `Admin\FaqController@unarchive`  (name: `admin.faq.unarchive`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/flash-sale` -> `Admin\FlashSaleController@index`  (name: `admin.flash-sale.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/flash-sale` -> `Admin\FlashSaleController@store`  (name: `admin.flash-sale.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/flash-sale/bulk-disable` -> `Admin\FlashSaleController@bulkDisable`  (name: `admin.flash-sale.bulk-disable`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/flash-sale/bulk-enable` -> `Admin\FlashSaleController@bulkEnable`  (name: `admin.flash-sale.bulk-enable`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/flash-sale/create` -> `Admin\FlashSaleController@create`  (name: `admin.flash-sale.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/flash-sale/period` -> `Admin\FlashSaleController@updatePeriod`  (name: `admin.flash-sale.period`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/flash-sale/{product}` -> `Admin\FlashSaleController@update`  (name: `admin.flash-sale.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/flash-sale/{product}/disable` -> `Admin\FlashSaleController@disable`  (name: `admin.flash-sale.disable`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/flash-sale/{product}/edit` -> `Admin\FlashSaleController@edit`  (name: `admin.flash-sale.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/flash-sale/{product}/enable` -> `Admin\FlashSaleController@enable`  (name: `admin.flash-sale.enable`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/gallery-items` -> `Admin\GalleryItemController@store`  (name: `admin.gallery-items.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/gallery-items/create` -> `Admin\GalleryItemController@create`  (name: `admin.gallery-items.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/gallery-items/{galleryItem}` -> `Admin\GalleryItemController@update`  (name: `admin.gallery-items.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/gallery-items/{galleryItem}/edit` -> `Admin\GalleryItemController@edit`  (name: `admin.gallery-items.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/gallery-items/{galleryItem}/publish` -> `Admin\GalleryItemController@publish`  (name: `admin.gallery-items.publish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/gallery-items/{galleryItem}/unpublish` -> `Admin\GalleryItemController@unpublish`  (name: `admin.gallery-items.unpublish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/hasil-pemasangan` -> `Admin\InstallationGalleryController@index`  (name: `admin.hasil-pemasangan.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/hasil-pemasangan/meta` -> `Admin\InstallationGalleryController@updateMeta`  (name: `admin.hasil-pemasangan.meta.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports` -> `Admin\ImportJobController@index`  (name: `admin.imports.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/imports` -> `Admin\ImportJobController@store`  (name: `admin.imports.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/imports/preview-catalog` -> `Admin\ImportJobController@previewCatalog`  (name: `admin.imports.preview-catalog`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports/create` -> `Admin\ImportJobController@create`  (name: `admin.imports.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports/{import_job}` -> `Admin\ImportJobController@show`  (name: `admin.imports.show`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports/{import_job}/correction-file` -> `Admin\ImportJobController@downloadCorrectionFile`  (name: `admin.imports.correction-file`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports/{import_job}/failed-rows` -> `Admin\ImportJobController@failedRows`  (name: `admin.imports.failed-rows`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kebijakan-privasi` -> `Admin\KebijakanPrivasiController@edit`  (name: `admin.kebijakan-privasi.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/kebijakan-privasi` -> `Admin\KebijakanPrivasiController@update`  (name: `admin.kebijakan-privasi.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/ketentuan-layanan` -> `Admin\KetentuanLayananController@edit`  (name: `admin.ketentuan-layanan.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/ketentuan-layanan` -> `Admin\KetentuanLayananController@update`  (name: `admin.ketentuan-layanan.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/masalah-solusi` -> `Admin\MasalahSolusiController@index`  (name: `admin.masalah-solusi.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/masalah-solusi` -> `Admin\MasalahSolusiController@store`  (name: `admin.masalah-solusi.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/masalah-solusi/create` -> `Admin\MasalahSolusiController@create`  (name: `admin.masalah-solusi.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/masalah-solusi/meta` -> `Admin\MasalahSolusiController@updateMeta`  (name: `admin.masalah-solusi.meta.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/masalah-solusi/reorder` -> `Admin\MasalahSolusiController@reorder`  (name: `admin.masalah-solusi.reorder`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/masalah-solusi/{masalahSolusi}` -> `Admin\MasalahSolusiController@update`  (name: `admin.masalah-solusi.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `DELETE /admin/masalah-solusi/{masalahSolusi}` -> `Admin\MasalahSolusiController@destroy`  (name: `admin.masalah-solusi.destroy`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/masalah-solusi/{masalahSolusi}/edit` -> `Admin\MasalahSolusiController@edit`  (name: `admin.masalah-solusi.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/media` -> `Admin\ProductMediaController@index`  (name: `admin.media.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/media/{asset}/attach` -> `Admin\ProductMediaController@bulkAttach`  (name: `admin.media.attach`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/media/{media}` -> `Admin\ProductMediaController@update`  (name: `admin.media.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `DELETE /admin/media/{media}` -> `Admin\ProductMediaController@destroy`  (name: `admin.media.destroy`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/media/{media}/archive` -> `Admin\ProductMediaController@archive`  (name: `admin.media.archive`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/media/{media}/redownload` -> `Admin\ProductMediaController@redownload`  (name: `admin.media.redownload`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/media/{media}/set-main` -> `Admin\ProductMediaController@setMain`  (name: `admin.media.set-main`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/model-produk` -> `Admin\ModelProductController@index`  (name: `admin.model-products.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/model-produk` -> `Admin\ModelProductController@store`  (name: `admin.model-products.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/model-produk/create` -> `Admin\ModelProductController@create`  (name: `admin.model-products.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/kelola/model-produk/reorder` -> `Admin\ModelProductController@reorder`  (name: `admin.model-products.reorder`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/model-produk/sync` -> `Admin\ModelProductController@sync`  (name: `admin.model-products.sync`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/kelola/model-produk/{modelProduct}` -> `Admin\ModelProductController@update`  (name: `admin.model-products.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/model-produk/{modelProduct}/activate` -> `Admin\ModelProductController@activate`  (name: `admin.model-products.activate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/model-produk/{modelProduct}/deactivate` -> `Admin\ModelProductController@deactivate`  (name: `admin.model-products.deactivate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/model-produk/{modelProduct}/edit` -> `Admin\ModelProductController@edit`  (name: `admin.model-products.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/notifications` -> `Admin\NotificationController@index`  (name: `admin.notifications.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/notifications/read-all` -> `Admin\NotificationController@markAllRead`  (name: `admin.notifications.mark-all-read`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/notifications/{notification}/read` -> `Admin\NotificationController@markRead`  (name: `admin.notifications.read`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/orders` -> `Admin\OrderController@index`  (name: `admin.orders.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/orders/export` -> `Admin\OrderController@export`  (name: `admin.orders.export`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/orders/{order}` -> `Admin\OrderController@show`  (name: `admin.orders.show`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/orders/{order}/items` -> `Admin\OrderController@updateItems`  (name: `admin.orders.items.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/orders/{order}/payments` -> `Admin\PaymentController@byOrder`  (name: `admin.orders.payments`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/orders/{order}/payments` -> `Admin\PaymentController@store`  (name: `admin.payments.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/orders/{order}/shipping` -> `Admin\OrderController@storeShipping`  (name: `admin.orders.shipping.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/orders/{order}/shipping/refresh` -> `Admin\OrderController@refreshShipping`  (name: `admin.orders.shipping.refresh`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/orders/{order}/status` -> `Admin\OrderController@updateStatus`  (name: `admin.orders.status`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/orders/{order}/status` -> `Admin\OrderController@statusEntry` (name: `admin.orders.status.view`): handoff ke detail order; perubahan status tetap memakai PUT.
- `GET /admin/orders/{order}/whatsapp` -> `Admin\WhatsAppMessageController@byOrder`  (name: `admin.orders.whatsapp`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/pages` -> `Admin\PageController@index`  (name: `admin.pages.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/pages` -> `Admin\PageController@store`  (name: `admin.pages.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/pages/create` -> `Admin\PageController@create`  (name: `admin.pages.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/pages/{page}` -> `Admin\PageController@update`  (name: `admin.pages.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/pages/{page}/edit` -> `Admin\PageController@edit`  (name: `admin.pages.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/payments` -> `Admin\PaymentController@index`  (name: `admin.payments.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]  Filter: `status`, `method`, `q`, `date_preset` (`today`|`3d`|`7d`|`30d`|`range`), `date_from`, `date_to` (rentang berbasis `created_at`); ringkasan KPI & hitungan tab mengikuti periode terpilih.
- `PUT /admin/payments/{payment}` -> `Admin\PaymentController@update`  (name: `admin.payments.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/produk` -> `Admin\ProductController@index`  (name: `admin.products.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk` -> `Admin\ProductController@store`  (name: `admin.products.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]  Payload create menerima `media_asset_ids` (foto katalog) dan `installation_media_asset_ids` (hasil pemasangan, ditempel sebagai media `is_installation`).
- `GET /admin/kelola/produk/create` -> `Admin\ProductController@create`  (name: `admin.products.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/produk/export` -> `Admin\ProductController@export`  (name: `admin.products.export`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/produk/popularity-boosts` -> `Admin\ProductPopularityBoostController@index`  (name: `admin.products.popularity-boosts.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk/popularity-boosts` -> `Admin\ProductPopularityBoostController@store`  (name: `admin.products.popularity-boosts.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk/popularity-boosts/{boost}/disable` -> `Admin\ProductPopularityBoostController@disable`  (name: `admin.products.popularity-boosts.disable`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk/popularity-boosts/{boost}/enable` -> `Admin\ProductPopularityBoostController@enable`  (name: `admin.products.popularity-boosts.enable`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/kelola/produk/popularity-boosts/{boost}` -> `Admin\ProductPopularityBoostController@update`  (name: `admin.products.popularity-boosts.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `DELETE /admin/kelola/produk/popularity-boosts/{boost}` -> `Admin\ProductPopularityBoostController@destroy`  (name: `admin.products.popularity-boosts.destroy`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/produk/{product}` -> `Admin\ProductController@show`  (name: `admin.products.show`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/kelola/produk/{product}` -> `Admin\ProductController@update`  (name: `admin.products.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk/{product}/archive` -> `Admin\ProductController@archive`  (name: `admin.products.archive`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/produk/{product}/attributes` -> `Admin\ProductAttributeController@index`  (name: `admin.products.attributes.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk/{product}/attributes` -> `Admin\ProductAttributeController@store`  (name: `admin.products.attributes.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk/{product}/duplicate` -> `Admin\ProductController@duplicate`  (name: `admin.products.duplicate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/produk/{product}/edit` -> `Admin\ProductController@edit`  (name: `admin.products.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/produk/{product}/media` -> `Admin\ProductMediaController@byProduct`  (name: `admin.products.media.byProduct`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]  Redirect permanen ke `admin.products.edit` tab `media` (halaman media khusus dihapus, redundan).
- `POST /admin/kelola/produk/{product}/media` -> `Admin\ProductMediaController@store`  (name: `admin.products.media.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk/{product}/publish` -> `Admin\ProductController@publish`  (name: `admin.products.publish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk/{product}/unarchive` -> `Admin\ProductController@unarchive`  (name: `admin.products.unarchive`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/produk/{product}/variants` -> `Admin\ProductVariantController@index`  (name: `admin.products.variants.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]  Redirect permanen ke `admin.products.edit` tab `varian` (halaman varian khusus dihapus, redundan).
- `POST /admin/kelola/produk/{product}/variants` -> `Admin\ProductVariantController@store`  (name: `admin.products.variants.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/produk/{product}/variants/bulk` -> `Admin\ProductVariantController@bulkStore`  (name: `admin.products.variants.bulk`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/profile` -> `Admin\ProfileController@edit`  (name: `admin.profile.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/profile` -> `Admin\ProfileController@update`  (name: `admin.profile.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/promotions` -> `Admin\PromotionController@index`  (name: `admin.promotions.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/promotions` -> `Admin\PromotionController@store`  (name: `admin.promotions.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/promotions/create` -> `Admin\PromotionController@create`  (name: `admin.promotions.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/promotions/{promotion}` -> `Admin\PromotionController@update`  (name: `admin.promotions.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/promotions/{promotion}/activate` -> `Admin\PromotionController@activate`  (name: `admin.promotions.activate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/promotions/{promotion}` -> `Admin\PromotionController@show`  (name: `admin.promotions.show`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
  Query `range` = `campaign` (default, periode kampanye) | `all` (semua waktu). Payload `report` memuat totalling penjualan + baris produk terjual.
- `GET /admin/promotions/{promotion}/edit` -> `Admin\PromotionController@edit`  (name: `admin.promotions.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/promotions/{promotion}/end` -> `Admin\PromotionController@end`  (name: `admin.promotions.end`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/promotions/{promotion}/impact` -> `Admin\PromotionController@impact`  (name: `admin.promotions.impact`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/settings` -> `Admin\SettingsController@index`  (name: `admin.settings.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/settings` -> `Admin\SettingsController@update`  (name: `admin.settings.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
Admin shipping contract: nomor resi dibuat di J&T di luar website; endpoint order shipping hanya menerima `waybill_number` manual (tidak lagi membuat resi via J&T). Detail pengiriman menampilkan tracking URL dan timeline event. Endpoint refresh mengembalikan flash `success` bila data berubah, `status` bila integrasi belum siap/tidak ada event baru (stale), atau `error` bila terjadi exception.

- `GET /admin/shipping` -> `Admin\ShippingRecordController@index`  (name: `admin.shipping.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/shipping-subsidy` -> `Admin\ShippingSubsidyController@edit`  (name: `admin.shipping-subsidy.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/shipping-subsidy` -> `Admin\ShippingSubsidyController@update`  (name: `admin.shipping-subsidy.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/shipping/{shipping_record}/refresh` -> `Admin\ShippingRecordController@refreshStatus`  (name: `admin.shipping.refresh`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/shipping/{shipping}` -> `Admin\ShippingRecordController@show`  (name: `admin.shipping.show`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/storefront-platforms` -> `Admin\StorefrontPlatformController@edit`  (name: `admin.storefront-platforms.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/storefront-platforms` -> `Admin\StorefrontPlatformController@update`  (name: `admin.storefront-platforms.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/sub-model` -> `Admin\SubModelController@index`  (name: `admin.sub-models.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/sub-model` -> `Admin\SubModelController@store`  (name: `admin.sub-models.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/sub-model/create` -> `Admin\SubModelController@create`  (name: `admin.sub-models.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/sub-model/reorder` -> `Admin\SubModelController@reorder`  (name: `admin.sub-models.reorder`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/kelola/sub-model/{subModel}` -> `Admin\SubModelController@update`  (name: `admin.sub-models.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/sub-model/{subModel}/edit` -> `Admin\SubModelController@edit`  (name: `admin.sub-models.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/sub-model/{subModel}/toggle` -> `Admin\SubModelController@toggle`  (name: `admin.sub-models.toggle`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/tentang-kami` -> `Admin\TentangKamiController@edit`  (name: `admin.tentang-kami.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/tentang-kami` -> `Admin\TentangKamiController@update`  (name: `admin.tentang-kami.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/testimonials` -> `Admin\TestimonialController@index`  (name: `admin.testimonials.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/testimonials` -> `Admin\TestimonialController@store`  (name: `admin.testimonials.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/testimonials/create` -> `Admin\TestimonialController@create`  (name: `admin.testimonials.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/testimonials/{testimonial}` -> `Admin\TestimonialController@update`  (name: `admin.testimonials.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/testimonials/{testimonial}/edit` -> `Admin\TestimonialController@edit`  (name: `admin.testimonials.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/testimonials/{testimonial}/publish` -> `Admin\TestimonialController@publish`  (name: `admin.testimonials.publish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/testimonials/{testimonial}/unpublish` -> `Admin\TestimonialController@unpublish`  (name: `admin.testimonials.unpublish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/testimonials/admin-review` -> `Admin\TestimonialController@storeAdminReview` (name: `admin.testimonials.admin-review.store`); verified delivered/completed order tanpa duplikasi
- `POST /admin/testimonials/{testimonial}/moderate` -> `Admin\TestimonialController@moderate` (name: `admin.testimonials.moderate`); status moderasi dan audit
- `POST /admin/testimonials/{testimonial}/media` -> `Admin\TestimonialController@addMedia` (name: `admin.testimonials.media`); tambah foto/video tanpa mengubah teks pelanggan
- `POST /admin/testimonials/{testimonial}/reply` -> `Admin\TestimonialController@reply` (name: `admin.testimonials.reply`); simpan balasan admin atas ulasan pelanggan, tidak mengubah published/moderasi
- `DELETE /admin/testimonials/{testimonial}/reply` -> `Admin\TestimonialController@destroyReply` (name: `admin.testimonials.reply.destroy`); hapus balasan tanpa menghapus ulasan
  - Jalan masuk balas ada tiga, semuanya memakai endpoint `admin.testimonials.reply` dan satu komponen dialog bersama (`ReviewReplyDialog`):
    - Kolom Balasan di daftar ulasan, HANYA di tab Ulasan Website.
    - Menu Lainnya di baris daftar ulasan, di KEDUA tab. Ini satu-satunya jalan membalas untuk baris yang screenshot-nya belum ada.
    - Tombol Balas di detail pesanan admin, dan kolom Aksi di daftar pesanan, untuk pesanan yang pelanggannya sudah menulis ulasan.
  - Kolom Balasan sengaja TIDAK dirender di tab Apa Kata Pelanggan. Tab itu berisi galeri screenshot, dan `can_reply` mengecualikan sumber marketplace (Shopee, WhatsApp), sehingga selnya hanya akan berisi tanda hubung begitu ada ulasan marketplace sungguhan. Dikunci `AdminTestimonialReplyColumnTest`.
- `GET /admin/users` -> `Admin\UserController@index`  (name: `admin.users.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/users` -> `Admin\UserController@store`  (name: `admin.users.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/users/create` -> `Admin\UserController@create`  (name: `admin.users.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/users/{user}` -> `Admin\UserController@update`  (name: `admin.users.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/users/{user}/activate` -> `Admin\UserController@activate`  (name: `admin.users.activate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/users/{user}/deactivate` -> `Admin\UserController@deactivate`  (name: `admin.users.deactivate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/users/{user}/edit` -> `Admin\UserController@edit`  (name: `admin.users.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/kelola/varian/{variant}` -> `Admin\ProductVariantController@update`  (name: `admin.variants.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/kelola/varian/{variant}/archive` -> `Admin\ProductVariantController@archive`  (name: `admin.variants.archive`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/kelola/varian/{variant}/edit` -> `Admin\ProductVariantController@edit`  (name: `admin.variants.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/vouchers` -> `Admin\VoucherController@index`  (name: `admin.vouchers.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/vouchers` -> `Admin\VoucherController@store`  (name: `admin.vouchers.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/vouchers/create` -> `Admin\VoucherController@create`  (name: `admin.vouchers.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/vouchers/{voucher}` -> `Admin\VoucherController@update`  (name: `admin.vouchers.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/vouchers/{voucher}/edit` -> `Admin\VoucherController@edit`  (name: `admin.vouchers.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/vouchers/{voucher}/publish` -> `Admin\VoucherController@publish`  (name: `admin.vouchers.publish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/vouchers/{voucher}/unpublish` -> `Admin\VoucherController@unpublish`  (name: `admin.vouchers.unpublish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/vouchers/{voucher}/duplicate` -> `Admin\VoucherController@duplicate`  (name: `admin.vouchers.duplicate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/vouchers/{voucher}/end` -> `Admin\VoucherController@end`  (name: `admin.vouchers.end`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/whatsapp/connection` -> `Admin\WhatsAppTemplateController@connection`  (name: `admin.whatsapp.connection`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/whatsapp/messages` -> `Admin\WhatsAppMessageController@index`  (name: `admin.whatsapp.messages.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/whatsapp/messages/{message}` -> `Admin\WhatsAppMessageController@show`  (name: `admin.whatsapp.messages.show`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/whatsapp/templates` -> `Admin\WhatsAppTemplateController@index`  (name: `admin.whatsapp.templates.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/whatsapp/templates` -> `Admin\WhatsAppTemplateController@store`  (name: `admin.whatsapp.templates.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/whatsapp/templates/{template}` -> `Admin\WhatsAppTemplateController@update`  (name: `admin.whatsapp.templates.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/whatsapp/templates/{template}/activate` -> `Admin\WhatsAppTemplateController@activate`  (name: `admin.whatsapp.templates.activate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/whatsapp/templates/{template}/deactivate` -> `Admin\WhatsAppTemplateController@deactivate`  (name: `admin.whatsapp.templates.deactivate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/whatsapp/templates/{template}/edit` -> `Admin\WhatsAppTemplateController@edit`  (name: `admin.whatsapp.templates.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/{any}` -> `Closure` (catch-all: URL admin tak dikenal -> `abort(404)` -> render `Admin/Error`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]

## 3. Auth

- `GET /login` -> `Auth\LoginController@showLoginForm`  (name: `login`)
- `POST /login` -> `Auth\LoginController@login`  (name: `login.post`)  [Illuminate\Routing\Middleware\ThrottleRequests:20,1]
- `POST /logout` -> `Auth\LoginController@logout`  (name: `logout`)
- `GET /sanctum/csrf-cookie` -> `Laravel\Sanctum\Http\Controllers\CsrfCookieController@show`  (name: `sanctum.csrf-cookie`)

## 4. Webhooks

- `POST /webhook/shipping/jnt` -> `Webhook\ShippingController@handleJnt`  (name: `webhook.shipping.jnt`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]
- `POST /webhook/whatsapp/baileys` -> `Webhook\WhatsAppController@handleBaileys`  (name: `webhook.whatsapp.baileys`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]

Envelope webhook Baileys (`POST /webhook/whatsapp/baileys`):
- Body: `{ "event": "<event>", "session": "<session>", "payload": { ... } }`.
- Auth: header `X-Webhook-Secret` (atau `X-BAILEYS-Secret`) sama dgn `WHATSAPP_BAILEYS_WEBHOOK_SECRET`,
  atau `X-Webhook-Hmac` HMAC sha512 (algo header `X-Webhook-Hmac-Algorithm`). Query-string secret ditolak.
- Event `message`: inbound customer message; `payload.from` = JID (`<nomor>@c.us`), `payload.body` = teks,
  `payload.fromMe` harus `false`. Di-log ke `whatsapp_messages` (`direction=inbound`, `provider=baileys`),
  dan bila berisi konfirmasi order, memicu `beginProcessing`.
- Event `message.ack`: ack status pengiriman; `payload.id` + `payload.ack` (0..3) -> `sent|delivered|read`.
- Event lain (mis. `session.status`) diabaikan.

## 5. Fallback

- `GET {fallbackPlaceholder}` -> `Closure` (fallback: URL publik tak dikenal -> `abort(404)` -> render `Public/Error`)  [web]


## Admin order returns (2026-08-15)

- POST /admin/orders/{order}/returns"��y��y� admin-only create return case. Valid only when order status is delivered or completed; requires reason, customer chronology, and returned item quantities. Creates order_return_cases/order_return_items, transitions order to return_in_process, and records audit/WhatsApp follow-up.
- POST /admin/orders/{order}/returns/{returnCase}/complete �w^~)�t admin-only completion. Requires resolution and completion notes, records refund/replacement/additional shipping amounts, then transitions to return_completed.
- Direct PUT /admin/orders/{order}/status to return_in_process is rejected so undocumented returns cannot bypass the case form.

- GET /admin/imports/internal-template -> Admin\\ImportJobController@downloadInternalTemplate (name: admin.imports.internal-template) [Authenticate|EnsureUserIsAdmin]
- POST /admin/imports/preview -> Admin\\ImportJobController@previewInternal (name: admin.imports.preview) [Authenticate|EnsureUserIsAdmin]

## Postal & Shipping Quote Contracts

- `POST /api/shipping/quote` -> `ShippingQuoteController@store` [throttled]
  - input: `weight_kg`, `destination_city`, optional province/area/postal/village/district identifiers
  - output state: `ready` (live J&T, final), `fallback` (local formula while J&T is not ready), or `manual_review` (provider unavailable; provisional estimate only)
- J&T address hierarchy is cached locally in `jnt_address_masters` by `jnt:sync-address-master`, sourced from `order/getAddress`. J&T uses `areaName` as the tariff area and may represent the selected local area as `townName`; checkout resolution maps the internal address to the verified J&T parent area before calling `agingCost/get`.
- Postal validation uses the active versioned dataset only after its quality gates pass. The dataset supplies a server-side auto-fill suggestion; the customer postal-code field is readonly. Submitted checkout data is rechecked against the selected village/district when a mapping exists. If mapping is missing or unverified, postal_code remains blank and the customer must reconfirm the full address or retry the region lookup; manual review is reserved for shipping quote/provider failure. No map provider supplies postal_code. If no dataset is active, validation reports unavailable and does not invalidate legacy checkout snapshots.

### Customer review contract

- `POST /order/{order_number}/review` (`order.review.store`) accepts a guest review only when the order is `delivered` or `completed`. Ownership is proven by the order number plus the checkout phone number (normalized to the same Indonesian format); there is no customer account fallback.
- `PUT /order/{order_number}/review/{testimonial}` (`order.review.update`) allows the verified customer to edit message, rating, and media. The review must belong to the order and be customer-authored. An admin-authored review returns `403` and cannot be edited through this customer contract.
- One review is allowed per order, including a review recorded by admin. A customer submission is stored as verified, `moderation_status=approved`, and `published=true`, so it appears in the storefront IMMEDIATELY without moderation or admin approval (owner decision 2026-09-21); edits keep it published. The verified purchase is the only quality gate: reviews are accepted only for orders in `delivered` or `completed`. Admin keeps takedown tools: `unpublish` hides a review, and `moderation_status=rejected` hides it permanently. Text is 3–5000 characters, rating is 1–5, and media is at most 10 image/video URL items.
- Both routes are web/CSRF routes and throttled at 10 requests per minute. Each create/edit writes an immutable `event_logs` audit record with source `customer`, order reference, and the resulting moderation status.
- Admin replies (`POST /admin/testimonials/{testimonial}/reply`) are allowed at any time, including on reviews that are already live. A reply never changes `published` or `moderation_status`, so answering a live review keeps it live.

### ETA presentation contract

`OrderEta::deliveryRange()` is the raw internal/provider range and never includes the display buffer. `OrderEta::forOrder()` is the sole customer-facing presentation boundary: it adds the configured display buffer once and exposes `base_min_days`, `base_max_days`, and `display_buffer_days` metadata so consumers must not add it again. WhatsApp uses the same presentation result.


> Shipping package contract: checkout and order creation use `ShipmentPackageCalculator` with divisor 5000. Orders snapshot `shipping_chargeable_weight_kg` and `shipping_package_snapshot`; `agingCost/get` receives the snapshot chargeable weight because direct dimensional quote remains permission-gated.

### Insurance contract (keputusan owner 2026-09-18)

Asuransi pengiriman BUKAN pilihan pembeli. Pengiriman toko selalu diasuransikan, dan biayanya menyatu ke tagihan ongkir: pelanggan melihat dan membayar SATU angka ongkir.

Konsekuensi kontrak:

- Tidak ada field pilihan asuransi di request (`insurance` pada `POST /api/shipping/quote` dan `POST /checkout/place-order` sudah DIHAPUS), tidak ada `checkout_insurance` di sesi, dan tidak ada checkbox di ringkasan checkout.
- `quote()` / `estimateBreakdown()` tidak menerima parameter pilihan; argumen keduanya `(weightKg, city, province, postalCode, area, insuredValue)`.

Dua angka asuransi yang berbeda dan tidak boleh dicampur:

- `offerFee` yang dikirim ke `agingCost/get` = NILAI BARANG yang diasuransikan (dokumen J&T: 保价金额, IDR), diambil dari subtotal keranjang. Ini angka milik kami.
- `estimateInsuranceCost` yang dibaca dari respons J&T = BIAYA asuransi. 100 persen angka J&T, dibaca apa adanya.

DILARANG ada rumus tarif asuransi di sistem ini: tanpa persen, tanpa floor, tanpa nilai tetap, dan tanpa config `insurance_rate` / `insurance_fee` / `offer_fee`. Bila J&T tidak mengirim biayanya, biaya dianggap 0, bukan dihitung sendiri.

Payload quote memisahkan ongkir dan asuransi untuk pembukuan: `freight` = tarif J&T tanpa asuransi, `insurance` = biaya asuransi dari J&T, `insurance_charged` = biaya yang ditagihkan (selalu sama dengan `insurance`), `gross` = total J&T termasuk asuransi, `subsidy` = potongan toko, `net` = `gross` - `subsidy` (inilah satu angka yang dibayar pembeli), `net_ongkir` = `net` - `insurance_charged` (ongkir setelah subsidi tanpa asuransi).

Rumus subsidi (keputusan owner 2026-09-18): subsidi = persen x TOTAL ongkir, yaitu tarif kurir DITAMBAH asuransi, ada asuransi ataupun tidak. Sebelumnya hanya tarif dasar yang disubsidi, sehingga 10 persen dari angka yang terlihat pembeli (termasuk asuransi) tidak sama dengan selisih yang terlihat. Asuransi tetap ditagihkan penuh sesuai angka J&T karena merupakan uang titipan, sehingga seluruh subsidi jatuh ke komponen ongkir dan `net_ongkir + subsidy + insurance_charged = gross` selalu berlaku.

Rumus biaya COD (keputusan owner 2026-09-18): biaya COD = persen x TOTAL PEMBAYARAN SEBELUM biaya COD, yaitu subtotal produk setelah voucher + ongkos kirim yang dibayar pembeli. Basisnya `net` (ongkir dibayar), bukan `net_ongkir`, supaya biaya COD dapat diverifikasi pembeli dari angka yang tampil di ringkasan.

Perlakuan basis ini SAMA dengan atau tanpa asuransi: yang menjadi basis selalu angka ongkos kirim yang benar-benar dibayar pembeli. Bila J&T tidak menagih asuransi, `net` sama dengan tarif kurir setelah subsidi, dan rumusnya tidak berubah. Ketiga jalur (pratinjau checkout, `createFromCart`, `editOrder`) memakai basis yang sama.

Order menyimpan `shipping_amount` (ongkir net setelah subsidi, tanpa asuransi), `shipping_subsidy_amount`, dan `shipping_insurance_amount` secara terpisah; `total_amount` menjumlahkan ketiganya secara eksplisit.

Tampilan checkout: baris "Ongkos Kirim" menampilkan `net` sebagai angka yang dibayar dengan `gross` dicoret di bawahnya, dan label `(subsidi N%)` memakai persentase asli dari setelan, sehingga `gross - subsidi = net` dapat diverifikasi pembeli. Biaya asuransi tidak ditampilkan sebagai baris terpisah karena sudah menyatu ke tarif.

Asuransi saling meniadakan di laba bersih: ditambahkan ke total pembeli, lalu dikurangi lagi sebagai potongan J&T. Perbaikan yang menyentuh hanya satu sisi membuat laba bersih salah.
