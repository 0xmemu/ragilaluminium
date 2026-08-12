<?php

use App\Http\Controllers\Admin\ActivityLogController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\AnalyticsController;
use App\Http\Controllers\Admin\AnnouncementController;
use App\Http\Controllers\Admin\BannerController;
use App\Http\Controllers\Admin\BerandaController;
use App\Http\Controllers\Admin\CaraPemesananController;
use App\Http\Controllers\Admin\CodSettingsController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\FaqController;
use App\Http\Controllers\Admin\FlashSaleController;
use App\Http\Controllers\Admin\GalleryItemController;
use App\Http\Controllers\Admin\ImportJobController;
use App\Http\Controllers\Admin\KebijakanPrivasiController;
use App\Http\Controllers\Admin\KetentuanLayananController;
use App\Http\Controllers\Admin\MasalahSolusiController;
use App\Http\Controllers\Admin\ModelProductController;
use App\Http\Controllers\Admin\NotificationController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\PageController as AdminPageController;
use App\Http\Controllers\Admin\PaymentController;
use App\Http\Controllers\Admin\ProductAttributeController;
use App\Http\Controllers\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Admin\ProductMediaController;
use App\Http\Controllers\Admin\ProductVariantController;
use App\Http\Controllers\Admin\SubModelController;
use App\Http\Controllers\Admin\ProfileController;
use App\Http\Controllers\Admin\PromotionController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\ShippingRecordController;
use App\Http\Controllers\Admin\ShippingSubsidyController;
use App\Http\Controllers\Admin\StorefrontPlatformController;
use App\Http\Controllers\Admin\TentangKamiController;
use App\Http\Controllers\Admin\TestimonialController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\VoucherController;
use App\Http\Controllers\Admin\WhatsAppMessageController;
use App\Http\Controllers\Admin\WhatsAppTemplateController;
use App\Http\Controllers\Admin\WhatsAppPairingController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CategoryController as StorefrontCategoryController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\ConsultationController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductEngagementController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\Webhook\ShippingController;
use App\Http\Controllers\Webhook\WhatsAppController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Store Routes
|--------------------------------------------------------------------------
*/

Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/sitemap.xml', SitemapController::class)->name('sitemap');

Route::get('/about', [PageController::class, 'about'])->name('about');
Route::get('/faq', [PageController::class, 'faq'])->name('faq');
Route::get('/masalah-dan-solusi', [PageController::class, 'problemsSolutions'])->name('masalah-dan-solusi');
Route::get('/contact', [PageController::class, 'contact'])->name('contact');
Route::get('/cara-pemesanan', [PageController::class, 'howToOrder'])->name('cara-pemesanan');
Route::get('/policy/privacy', [PageController::class, 'privacy'])->name('privacy');
Route::get('/policy/terms', [PageController::class, 'terms'])->name('terms');

Route::get('/products', [CatalogController::class, 'index'])->name('catalog.index');
Route::get('/products/all', [CatalogController::class, 'all'])->name('catalog.all');
Route::get('/products/{category}', [CatalogController::class, 'categoryShow'])
    ->where('category', 'window|windows|door|doors|bouven|boven|jendela|pintu')
    ->name('catalog.category');
Route::get('/products/{category}/{model}', [CatalogController::class, 'modelShow'])
    ->where([
        'category' => 'window|windows|door|doors|bouven|boven|jendela|pintu',
        'model' => '[A-Za-z0-9_-]+',
    ])
    ->name('catalog.model');
Route::get('/products/{category}/{model}/{design}', [CatalogController::class, 'designShow'])
    ->where([
        'category' => 'window|windows|door|doors|bouven|boven|jendela|pintu',
        'model' => '[A-Za-z0-9_-]+',
        'design' => '[A-Za-z0-9_-]+',
    ])
    ->name('catalog.design');
Route::get('/promo', [CatalogController::class, 'promo'])->name('catalog.promo');
Route::get('/flash-sale', [CatalogController::class, 'flashSale'])->name('catalog.flash-sale');
Route::get('/windows', [CatalogController::class, 'windows'])->name('catalog.windows');
Route::get('/doors', [CatalogController::class, 'doors'])->name('catalog.doors');
Route::get('/bouven', [CatalogController::class, 'bouven'])->name('catalog.bouven');

