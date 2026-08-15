# API & Routes - Ragil Aluminium Website

**Generated 2026-08-09 from `php artisan route:list` (production).**
Canonical route map; do not add ad-hoc endpoints outside the documented modules.

Total: 271 routes.

## 1. Public Storefront

- `GET /` -> `HomeController@index`  (name: `home`)
- `GET /about` -> `PageController@about`  (name: `about`)
- `GET /api/catalog/{category}` -> `Closure`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/health/ready` -> `ReadinessController`  (name: `health.ready`)  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/orders/{order_number}/status` -> `OrderController@statusApi`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/products/{parent_sku}` -> `ProductController@show`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/search` -> `SearchController@index`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/wilayah/districts/{regencyId}` -> `WilayahController@districts`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/wilayah/provinces` -> `WilayahController@provinces`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/wilayah/regencies/{provinceId}` -> `WilayahController@regencies`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /api/wilayah/villages/{districtId}` -> `WilayahController@villages`  [Illuminate\Routing\Middleware\ThrottleRequests:60,1]
- `GET /bouven` -> `CatalogController@bouven`  (name: `catalog.bouven`)
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
- `POST /checkout/voucher` -> `CheckoutController@applyVoucher`  (name: `checkout.voucher.apply`)  [Illuminate\Routing\Middleware\ThrottleRequests:20,1]
- `POST /checkout/voucher/remove` -> `CheckoutController@removeVoucher`  (name: `checkout.voucher.remove`)
- `POST /consultation/whatsapp` -> `ConsultationController@send`  (name: `consultation.whatsapp.send`)  [Illuminate\Routing\Middleware\ThrottleRequests:10,1]
- `GET /contact` -> `PageController@contact`  (name: `contact`)
- `GET /doors` -> `CatalogController@doors`  (name: `catalog.doors`)
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
- `GET /products` -> `CatalogController@index`  (name: `catalog.index`)  â€” hub "Semua Model Produk" (kartu kategori x model). Query `sort=latest|oldest` mengubah urutan kartu (default: urutan manual admin `sort_order` CMS); nilai sort lain dialihkan ke `catalog.all`.
- `GET /products/all` -> `CatalogController@all`  (name: `catalog.all`)
- `GET /products/{category}` -> `CatalogController@categoryShow`  (name: `catalog.category`)
- `GET /products/{category}/{model}` -> `CatalogController@modelShow`  (name: `catalog.model`)
- `GET /products/{category}/{model}/{design}` -> `CatalogController@designShow`  (name: `catalog.design`)
- `GET /promo` -> `CatalogController@promo`  (name: `catalog.promo`)
- `GET /reviews` -> `PageController@reviews`  (name: `reviews`)
- `GET /sanctum/csrf-cookie` -> `Laravel\Sanctum\Http\Controllers\CsrfCookieController@show`  (name: `sanctum.csrf-cookie`)
- `GET /search` -> `Closure`  (name: `search`)
- `GET /sitemap.xml` -> `SitemapController`  (name: `sitemap`)
- `GET /storage/{path}` -> `Closure`  (name: `storage.local`)
- `GET /ulasan` -> `PageController@ulasan`  (name: `ulasan`)
- `GET /up` -> `Closure`
- `POST /webhook/shipping/jnt` -> `Webhook\ShippingController@handleJnt`  (name: `webhook.shipping.jnt`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]
- `GET /webhook/whatsapp` -> `Webhook\WhatsAppController@verify`  (name: `webhook.whatsapp.verify`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]
- `POST /webhook/whatsapp` -> `Webhook\WhatsAppController@handle`  (name: `webhook.whatsapp.handle`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]
- `POST /webhook/whatsapp/baileys` -> `Webhook\WhatsAppController@handleBaileys`  (name: `webhook.whatsapp.baileys`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]
- `GET /windows` -> `CatalogController@windows`  (name: `catalog.windows`)

## 2. Admin

