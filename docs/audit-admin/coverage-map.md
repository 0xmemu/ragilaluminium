# Coverage map panel admin (Fase A)

Dihasilkan otomatis dari `php artisan route:list --json` + `config/admin-sitemap.php`.
Jangan diedit manual. Jalankan ulang `node build-coverage.mjs`.

## Ringkasan

| Metrik | Nilai |
|---|---|
| Total route aplikasi | 362 |
| Route admin | 290 |
| Route admin baca (GET) | 118 |
| Route admin ubah (POST/PUT/PATCH/DELETE) | 172 |
| Controller admin unik | 50 |
| Berkas halaman admin (tsx) | 72 |
| Halaman punya panduan (PageGuide) | 30 |
| Route baca terjangkau menu | 100 / 118 |
| Route baca tanpa view Inertia terdeteksi | 8 |

## Route baca yang tidak terjangkau menu

| URL | Nama route |
|---|---|
| `/admin/{any}` | `admin.` |
| `/admin/analytics/import-performance` | `admin.analytics.import-performance` |
| `/admin/beranda` | `admin.beranda.index` |
| `/admin/beranda/how-to-order` | `admin.beranda.how-to-order.edit` |
| `/admin/kelola/varian/{variant}/edit` | `admin.variants.edit` |
| `/admin/media/{asset}/attach` | `admin.media.attach.show` |
| `/admin/media/folders/tree` | `admin.media.folders.tree` |
| `/admin/media/picker` | `admin.media.picker` |
| `/admin/media/products/search` | `admin.media.products.search` |
| `/admin/media/status` | `admin.media.status` |
| `/admin/media/suggest-folder` | `admin.media.suggest-folder` |
| `/admin/pages` | `admin.pages.index` |
| `/admin/pages/{page}/edit` | `admin.pages.edit` |
| `/admin/pages/create` | `admin.pages.create` |
| `/admin/whatsapp/connection` | `admin.whatsapp.connection` |
| `/admin/whatsapp/messages` | `admin.whatsapp.messages.index` |
| `/admin/whatsapp/pairing/qr` | `admin.whatsapp.pairing.qr` |
| `/admin/whatsapp/pairing/status` | `admin.whatsapp.pairing.status` |

## Route baca tanpa Inertia::render terdeteksi pada controller

| URL | Nama route | Action |
|---|---|---|
| `/admin/kelola/produk/{product}/attributes` | `admin.products.attributes.index` | `App\Http\Controllers\Admin\ProductAttributeController@index` |
| `/admin/kelola/produk/{product}/variants` | `admin.products.variants.index` | `App\Http\Controllers\Admin\ProductVariantController@index` |
| `/admin/kelola/varian/{variant}/edit` | `admin.variants.edit` | `App\Http\Controllers\Admin\ProductVariantController@edit` |
| `/admin/media/folders/tree` | `admin.media.folders.tree` | `App\Http\Controllers\Admin\MediaFolderController@tree` |
| `/admin/media/picker` | `admin.media.picker` | `App\Http\Controllers\Admin\MediaPickerController@index` |
| `/admin/media/suggest-folder` | `admin.media.suggest-folder` | `App\Http\Controllers\Admin\MediaPickerController@suggestFolder` |
| `/admin/orders/{order}/whatsapp` | `admin.orders.whatsapp` | `App\Http\Controllers\Admin\WhatsAppMessageController@byOrder` |
| `/admin/whatsapp/messages` | `admin.whatsapp.messages.index` | `App\Http\Controllers\Admin\WhatsAppMessageController@redirectToOrders` |