Route::get('/search', [CatalogController::class, 'search'])->name('search');

Route::get('/product/{parent_sku}', [ProductController::class, 'show'])->name('product.show');

// Storefront: kategori (landing ala homepage, satu template CategoryPage)
// dan koleksi (listing bertema) — URL konteks yang bisa dibuka langsung.
Route::get('/categories/{slug}', [StorefrontCategoryController::class, 'show'])
    ->where('slug', 'window|windows|jendela|door|doors|pintu|bouven|boven')
    ->name('storefront.category');
Route::get('/collections/{slug}', [CatalogController::class, 'collectionShow'])
    ->where('slug', 'promo|flash-sale|flashsale|terlaris|bestseller|populer|terbaru|baru')
    ->name('storefront.collection');

// Alias produk baru — /products/{parent_sku} (catalog.category/model/design
// dideklarasikan lebih dulu dengan `where`, jadi tidak bertabrakan).
Route::get('/products/{parent_sku}', [ProductController::class, 'show'])->name('product.slug');
Route::post('/product/{product}/engage', [ProductEngagementController::class, 'store'])
    ->middleware('throttle:120,1')
    ->name('product.engage');

Route::get('/cart', [CartController::class, 'index'])->name('cart.index');
Route::get('/cart/preview', [CartController::class, 'preview'])->name('cart.preview');
Route::get('/cart/count', [CartController::class, 'count'])->name('cart.count');
Route::post('/cart/add', [CartController::class, 'add'])->name('cart.add');
Route::post('/cart/update', [CartController::class, 'update'])->name('cart.update');
Route::post('/cart/remove', [CartController::class, 'remove'])->name('cart.remove');
Route::post('/cart/restore', [CartController::class, 'restore'])->name('cart.restore');
Route::post('/cart/select', [CartController::class, 'select'])->name('cart.select');
Route::post('/cart/remove-selected', [CartController::class, 'removeSelected'])->name('cart.remove-selected');

Route::get('/reviews', [PageController::class, 'reviews'])->name('reviews');
// /ulasan (lama) di-redirect 301 ke /reviews agar hanya satu slug review.
Route::get('/ulasan', function () {
    $qs = request()->getQueryString();
    return redirect(route('reviews').($qs ? '?'.$qs : ''), 301);
});
Route::get('/hasil-pemasangan', [PageController::class, 'installations'])->name('installation.index');
Route::get('/hasil-pemasangan/{category}/{model}', [PageController::class, 'installationModel'])
    ->where([
        'category' => 'window|windows|door|doors|bouven|boven|jendela|pintu|lainnya|manual|other',
        'model' => '[A-Za-z0-9_-]+',
    ])
    ->name('installation.model');
Route::get('/hasil-pemasangan/{parent_sku}', [PageController::class, 'installationShow'])
    ->name('installation.show');

Route::get('/checkout', [CheckoutController::class, 'index'])->name('checkout.index');
Route::post('/checkout/validate', [CheckoutController::class, 'validateDetails'])->name('checkout.validate');
Route::post('/checkout/voucher', [CheckoutController::class, 'applyVoucher'])
    ->middleware('throttle:20,1')->name('checkout.voucher.apply');
Route::post('/checkout/voucher/remove', [CheckoutController::class, 'removeVoucher'])->name('checkout.voucher.remove');
Route::post('/checkout/place-order', [CheckoutController::class, 'placeOrder'])
    ->middleware('throttle:10,1')->name('checkout.place-order');

Route::post('/consultation/whatsapp', [ConsultationController::class, 'send'])
    ->middleware('throttle:10,1')->name('consultation.whatsapp.send');

Route::get('/order/{order_number}/confirmation', [OrderController::class, 'confirmation'])->name('order.confirmation');
Route::get('/order/count', [OrderController::class, 'count'])->name('order.count');
Route::get('/order/status', [OrderController::class, 'statusForm'])->name('order.status');
Route::post('/order/status', [OrderController::class, 'statusLookup'])
    ->middleware('throttle:15,1')->name('order.status.lookup');
