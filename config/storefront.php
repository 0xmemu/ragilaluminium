<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Product card event discount
    |--------------------------------------------------------------------------
    |
    | Used only when a product has no explicit promo_compare_price attribute.
    | Set to 0 when the storefront-wide event is not running.
    |
    */
    'product_card_discount_percent' => (int) env('STOREFRONT_PRODUCT_CARD_DISCOUNT_PERCENT', 0),

    /*
    |--------------------------------------------------------------------------
    | Manual admin product public ID (website-created, not Shopee import)
    |--------------------------------------------------------------------------
    |
    | Admin-created products receive parent_sku = RA + 10 random chars (Fase 4, no dash).
    | Default prefix RA keeps manual codes distinct from Shopee imports (SP{n}).
    | These codes are URL/backend keys only — never show on the storefront.
    | manual_sku_floor is legacy (sequential era) and unused by the random allocator.
    |
    */
    /*
    |--------------------------------------------------------------------------
    | Jumlah produk per halaman katalog
    |--------------------------------------------------------------------------
    |
    | Dipakai CatalogController lewat paginate(). Sebelumnya kunci ini tidak ada
    | sehingga (int) null = 0 dan paginate(0) diam-diam memakai default model (15).
    | Nilai 15 dipertahankan untuk desktop: grid 3 kolom (sm/md) dan 5 kolom (xl)
    | terisi penuh dengan 15 kartu.
    |
    | catalog_page_size_mobile dipakai bila halaman diminta dengan per_page
    | (klien mengirimnya saat viewport < 640px, di sana grid 2 kolom). 16 kartu
    | = 8 baris penuh tanpa kartu menggantung di baris terakhir.
    |
    */
    'catalog_page_size' => (int) env('STOREFRONT_CATALOG_PAGE_SIZE', 15),
    'catalog_page_size_mobile' => (int) env('STOREFRONT_CATALOG_PAGE_SIZE_MOBILE', 16),

    'manual_sku_prefix' => env('STOREFRONT_MANUAL_SKU_PREFIX', 'RA'),
    'manual_sku_floor' => (int) env('STOREFRONT_MANUAL_SKU_FLOOR', 1),

    /*
    |--------------------------------------------------------------------------
    | Public WhatsApp consultation CTA
    |--------------------------------------------------------------------------
    */
    'consultation_template_key' => env('STOREFRONT_CONSULTATION_TEMPLATE_KEY', 'consultation_request'),
    'consultation_direct_message' => env(
        'STOREFRONT_CONSULTATION_DIRECT_MESSAGE',
        'Halo Ragil Aluminium, saya ingin konsultasi ukuran khusus untuk produk aluminium.',
    ),
];
