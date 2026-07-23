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
    | Admin-created products receive parent_sku = {prefix}{randomToken}.
    | Default prefix WEB keeps them distinct from Shopee imports (SP{n}).
    | These codes are URL/backend keys only — never show on the storefront.
    | manual_sku_floor is legacy (sequential era) and unused by the random allocator.
    |
    */
    'manual_sku_prefix' => env('STOREFRONT_MANUAL_SKU_PREFIX', 'WEB'),
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
