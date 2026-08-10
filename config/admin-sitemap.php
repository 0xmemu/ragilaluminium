<?php

/**
 * Admin sitemap: operational IA ↔ Laravel admin route ↔ Inertia page
 * Navigation labels from Halaman Dashboard (Y5Ch3t → Y1OzNh).
 */
return [

    'theme' => 'precision-domestic-admin',

    'pages' => [
        'Halaman Dashboard' => [
            'route' => 'admin.dashboard',
            'path' => '/admin',
            'view' => 'Admin/Dashboard',
            'controller' => 'Admin\\DashboardController@index',
        ],
        'Halaman Login Admin' => [
            'route' => 'login',
            'path' => '/login',
            'view' => 'Auth/Login',
        ],
        'Halaman Pesanan' => [
            'route' => 'admin.orders.index',
            'path' => '/admin/orders',
            'view' => 'Admin/Orders/Index',
        ],
        'Halaman Daftar Produk List' => [
            'route' => 'admin.products.index',
            'path' => '/admin/products',
            'view' => 'Admin/Products/Index',
        ],
        'Halaman WhatsApp Otomatis' => [
            'route' => 'admin.whatsapp.templates.index',
            'path' => '/admin/whatsapp/templates',
            'view' => 'Admin/WhatsApp/Index',
        ],
        'Halaman Performa Toko' => [
            'route' => 'admin.analytics.store-performance',
            'path' => '/admin/analytics/store-performance',
            'view' => 'Admin/Analytics/StorePerformance',
        ],
        'Halaman Customer' => [
            'route' => 'admin.customers.index',
            'path' => '/admin/customers',
            'view' => 'Admin/Customers/Index',
        ],
        'Halaman Pengaturan CMS' => [
            'route' => 'admin.beranda.index',
            'path' => '/admin/beranda',
            'view' => 'Admin/Beranda/Index',
            'controller' => 'Admin\\BerandaController@index',
        ],
    ],

    'navigation' => [
        'core' => [
            'items' => [
                ['label' => 'Dashboard', 'route' => 'admin.dashboard', 'icon' => 'layout-dashboard', 'active' => ['admin.dashboard']],
                ['label' => 'Pesanan', 'route' => 'admin.orders.index', 'icon' => 'clipboard-list', 'active' => ['admin.orders.*']],
                ['label' => 'Pembayaran', 'route' => 'admin.payments.index', 'icon' => 'hand-coins', 'active' => ['admin.payments.*', 'admin.orders.payments']],
                ['label' => 'Pengiriman', 'route' => 'admin.shipping.index', 'icon' => 'truck', 'active' => ['admin.shipping.*']],
            ],
        ],
        'produk' => [
            'title' => 'Produk',
            'items' => [
                ['label' => 'Daftar Produk', 'route' => 'admin.products.index', 'icon' => 'package', 'active' => ['admin.products.*', 'admin.variants.*', 'admin.attributes.*']],
            ],
        ],
        'harga_promo' => [
            'title' => 'Harga & Promo',
            'items' => [
                ['label' => 'Promo Toko', 'route' => 'admin.promotions.index', 'icon' => 'ticket', 'active' => ['admin.promotions.*', 'admin.banners.*']],
                ['label' => 'Bar Promo', 'route' => 'admin.announcements.index', 'icon' => 'megaphone', 'active' => ['admin.announcements.*']],
                ['label' => 'Flash Sale', 'route' => 'admin.promotions.index?type=flash_sale', 'icon' => 'lightning', 'active' => ['admin.promotions.*', 'admin.flash-sale.*']],
                ['label' => 'Voucher Toko', 'route' => 'admin.vouchers.index', 'icon' => 'voucher', 'active' => ['admin.vouchers.*']],
                ['label' => 'Biaya COD', 'route' => 'admin.cod-settings.edit', 'icon' => 'hand-coins', 'active' => ['admin.cod-settings.*']],
                ['label' => 'Subsidi Ongkir', 'route' => 'admin.shipping-subsidy.edit', 'icon' => 'truck', 'active' => ['admin.shipping-subsidy.*']],
            ],
        ],
        'pelanggan_komunikasi' => [
            'title' => 'Pelanggan & Komunikasi',
            'items' => [
                ['label' => 'Customer', 'route' => 'admin.customers.index', 'icon' => 'users', 'active' => ['admin.customers.*']],
                ['label' => 'Ulasan', 'route' => 'admin.testimonials.index', 'icon' => 'star', 'active' => ['admin.testimonials.*', 'admin.gallery-items.*']],
                [
                    'label' => 'WhatsApp',
                    'route' => 'admin.whatsapp.dashboard',
                    'icon' => 'message-circle',
                    'active' => ['admin.whatsapp.dashboard', 'admin.whatsapp.messages.*', 'admin.whatsapp.connection', 'admin.whatsapp.pairing', 'admin.whatsapp.templates.*'],
                ],
            ],
        ],
        'monitoring' => [
            'title' => 'Laporan & Monitoring',
            'items' => [
                ['label' => 'Performa Toko', 'route' => 'admin.analytics.store-performance', 'icon' => 'trending-up', 'active' => ['admin.analytics.store-performance', 'admin.analytics.store-performance.*']],
                ['label' => 'Log Aktivitas', 'route' => 'admin.activity-logs.index', 'icon' => 'history', 'active' => ['admin.activity-logs.*']],
            ],
        ],
        'pengaturan_website' => [
            'title' => 'Pengaturan Website',
            'items' => [
                ['label' => 'Beranda Pembeli', 'route' => 'admin.beranda.index', 'icon' => 'layout-grid', 'active' => ['admin.beranda.*']],
                ['label' => 'Model Produk', 'route' => 'admin.model-products.index', 'icon' => 'box', 'active' => ['admin.model-products.*']],
                ['label' => 'Sub Model', 'route' => 'admin.sub-models.index', 'icon' => 'layout-grid', 'active' => ['admin.sub-models.*']],
                ['label' => 'Cara Pemesanan', 'route' => 'admin.cara-pemesanan.edit', 'icon' => 'hand-coins', 'active' => ['admin.cara-pemesanan.*']],
                ['label' => 'Sering Ditanyakan', 'route' => 'admin.faq.index', 'icon' => 'help-circle', 'active' => ['admin.faq.*']],
                ['label' => 'Masalah & Solusi', 'route' => 'admin.masalah-solusi.index', 'icon' => 'alert-circle', 'active' => ['admin.masalah-solusi.*']],
                ['label' => 'Informasi Toko', 'route' => 'admin.tentang-kami.edit', 'icon' => 'store', 'active' => ['admin.tentang-kami.*']],
                ['label' => 'Marketplace & Media Sosial', 'route' => 'admin.storefront-platforms.edit', 'icon' => 'storefront', 'active' => ['admin.storefront-platforms.*']],
                ['label' => 'Ketentuan Layanan', 'route' => 'admin.ketentuan-layanan.edit', 'icon' => 'gavel', 'active' => ['admin.ketentuan-layanan.*']],
                ['label' => 'Kebijakan Privasi', 'route' => 'admin.kebijakan-privasi.edit', 'icon' => 'lock', 'active' => ['admin.kebijakan-privasi.*']],
                ['label' => 'Apa Kata Pelanggan Kami', 'route' => 'admin.apa-kata-pelanggan.index', 'icon' => 'badge-check', 'active' => ['admin.apa-kata-pelanggan.*']],
                ['label' => 'Hasil Pemasangan Kami', 'route' => 'admin.hasil-pemasangan.index', 'icon' => 'images', 'active' => ['admin.hasil-pemasangan.*']],
            ],
        ],
        'akun' => [
            'title' => 'Akun',
            'items' => [
                ['label' => 'Profil Saya', 'route' => 'admin.profile.edit', 'icon' => 'user', 'active' => ['admin.profile.*']],
                ['label' => 'Manajemen Admin', 'route' => 'admin.users.index', 'icon' => 'user-cog', 'active' => ['admin.users.*']],
                ['label' => 'Pengaturan Sistem', 'route' => 'admin.settings.index', 'icon' => 'settings', 'active' => ['admin.settings.*']],
            ],
        ],
    ],

    'brand' => [
        'name' => 'Ragil Aluminium',
        'panel_version' => 'v2.0',
        'sidebar_width' => '192px',
        'logo_bg' => '#131212',
        'canvas_bg' => '#f9f9f9',
    ],
];