- `GET /admin` -> `Admin\DashboardController@index`  (name: `admin.dashboard`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/activity-logs` -> `Admin\ActivityLogController@index`  (name: `admin.activity-logs.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/activity-logs/export` -> `Admin\ActivityLogController@export`  (name: `admin.activity-logs.export`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/analytics/import-performance` -> `Admin\AnalyticsController@importPerformance`  (name: `admin.analytics.import-performance`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/analytics/store-performance` -> `Admin\AnalyticsController@storePerformance`  (name: `admin.analytics.store-performance`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/analytics/store-performance/export` -> `Admin\AnalyticsController@exportStorePerformance`  (name: `admin.analytics.store-performance.export`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]

Kontrak payload Performa Toko: report.sections tetap 3 grup x 5 KPI (15 KPI). report.financial berisi gross_revenue, refund_adjustments, net_revenue, dan definisi. Gross memakai order fulfillment/return (processing, shipped, delivered, completed, return_in_process, return_completed); issue bukan retur. Net hanya mengurangi refund pada return case selesai dengan barang benar-benar kembali. completed_orders hanya status completed. Timing memakai event pending_payment ke processing dan timestamp pembuatan resi pertama. Semua angka mengikuti rentang dan timezone aplikasi.

- `GET /admin/announcements` -> `Admin\AnnouncementController@index`  (name: `admin.announcements.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/announcements` -> `Admin\AnnouncementController@store`  (name: `admin.announcements.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/announcements/create` -> `Admin\AnnouncementController@create`  (name: `admin.announcements.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/announcements/{announcement}` -> `Admin\AnnouncementController@update`  (name: `admin.announcements.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/announcements/{announcement}/edit` -> `Admin\AnnouncementController@edit`  (name: `admin.announcements.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/announcements/{announcement}/publish` -> `Admin\AnnouncementController@publish`  (name: `admin.announcements.publish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/announcements/{announcement}/unpublish` -> `Admin\AnnouncementController@unpublish`  (name: `admin.announcements.unpublish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/apa-kata-pelanggan` -> `Admin\TestimonialController@apaKata`  (name: `admin.apa-kata-pelanggan.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/apa-kata-pelanggan/meta` -> `Admin\TestimonialController@updateApaKataMeta`  (name: `admin.apa-kata-pelanggan.meta.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/apa-kata-pelanggan/reorder` -> `Admin\TestimonialController@reorderApaKata`  (name: `admin.apa-kata-pelanggan.reorder`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/attributes/{attribute}` -> `Admin\ProductAttributeController@update`  (name: `admin.attributes.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
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
- `GET /admin/hasil-pemasangan` -> `Admin\TestimonialController@hasilPemasangan`  (name: `admin.hasil-pemasangan.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/hasil-pemasangan/meta` -> `Admin\TestimonialController@updateHasilPemasanganMeta`  (name: `admin.hasil-pemasangan.meta.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports` -> `Admin\ImportJobController@index`  (name: `admin.imports.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/imports` -> `Admin\ImportJobController@store`  (name: `admin.imports.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports/create` -> `Admin\ImportJobController@create`  (name: `admin.imports.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports/{import_job}` -> `Admin\ImportJobController@show`  (name: `admin.imports.show`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports/{import_job}/correction-file` -> `Admin\ImportJobController@downloadCorrectionFile`  (name: `admin.imports.correction-file`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/imports/{import_job}/failed-rows` -> `Admin\ImportJobController@failedRows`  (name: `admin.imports.failed-rows`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/imports/{import_job}/retry` -> `Admin\ImportJobController@retry`  (name: `admin.imports.retry`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
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
- `GET /admin/model-products` -> `Admin\ModelProductController@index`  (name: `admin.model-products.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/model-products` -> `Admin\ModelProductController@store`  (name: `admin.model-products.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/model-products/create` -> `Admin\ModelProductController@create`  (name: `admin.model-products.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/model-products/reorder` -> `Admin\ModelProductController@reorder`  (name: `admin.model-products.reorder`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/model-products/sync` -> `Admin\ModelProductController@sync`  (name: `admin.model-products.sync`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/model-products/{modelProduct}` -> `Admin\ModelProductController@update`  (name: `admin.model-products.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/model-products/{modelProduct}/activate` -> `Admin\ModelProductController@activate`  (name: `admin.model-products.activate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/model-products/{modelProduct}/deactivate` -> `Admin\ModelProductController@deactivate`  (name: `admin.model-products.deactivate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/model-products/{modelProduct}/edit` -> `Admin\ModelProductController@edit`  (name: `admin.model-products.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
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
- `GET /admin/orders/{order}/whatsapp` -> `Admin\WhatsAppMessageController@byOrder`  (name: `admin.orders.whatsapp`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/pages` -> `Admin\PageController@index`  (name: `admin.pages.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/pages` -> `Admin\PageController@store`  (name: `admin.pages.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/pages/create` -> `Admin\PageController@create`  (name: `admin.pages.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/pages/{page}` -> `Admin\PageController@update`  (name: `admin.pages.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/pages/{page}/edit` -> `Admin\PageController@edit`  (name: `admin.pages.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/payments` -> `Admin\PaymentController@index`  (name: `admin.payments.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/payments/{payment}` -> `Admin\PaymentController@update`  (name: `admin.payments.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/products` -> `Admin\ProductController@index`  (name: `admin.products.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/products` -> `Admin\ProductController@store`  (name: `admin.products.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/products/create` -> `Admin\ProductController@create`  (name: `admin.products.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/products/export` -> `Admin\ProductController@export`  (name: `admin.products.export`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/products/{product}` -> `Admin\ProductController@show`  (name: `admin.products.show`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/products/{product}` -> `Admin\ProductController@update`  (name: `admin.products.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/products/{product}/archive` -> `Admin\ProductController@archive`  (name: `admin.products.archive`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/products/{product}/attributes` -> `Admin\ProductAttributeController@index`  (name: `admin.products.attributes.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/products/{product}/attributes` -> `Admin\ProductAttributeController@store`  (name: `admin.products.attributes.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/products/{product}/duplicate` -> `Admin\ProductController@duplicate`  (name: `admin.products.duplicate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/products/{product}/edit` -> `Admin\ProductController@edit`  (name: `admin.products.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/products/{product}/media` -> `Admin\ProductMediaController@byProduct`  (name: `admin.products.media.byProduct`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/products/{product}/media` -> `Admin\ProductMediaController@store`  (name: `admin.products.media.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/products/{product}/publish` -> `Admin\ProductController@publish`  (name: `admin.products.publish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/products/{product}/unarchive` -> `Admin\ProductController@unarchive`  (name: `admin.products.unarchive`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/products/{product}/variants` -> `Admin\ProductVariantController@index`  (name: `admin.products.variants.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/products/{product}/variants` -> `Admin\ProductVariantController@store`  (name: `admin.products.variants.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/products/{product}/variants/bulk` -> `Admin\ProductVariantController@bulkStore`  (name: `admin.products.variants.bulk`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/profile` -> `Admin\ProfileController@edit`  (name: `admin.profile.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/profile` -> `Admin\ProfileController@update`  (name: `admin.profile.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/promotions` -> `Admin\PromotionController@index`  (name: `admin.promotions.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/promotions` -> `Admin\PromotionController@store`  (name: `admin.promotions.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/promotions/create` -> `Admin\PromotionController@create`  (name: `admin.promotions.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/promotions/{promotion}` -> `Admin\PromotionController@update`  (name: `admin.promotions.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/promotions/{promotion}/activate` -> `Admin\PromotionController@activate`  (name: `admin.promotions.activate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/promotions/{promotion}/duplicate` -> `Admin\PromotionController@duplicate`  (name: `admin.promotions.duplicate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
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
- `GET /admin/sub-models` -> `Admin\SubModelController@index`  (name: `admin.sub-models.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/sub-models` -> `Admin\SubModelController@store`  (name: `admin.sub-models.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/sub-models/create` -> `Admin\SubModelController@create`  (name: `admin.sub-models.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/sub-models/reorder` -> `Admin\SubModelController@reorder`  (name: `admin.sub-models.reorder`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/sub-models/{subModel}` -> `Admin\SubModelController@update`  (name: `admin.sub-models.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/sub-models/{subModel}/edit` -> `Admin\SubModelController@edit`  (name: `admin.sub-models.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/sub-models/{subModel}/toggle` -> `Admin\SubModelController@toggle`  (name: `admin.sub-models.toggle`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/tentang-kami` -> `Admin\TentangKamiController@edit`  (name: `admin.tentang-kami.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/tentang-kami` -> `Admin\TentangKamiController@update`  (name: `admin.tentang-kami.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/testimonials` -> `Admin\TestimonialController@index`  (name: `admin.testimonials.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/testimonials` -> `Admin\TestimonialController@store`  (name: `admin.testimonials.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/testimonials/create` -> `Admin\TestimonialController@create`  (name: `admin.testimonials.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/testimonials/{testimonial}` -> `Admin\TestimonialController@update`  (name: `admin.testimonials.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/testimonials/{testimonial}/edit` -> `Admin\TestimonialController@edit`  (name: `admin.testimonials.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/testimonials/{testimonial}/publish` -> `Admin\TestimonialController@publish`  (name: `admin.testimonials.publish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/testimonials/{testimonial}/unpublish` -> `Admin\TestimonialController@unpublish`  (name: `admin.testimonials.unpublish`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/users` -> `Admin\UserController@index`  (name: `admin.users.index`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/users` -> `Admin\UserController@store`  (name: `admin.users.store`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/users/create` -> `Admin\UserController@create`  (name: `admin.users.create`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/users/{user}` -> `Admin\UserController@update`  (name: `admin.users.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/users/{user}/activate` -> `Admin\UserController@activate`  (name: `admin.users.activate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/users/{user}/deactivate` -> `Admin\UserController@deactivate`  (name: `admin.users.deactivate`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/users/{user}/edit` -> `Admin\UserController@edit`  (name: `admin.users.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `PUT /admin/variants/{variant}` -> `Admin\ProductVariantController@update`  (name: `admin.variants.update`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `POST /admin/variants/{variant}/archive` -> `Admin\ProductVariantController@archive`  (name: `admin.variants.archive`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
- `GET /admin/variants/{variant}/edit` -> `Admin\ProductVariantController@edit`  (name: `admin.variants.edit`)  [Illuminate\Auth\Middleware\Authenticate|App\Http\Middleware\EnsureUserIsAdmin]
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
- `GET /webhook/whatsapp` -> `Webhook\WhatsAppController@verify`  (name: `webhook.whatsapp.verify`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]
- `POST /webhook/whatsapp` -> `Webhook\WhatsAppController@handle`  (name: `webhook.whatsapp.handle`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]
- `POST /webhook/whatsapp/baileys` -> `Webhook\WhatsAppController@handleBaileys`  (name: `webhook.whatsapp.baileys`)  [Illuminate\Routing\Middleware\ThrottleRequests:120,1]

## 5. Fallback

- `GET {fallbackPlaceholder}` -> `Closure` (fallback: URL publik tak dikenal -> `abort(404)` -> render `Public/Error`)  [web]


## Admin order returns (2026-08-15)

- POST /admin/orders/{order}/returns"éÝyø§yÔ admin-only create return case. Valid only when order status is delivered or completed; requires reason, customer chronology, and returned item quantities. Creates order_return_cases/order_return_items, transitions order to return_in_process, and records audit/WhatsApp follow-up.
- POST /admin/orders/{order}/returns/{returnCase}/complete ºw^~)Þt admin-only completion. Requires resolution and completion notes, records refund/replacement/additional shipping amounts, then transitions to return_completed.
- Direct PUT /admin/orders/{order}/status to return_in_process is rejected so undocumented returns cannot bypass the case form.

- GET /admin/imports/internal-template -> Admin\\ImportJobController@downloadInternalTemplate (name: admin.imports.internal-template) [Authenticate|EnsureUserIsAdmin]
- POST /admin/imports/preview -> Admin\\ImportJobController@previewInternal (name: admin.imports.preview) [Authenticate|EnsureUserIsAdmin]

## Postal & Shipping Quote Contracts

- `POST /api/shipping/quote` -> `ShippingQuoteController@store` [throttled]
  - input: `weight_kg`, `destination_city`, optional province/area/postal/village/district identifiers
  - output state: `ready` (live J&T, final), `fallback` (local formula while J&T is not ready), or `manual_review` (provider unavailable; provisional estimate only)
- Postal validation uses the active versioned dataset. If no dataset is active, validation reports unavailable and does not invalidate legacy checkout data. Active data rejects a postal code that does not match the selected village/district.
