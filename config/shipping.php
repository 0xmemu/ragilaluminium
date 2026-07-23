<?php

/*
|--------------------------------------------------------------------------
| Pengaturan Pengiriman (fallback lokal)
|--------------------------------------------------------------------------
| Dipakai ShippingService saat J&T API tidak aktif / tarif tidak tersedia.
| Estimasi = base_rate + (berat_kg * per_kg).
*/

return [
    'local_base_rate' => (float) env('SHIPPING_LOCAL_BASE_RATE', 15000),
    'local_per_kg' => (float) env('SHIPPING_LOCAL_PER_KG', 2000),

    // Berat default per item bila varian tidak punya weight_kg (kg).
    'default_item_weight_kg' => (float) env('SHIPPING_DEFAULT_ITEM_WEIGHT', 1.0),
];