Route::get('/order/status/{order_number}', [OrderController::class, 'statusApi'])
    ->middleware('throttle:10,1')->name('order.status.api');
Route::post('/order/{order_number}/cancel', [OrderController::class, 'cancel'])
    ->middleware('throttle:10,1')->name('order.cancel');

/*
|--------------------------------------------------------------------------
| Auth Routes (Admin)
|--------------------------------------------------------------------------
*/

Route::get('/login', [LoginController::class, 'showLoginForm'])->name('login');
Route::post('/login', [LoginController::class, 'login'])->middleware('throttle:20,1')->name('login.post');
Route::post('/logout', [LoginController::class, 'logout'])->name('logout');

/*
|--------------------------------------------------------------------------
| Admin Routes
|--------------------------------------------------------------------------
*/

Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {

    // Dashboard / Beranda
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::post('/branding', [AdminPageController::class, 'updateBranding'])->name('pages.branding');

    // Catalog - Products
    Route::get('products/export', [AdminProductController::class, 'export'])->name('products.export');
    Route::resource('products', AdminProductController::class)->except(['destroy']);
    Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');
    Route::get('categories/create', [CategoryController::class, 'create'])->name('categories.create');
    Route::post('categories', [CategoryController::class, 'store'])->name('categories.store');
    Route::get('categories/{category}/edit', [CategoryController::class, 'edit'])->name('categories.edit');
    Route::put('categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
    Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');
    Route::post('products/{product}/archive', [AdminProductController::class, 'archive'])->name('products.archive');
    Route::post('products/{product}/unarchive', [AdminProductController::class, 'unarchive'])->name('products.unarchive');
    Route::post('products/{product}/publish', [AdminProductController::class, 'publish'])->name('products.publish');
    Route::post('products/{product}/duplicate', [AdminProductController::class, 'duplicate'])->name('products.duplicate');

    // Variants
    Route::get('products/{product}/variants', [ProductVariantController::class, 'index'])->name('products.variants.index');
    Route::post('products/{product}/variants', [ProductVariantController::class, 'store'])->name('products.variants.store');
    Route::post('products/{product}/variants/bulk', [ProductVariantController::class, 'bulkStore'])->name('products.variants.bulk');
    Route::get('variants/{variant}/edit', [ProductVariantController::class, 'edit'])->name('variants.edit');
    Route::put('variants/{variant}', [ProductVariantController::class, 'update'])->name('variants.update');
    Route::post('variants/{variant}/archive', [ProductVariantController::class, 'archive'])->name('variants.archive');

    // Attributes
    Route::get('products/{product}/attributes', [ProductAttributeController::class, 'index'])->name('products.attributes.index');
    Route::post('products/{product}/attributes', [ProductAttributeController::class, 'store'])->name('products.attributes.store');
    Route::put('attributes/{attribute}', [ProductAttributeController::class, 'update'])->name('attributes.update');

    // Media
    Route::get('media', [ProductMediaController::class, 'index'])->name('media.index');
    Route::get('products/{product}/media', [ProductMediaController::class, 'byProduct'])->name('products.media.byProduct');
    Route::post('products/{product}/media', [ProductMediaController::class, 'store'])->name('products.media.store');
    Route::put('media/{media}', [ProductMediaController::class, 'update'])->name('media.update');
    Route::post('media/{media}/set-main', [ProductMediaController::class, 'setMain'])->name('media.set-main');
    Route::post('media/{media}/archive', [ProductMediaController::class, 'archive'])->name('media.archive');
    Route::post('media/{media}/redownload', [ProductMediaController::class, 'redownload'])->name('media.redownload');
    Route::delete('media/{media}', [ProductMediaController::class, 'destroy'])->name('media.destroy');
    Route::post('media/{asset}/attach', [ProductMediaController::class, 'bulkAttach'])->name('media.attach');

    // Imports
    Route::get('imports', [ImportJobController::class, 'index'])->name('imports.index');
    Route::get('imports/create', [ImportJobController::class, 'create'])->name('imports.create');
    Route::post('imports', [ImportJobController::class, 'store'])->name('imports.store');
    Route::get('imports/{import_job}', [ImportJobController::class, 'show'])->name('imports.show');
    Route::post('imports/{import_job}/retry', [ImportJobController::class, 'retry'])->name('imports.retry');
    Route::get('imports/{import_job}/failed-rows', [ImportJobController::class, 'failedRows'])->name('imports.failed-rows');
    Route::get('imports/{import_job}/correction-file', [ImportJobController::class, 'downloadCorrectionFile'])->name('imports.correction-file');

    // Orders
    Route::get('orders', [AdminOrderController::class, 'index'])->name('orders.index');
    Route::get('orders/export', [AdminOrderController::class, 'export'])->name('orders.export');
    Route::get('orders/{order}', [AdminOrderController::class, 'show'])->name('orders.show');
    Route::put('orders/{order}/status', [AdminOrderController::class, 'updateStatus'])->name('orders.status');
    Route::put('orders/{order}/items', [AdminOrderController::class, 'updateItems'])->name('orders.items.update');
    Route::put('orders/{order}/admin-notes', [AdminOrderController::class, 'updateAdminNotes'])->name('orders.admin-notes.update');
    Route::post('orders/{order}/shipping', [AdminOrderController::class, 'storeShipping'])->name('orders.shipping.store');
    Route::post('orders/{order}/shipping/refresh', [AdminOrderController::class, 'refreshShipping'])->name('orders.shipping.refresh');

    // Payments
    Route::get('payments', [PaymentController::class, 'index'])->name('payments.index');
    Route::get('orders/{order}/payments', [PaymentController::class, 'byOrder'])->name('orders.payments');
    Route::post('orders/{order}/payments', [PaymentController::class, 'store'])->name('payments.store');
    Route::put('payments/{payment}', [PaymentController::class, 'update'])->name('payments.update');

    // Shipping
    Route::get('shipping', [ShippingRecordController::class, 'index'])->name('shipping.index');
    Route::get('shipping/{shipping}', [ShippingRecordController::class, 'show'])->name('shipping.show');
    Route::post('shipping/{shipping_record}/refresh', [ShippingRecordController::class, 'refreshStatus'])->name('shipping.refresh');

    // WhatsApp
    Route::get('whatsapp', [WhatsAppTemplateController::class, 'dashboard'])->name('whatsapp.dashboard');
    Route::get('whatsapp/templates', [WhatsAppTemplateController::class, 'index'])->name('whatsapp.templates.index');
    Route::get('whatsapp/connection', [WhatsAppTemplateController::class, 'connection'])->name('whatsapp.connection');
    Route::post('whatsapp/templates', [WhatsAppTemplateController::class, 'store'])->name('whatsapp.templates.store');
    Route::get('whatsapp/templates/{template}/edit', [WhatsAppTemplateController::class, 'edit'])->name('whatsapp.templates.edit');
    Route::put('whatsapp/templates/{template}', [WhatsAppTemplateController::class, 'update'])->name('whatsapp.templates.update');
    Route::post('whatsapp/templates/{template}/activate', [WhatsAppTemplateController::class, 'activate'])->name('whatsapp.templates.activate');
    Route::post('whatsapp/templates/{template}/deactivate', [WhatsAppTemplateController::class, 'deactivate'])->name('whatsapp.templates.deactivate');
    Route::get('whatsapp/messages', [WhatsAppMessageController::class, 'index'])->name('whatsapp.messages.index');
    Route::get('orders/{order}/whatsapp', [WhatsAppMessageController::class, 'byOrder'])->name('orders.whatsapp');
    Route::get('whatsapp/messages/{message}', [WhatsAppMessageController::class, 'show'])->name('whatsapp.messages.show');
    Route::get('whatsapp/pairing', [WhatsAppPairingController::class, 'show'])->name('whatsapp.pairing');
    Route::get('whatsapp/pairing/status', [WhatsAppPairingController::class, 'status'])->name('whatsapp.pairing.status');
    Route::get('whatsapp/pairing/qr', [WhatsAppPairingController::class, 'qr'])->name('whatsapp.pairing.qr');
    Route::post('whatsapp/pairing/code', [WhatsAppPairingController::class, 'code'])->name('whatsapp.pairing.code');
    Route::post('whatsapp/pairing/refresh-qr', [WhatsAppPairingController::class, 'refreshQr'])->name('whatsapp.pairing.refresh-qr');


    // Analytics
    Route::get('analytics/store-performance', [AnalyticsController::class, 'storePerformance'])->name('analytics.store-performance');
    Route::get('analytics/store-performance/export', [AnalyticsController::class, 'exportStorePerformance'])->name('analytics.store-performance.export');
    Route::get('analytics/import-performance', [AnalyticsController::class, 'importPerformance'])->name('analytics.import-performance');

    Route::get('activity-logs', [ActivityLogController::class, 'index'])->name('activity-logs.index');
    Route::get('activity-logs/export', [ActivityLogController::class, 'export'])->name('activity-logs.export');

    // Notifikasi admin
    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('notifications.read');
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.mark-all-read');

    // Customers (guest buyers — not admin users)
    Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');
    Route::get('customers/export', [CustomerController::class, 'export'])->name('customers.export');
    Route::get('customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
    Route::get('customers/{customer}/edit', [CustomerController::class, 'edit'])->name('customers.edit');
    Route::put('customers/{customer}', [CustomerController::class, 'update'])->name('customers.update');

    // CMS
    Route::get('pages', [AdminPageController::class, 'index'])->name('pages.index');
    Route::get('pages/create', [AdminPageController::class, 'create'])->name('pages.create');
    Route::post('pages', [AdminPageController::class, 'store'])->name('pages.store');
    Route::get('pages/{page}/edit', [AdminPageController::class, 'edit'])->name('pages.edit');
    Route::put('pages/{page}', [AdminPageController::class, 'update'])->name('pages.update');
    Route::get('banners', [BannerController::class, 'index'])->name('banners.index');
    Route::get('banners/create', [BannerController::class, 'create'])->name('banners.create');
    Route::post('banners', [BannerController::class, 'store'])->name('banners.store');
    Route::put('banners/auto-promotions', [BannerController::class, 'updateAutoPromotions'])->name('banners.auto-promotions.update');
    Route::get('banners/{banner}/edit', [BannerController::class, 'edit'])->name('banners.edit');
    Route::put('banners/{banner}', [BannerController::class, 'update'])->name('banners.update');
    Route::post('banners/{banner}/publish', [BannerController::class, 'publish'])->name('banners.publish');
    Route::post('banners/{banner}/unpublish', [BannerController::class, 'unpublish'])->name('banners.unpublish');

    // Bar promo (announcement ticker)
    Route::get('announcements', [AnnouncementController::class, 'index'])->name('announcements.index');
    Route::get('announcements/create', [AnnouncementController::class, 'create'])->name('announcements.create');
    Route::post('announcements', [AnnouncementController::class, 'store'])->name('announcements.store');
    Route::post('announcements/slide', [AnnouncementController::class, 'saveSlide'])->name('announcements.slide');
    Route::delete('announcements/{announcement}', [AnnouncementController::class, 'destroy'])->name('announcements.destroy');
    Route::get('announcements/{announcement}/edit', [AnnouncementController::class, 'edit'])->name('announcements.edit');
    Route::put('announcements/{announcement}', [AnnouncementController::class, 'update'])->name('announcements.update');
    Route::post('announcements/{announcement}/publish', [AnnouncementController::class, 'publish'])->name('announcements.publish');
    Route::post('announcements/{announcement}/unpublish', [AnnouncementController::class, 'unpublish'])->name('announcements.unpublish');

    // Flash Sale (product_attributes: promo_flash_sale + promo_compare_price)
    Route::get('flash-sale', [FlashSaleController::class, 'index'])->name('flash-sale.index');
    Route::get('flash-sale/create', [FlashSaleController::class, 'create'])->name('flash-sale.create');
    Route::post('flash-sale', [FlashSaleController::class, 'store'])->name('flash-sale.store');
    Route::put('flash-sale/period', [FlashSaleController::class, 'updatePeriod'])->name('flash-sale.period');
    Route::get('flash-sale/{product}/edit', [FlashSaleController::class, 'edit'])->name('flash-sale.edit');
    Route::put('flash-sale/{product}', [FlashSaleController::class, 'update'])->name('flash-sale.update');
    Route::post('flash-sale/{product}/enable', [FlashSaleController::class, 'enable'])->name('flash-sale.enable');
    Route::post('flash-sale/bulk-enable', [FlashSaleController::class, 'bulkEnable'])->name('flash-sale.bulk-enable');
    Route::post('flash-sale/bulk-disable', [FlashSaleController::class, 'bulkDisable'])->name('flash-sale.bulk-disable');
    Route::post('flash-sale/{product}/disable', [FlashSaleController::class, 'disable'])->name('flash-sale.disable');

    Route::get('vouchers', [VoucherController::class, 'index'])->name('vouchers.index');
    Route::get('vouchers/create', [VoucherController::class, 'create'])->name('vouchers.create');
    Route::post('vouchers', [VoucherController::class, 'store'])->name('vouchers.store');
    Route::get('vouchers/{voucher}/edit', [VoucherController::class, 'edit'])->name('vouchers.edit');
    Route::put('vouchers/{voucher}', [VoucherController::class, 'update'])->name('vouchers.update');
    Route::post('vouchers/{voucher}/publish', [VoucherController::class, 'publish'])->name('vouchers.publish');
    Route::post('vouchers/{voucher}/unpublish', [VoucherController::class, 'unpublish'])->name('vouchers.unpublish');

    Route::get('cod-settings', [CodSettingsController::class, 'edit'])->name('cod-settings.edit');
    Route::put('cod-settings', [CodSettingsController::class, 'update'])->name('cod-settings.update');

    Route::get('shipping-subsidy', [ShippingSubsidyController::class, 'edit'])->name('shipping-subsidy.edit');
    Route::put('shipping-subsidy', [ShippingSubsidyController::class, 'update'])->name('shipping-subsidy.update');

    Route::get('beranda', [BerandaController::class, 'index'])->name('beranda.index');
    Route::put('beranda', [BerandaController::class, 'update'])->name('beranda.update');
    Route::get('beranda/service-highlights', [BerandaController::class, 'editServiceHighlights'])->name('beranda.service-highlights.edit');
    Route::put('beranda/service-highlights', [BerandaController::class, 'updateServiceHighlights'])->name('beranda.service-highlights.update');
    Route::get('beranda/how-to-order', [BerandaController::class, 'editHowToOrder'])->name('beranda.how-to-order.edit');
    Route::put('beranda/how-to-order', [BerandaController::class, 'updateHowToOrder'])->name('beranda.how-to-order.update');

    Route::get('sub-models', [SubModelController::class, 'index'])->name('sub-models.index');
    Route::get('sub-models/create', [SubModelController::class, 'create'])->name('sub-models.create');
    Route::post('sub-models', [SubModelController::class, 'store'])->name('sub-models.store');
    Route::get('sub-models/{subModel}/edit', [SubModelController::class, 'edit'])->name('sub-models.edit');
    Route::put('sub-models/{subModel}', [SubModelController::class, 'update'])->name('sub-models.update');
    Route::post('sub-models/{subModel}/toggle', [SubModelController::class, 'toggle'])->name('sub-models.toggle');
    Route::post('sub-models/reorder', [SubModelController::class, 'reorder'])->name('sub-models.reorder');
    Route::get('promotions', [PromotionController::class, 'index'])->name('promotions.index');
    Route::get('promotions/create', [PromotionController::class, 'create'])->name('promotions.create');
    Route::post('promotions', [PromotionController::class, 'store'])->name('promotions.store');
    Route::get('promotions/{promotion}/edit', [PromotionController::class, 'edit'])->name('promotions.edit');
    Route::put('promotions/{promotion}', [PromotionController::class, 'update'])->name('promotions.update');
    Route::post('promotions/{promotion}/duplicate', [PromotionController::class, 'duplicate'])->name('promotions.duplicate');
    Route::post('promotions/{promotion}/end', [PromotionController::class, 'end'])->name('promotions.end');
    Route::post('promotions/{promotion}/activate', [PromotionController::class, 'activate'])->name('promotions.activate');
    Route::post('promotions/{promotion}/impact', [PromotionController::class, 'impact'])->name('promotions.impact');
    Route::get('model-products', [ModelProductController::class, 'index'])->name('model-products.index');
    Route::get('model-products/create', [ModelProductController::class, 'create'])->name('model-products.create');
    Route::post('model-products', [ModelProductController::class, 'store'])->name('model-products.store');
    Route::post('model-products/sync', [ModelProductController::class, 'sync'])->name('model-products.sync');
    Route::put('model-products/reorder', [ModelProductController::class, 'reorder'])->name('model-products.reorder');
    Route::get('model-products/{modelProduct}/edit', [ModelProductController::class, 'edit'])->name('model-products.edit');
    Route::put('model-products/{modelProduct}', [ModelProductController::class, 'update'])->name('model-products.update');
    Route::post('model-products/{modelProduct}/activate', [ModelProductController::class, 'activate'])->name('model-products.activate');
    Route::post('model-products/{modelProduct}/deactivate', [ModelProductController::class, 'deactivate'])->name('model-products.deactivate');

    Route::get('cara-pemesanan', [CaraPemesananController::class, 'edit'])->name('cara-pemesanan.edit');
    Route::put('cara-pemesanan', [CaraPemesananController::class, 'update'])->name('cara-pemesanan.update');

    Route::get('faq', [FaqController::class, 'index'])->name('faq.index');
    Route::put('faq/meta', [FaqController::class, 'updateMeta'])->name('faq.meta.update');
    Route::put('faq/reorder', [FaqController::class, 'reorder'])->name('faq.reorder');
    Route::get('faq/create', [FaqController::class, 'create'])->name('faq.create');
    Route::post('faq', [FaqController::class, 'store'])->name('faq.store');
    Route::get('faq/{faq}/edit', [FaqController::class, 'edit'])->name('faq.edit');
    Route::put('faq/{faq}', [FaqController::class, 'update'])->name('faq.update');
    Route::post('faq/{faq}/archive', [FaqController::class, 'archive'])->name('faq.archive');
    Route::post('faq/{faq}/unarchive', [FaqController::class, 'unarchive'])->name('faq.unarchive');
    Route::delete('faq/{faq}', [FaqController::class, 'destroy'])->name('faq.destroy');

    Route::get('masalah-solusi', [MasalahSolusiController::class, 'index'])->name('masalah-solusi.index');
    Route::put('masalah-solusi/meta', [MasalahSolusiController::class, 'updateMeta'])->name('masalah-solusi.meta.update');
    Route::put('masalah-solusi/reorder', [MasalahSolusiController::class, 'reorder'])->name('masalah-solusi.reorder');
    Route::get('masalah-solusi/create', [MasalahSolusiController::class, 'create'])->name('masalah-solusi.create');
    Route::post('masalah-solusi', [MasalahSolusiController::class, 'store'])->name('masalah-solusi.store');
    Route::get('masalah-solusi/{masalahSolusi}/edit', [MasalahSolusiController::class, 'edit'])->name('masalah-solusi.edit');
    Route::put('masalah-solusi/{masalahSolusi}', [MasalahSolusiController::class, 'update'])->name('masalah-solusi.update');
    Route::delete('masalah-solusi/{masalahSolusi}', [MasalahSolusiController::class, 'destroy'])->name('masalah-solusi.destroy');

    Route::get('tentang-kami', [TentangKamiController::class, 'edit'])->name('tentang-kami.edit');
    Route::put('tentang-kami', [TentangKamiController::class, 'update'])->name('tentang-kami.update');

    Route::get('storefront-platforms', [StorefrontPlatformController::class, 'edit'])->name('storefront-platforms.edit');
    Route::put('storefront-platforms', [StorefrontPlatformController::class, 'update'])->name('storefront-platforms.update');

    Route::get('ketentuan-layanan', [KetentuanLayananController::class, 'edit'])->name('ketentuan-layanan.edit');
    Route::put('ketentuan-layanan', [KetentuanLayananController::class, 'update'])->name('ketentuan-layanan.update');

    Route::get('kebijakan-privasi', [KebijakanPrivasiController::class, 'edit'])->name('kebijakan-privasi.edit');
    Route::put('kebijakan-privasi', [KebijakanPrivasiController::class, 'update'])->name('kebijakan-privasi.update');

    Route::get('apa-kata-pelanggan', [TestimonialController::class, 'apaKata'])->name('apa-kata-pelanggan.index');
    Route::put('apa-kata-pelanggan/meta', [TestimonialController::class, 'updateApaKataMeta'])->name('apa-kata-pelanggan.meta.update');
    Route::put('apa-kata-pelanggan/reorder', [TestimonialController::class, 'reorderApaKata'])->name('apa-kata-pelanggan.reorder');
    Route::get('hasil-pemasangan', [TestimonialController::class, 'hasilPemasangan'])->name('hasil-pemasangan.index');
    Route::put('hasil-pemasangan/meta', [TestimonialController::class, 'updateHasilPemasanganMeta'])->name('hasil-pemasangan.meta.update');

    Route::get('testimonials', [TestimonialController::class, 'index'])->name('testimonials.index');
    Route::get('testimonials/create', [TestimonialController::class, 'create'])->name('testimonials.create');
    Route::post('testimonials', [TestimonialController::class, 'store'])->name('testimonials.store');
    Route::get('testimonials/{testimonial}/edit', [TestimonialController::class, 'edit'])->name('testimonials.edit');
    Route::put('testimonials/{testimonial}', [TestimonialController::class, 'update'])->name('testimonials.update');
    Route::post('testimonials/{testimonial}/publish', [TestimonialController::class, 'publish'])->name('testimonials.publish');
    Route::post('testimonials/{testimonial}/unpublish', [TestimonialController::class, 'unpublish'])->name('testimonials.unpublish');

    Route::get('gallery-items/create', [GalleryItemController::class, 'create'])->name('gallery-items.create');
    Route::post('gallery-items', [GalleryItemController::class, 'store'])->name('gallery-items.store');
    Route::get('gallery-items/{galleryItem}/edit', [GalleryItemController::class, 'edit'])->name('gallery-items.edit');
    Route::put('gallery-items/{galleryItem}', [GalleryItemController::class, 'update'])->name('gallery-items.update');
    Route::post('gallery-items/{galleryItem}/publish', [GalleryItemController::class, 'publish'])->name('gallery-items.publish');
    Route::post('gallery-items/{galleryItem}/unpublish', [GalleryItemController::class, 'unpublish'])->name('gallery-items.unpublish');

    // Profile (logged-in admin)
    Route::get('profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::put('profile', [ProfileController::class, 'update'])->name('profile.update');

    // Users
    Route::get('users', [UserController::class, 'index'])->name('users.index');
    Route::get('users/create', [UserController::class, 'create'])->name('users.create');
    Route::post('users', [UserController::class, 'store'])->name('users.store');
    Route::get('users/{user}/edit', [UserController::class, 'edit'])->name('users.edit');
    Route::put('users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::post('users/{user}/activate', [UserController::class, 'activate'])->name('users.activate');
    Route::post('users/{user}/deactivate', [UserController::class, 'deactivate'])->name('users.deactivate');

    // Settings
    Route::get('settings', [SettingsController::class, 'index'])->name('settings.index');
    Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
});

/*
|--------------------------------------------------------------------------
| Webhook Routes (no CSRF)
|--------------------------------------------------------------------------
*/

Route::middleware('throttle:120,1')->group(function () {
    Route::get('/webhook/whatsapp', [WhatsAppController::class, 'verify'])->name('webhook.whatsapp.verify');
    Route::post('/webhook/whatsapp', [WhatsAppController::class, 'handle'])->name('webhook.whatsapp.handle');
Route::post('/webhook/whatsapp/baileys', [WhatsAppController::class, 'handleBaileys'])->name('webhook.whatsapp.baileys');
    Route::post('/webhook/shipping/jnt', [ShippingController::class, 'handleJnt'])->name('webhook.shipping.jnt');
});

// TEMPORARY ErrorBoundary e2e test route — remove after verification
