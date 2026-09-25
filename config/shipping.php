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

    /*
    | Pembagi berat volumetrik (cm3 per kg) - RUMUS RESMI J&T CARGO.
    |
    | Kurir Ragil adalah J&T Cargo (endpoint openapi.jtcargo.co.id).
    | Rumus resmi J&T Cargo: (Panjang x Lebar x Tinggi) / 5000.
    |   - FAQ resmi: jtcargo.id/problem/qa ("Bagaimana perhitungan paket
    |     dengan berat volumetrik? (Panjang x Lebar x Tinggi) X 1 Kg / 5000")
    |   - Kanal resmi @jtcargoid (Instagram/Facebook/TikTok): "panjang kali
    |     lebar kali tinggi dibagi 5000"
    |
    | Kenapa dihitung di sisi kami: endpoint tarif yang kami pakai
    | (agingCost/get) hanya menerima `weight`, bukan dimensi, sehingga berat
    | tagih dihitung memakai rumus resmi di atas lalu dikirim sebagai data.
    | Endpoint dimensi J&T (spmComCost/getComCost) ada tetapi akun kami belum
    | berizin (diuji 2026-09-12: "API account has no interface permissions").
    |
    | Aturan resmi J&T Cargo lain yang terkait:
    |   - Berat minimal 10 kg; di bawah itu tetap dihitung 10 kg. J&T sudah
    |     menerapkannya sendiri pada tarifnya (terbukti: 0,5 kg dan 10 kg
    |     menghasilkan ongkir sama), jadi sistem TIDAK menambahkan minimum.
    |   - Berat maksimal 500 kg.
    |   - Kelas layanan: H50 (<50 kg), H100 (50-100 kg), H300 (100-300 kg),
    |     H500 (300 kg ke atas).
    */
    'volumetric_divisor' => (float) env('SHIPPING_VOLUMETRIC_DIVISOR', 5000),

    /*
    | Allowance kemasan kayu/pallet per sisi (cm).
    | Dimensi luar paket = dimensi susunan isi + (2 x allowance).
    | Dipakai ShipmentPackageCalculator; nilai per produk sudah dihapus.
    | Ini asumsi kemasan fisik Ragil (keputusan owner), bukan aturan J&T.
    */
    'pallet_allowance_per_side_cm' => (float) env('SHIPPING_PALLET_ALLOWANCE_CM', 0.0),

    /*
    | Estimasi waktu tiba (OrderEta): hari produksi + rentang pengiriman.
    | Tampil di checkout, konfirmasi order, status pesanan, dan WA.
    */
    'eta' => [
        'production_days' => (int) env('SHIPPING_ETA_PRODUCTION_DAYS', 1),
        'delivery_min_days' => (int) env('SHIPPING_ETA_DELIVERY_MIN_DAYS', 2),
        'delivery_max_days' => (int) env('SHIPPING_ETA_DELIVERY_MAX_DAYS', 5),
        'display_buffer_days' => (int) env('SHIPPING_ETA_DISPLAY_BUFFER_DAYS', 1),
    ],
];
