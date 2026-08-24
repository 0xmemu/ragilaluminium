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
        'Halaman Kategori' => [
            'route' => 'admin.categories.index',
            'path' => '/admin/kelola/kategori',
            'view' => 'Admin/Categories/Index',
            'controller' => 'Admin\\CategoryController@index',
        ],
        'Halaman Model Produk' => [
            'route' => 'admin.model-products.index',
            'path' => '/admin/kelola/model-produk',
            'view' => 'Admin/ModelProducts/Index',
            'controller' => 'Admin\\ModelProductController@index',
        ],
        'Halaman Sub Model' => [
            'route' => 'admin.sub-models.index',
            'path' => '/admin/kelola/sub-model',
            'view' => 'Admin/SubModels/Index',
            'controller' => 'Admin\\SubModelController@index',
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
                ['label' => 'Beranda', 'route' => 'admin.dashboard', 'capability' => 'dashboard.view', 'icon' => 'layout-dashboard', 'active' => ['admin.dashboard']],
                ['label' => 'Performa Toko', 'route' => 'admin.analytics.store-performance', 'capability' => 'analytics.view', 'icon' => 'trending-up', 'active' => ['admin.analytics.store-performance', 'admin.analytics.store-performance.*']],
                ['label' => 'Pesanan', 'route' => 'admin.orders.index', 'capability' => 'orders.view', 'icon' => 'clipboard-list', 'active' => ['admin.orders.*']],
                ['label' => 'Pembayaran', 'route' => 'admin.payments.index', 'capability' => 'payments.view', 'icon' => 'hand-coins', 'active' => ['admin.payments.*', 'admin.orders.payments']],
                ['label' => 'Pengiriman', 'route' => 'admin.shipping.index', 'capability' => 'shipping.view', 'icon' => 'truck', 'active' => ['admin.shipping.*']],
            ],
        ],
        'produk' => [
            'title' => 'Produk',
            'items' => [
                [
                    'label' => 'Kelola Produk',
                    'route' => 'admin.products.index',
                    'icon' => 'package',
                    'capability' => 'products.view',
                    'active' => ['admin.products.*', 'admin.categories.*', 'admin.model-products.*', 'admin.sub-models.*', 'admin.variants.*', 'admin.attributes.*', 'admin.imports.*', 'admin.media.*', 'admin.products.popularity-boosts.*'],
                    'children' => [
                        ['label' => 'Produk', 'route' => 'admin.products.index', 'active' => ['admin.products.index', 'admin.products.create', 'admin.products.store', 'admin.products.edit', 'admin.products.update', 'admin.products.show', 'admin.products.archive', 'admin.products.unarchive', 'admin.products.publish', 'admin.products.duplicate', 'admin.products.export', 'admin.products.variants.*', 'admin.products.attributes.*', 'admin.products.media.*']],
                        ['label' => 'Kategori', 'route' => 'admin.categories.index', 'active' => ['admin.categories.*']],
                        ['label' => 'Model Produk', 'route' => 'admin.model-products.index', 'active' => ['admin.model-products.*']],
                        ['label' => 'Sub Model', 'route' => 'admin.sub-models.index', 'active' => ['admin.sub-models.*']],
                        ['label' => 'Import', 'route' => 'admin.imports.index', 'icon' => 'upload', 'active' => ['admin.imports.*']],
                        ['label' => 'Teruskan Popularitas', 'route' => 'admin.products.popularity-boosts.index', 'active' => ['admin.products.popularity-boosts.*']],
                        ['label' => 'Media Library', 'route' => 'admin.media.library', 'active' => ['admin.media.library']],
                        ['label' => 'Riwayat Media', 'route' => 'admin.media.history', 'active' => ['admin.media.history']],
                    ],
                ],
            ],
        ],
        'harga_promo' => [
            'title' => 'Harga & Promo',
            'items' => [
                [
                    'label' => 'Promo',
                    'route' => 'admin.promotions.index',
                    'icon' => 'ticket',
                    'active' => ['admin.promotions.*', 'admin.banners.*', 'admin.announcements.*', 'admin.vouchers.*', 'admin.shipping-subsidy.*', 'admin.flash-sale.*'],
                    'children' => [
                        ['label' => 'Promo Toko', 'route' => 'admin.promotions.index', 'activeType' => 'store', 'active' => ['admin.promotions.*', 'admin.flash-sale.*']],
                        ['label' => 'Flash Sale', 'route' => 'admin.promotions.index', 'params' => ['type' => 'flash_sale'], 'icon' => 'lightning', 'activeType' => 'flash_sale', 'active' => ['admin.promotions.*', 'admin.flash-sale.*']],
                        ['label' => 'Voucher Toko', 'route' => 'admin.vouchers.index', 'active' => ['admin.vouchers.*']],
                        ['label' => 'Subsidi Ongkir', 'route' => 'admin.shipping-subsidy.edit', 'active' => ['admin.shipping-subsidy.*']],
                        ['label' => 'Banner Promo', 'route' => 'admin.banners.index', 'active' => ['admin.banners.*']],
                        ['label' => 'Bar Promo', 'route' => 'admin.announcements.index', 'active' => ['admin.announcements.*']],
                    ],
                ],
                ['label' => 'Biaya COD', 'route' => 'admin.cod-settings.edit', 'capability' => 'cod_settings.view', 'icon' => 'hand-coins', 'active' => ['admin.cod-settings.*']],
            ],
        ],
        'pelanggan_komunikasi' => [
            'title' => 'Pelanggan & Komunikasi',
            'items' => [
                ['label' => 'Customer', 'route' => 'admin.customers.index', 'capability' => 'customers.view', 'icon' => 'users', 'active' => ['admin.customers.*']],
                ['label' => 'Ulasan', 'route' => 'admin.testimonials.index', 'capability' => 'testimonials.view', 'icon' => 'star', 'active' => ['admin.testimonials.*', 'admin.gallery-items.*']],
                [
                    'label' => 'WhatsApp',
                    'route' => 'admin.whatsapp.dashboard', 'capability' => 'whatsapp.view',
                    'icon' => 'message-circle',
                    'active' => ['admin.whatsapp.dashboard', 'admin.whatsapp.messages.*', 'admin.whatsapp.connection', 'admin.whatsapp.pairing', 'admin.whatsapp.templates.*'],
                ],
            ],
        ],
        'pengaturan_website' => [
            'title' => 'Pengaturan Website',
            'items' => [
                ['label' => 'Beranda Toko', 'route' => 'admin.beranda.index', 'capability' => 'storefront_content.view', 'icon' => 'layout-grid', 'active' => ['admin.beranda.*']],

                ['label' => 'Cara Pemesanan', 'route' => 'admin.cara-pemesanan.edit', 'icon' => 'hand-coins', 'active' => ['admin.cara-pemesanan.*']],
                ['label' => 'Sering Ditanyakan', 'route' => 'admin.faq.index', 'icon' => 'help-circle', 'active' => ['admin.faq.*']],
                ['label' => 'Masalah & Solusi', 'route' => 'admin.masalah-solusi.index', 'icon' => 'alert-circle', 'active' => ['admin.masalah-solusi.*']],
                ['label' => 'Dokumen Halaman', 'route' => 'admin.documents.index', 'icon' => 'file-text', 'active' => ['admin.documents.*', 'admin.tentang-kami.*', 'admin.ketentuan-layanan.*', 'admin.kebijakan-privasi.*']],
                ['label' => 'Marketplace & Media Sosial', 'route' => 'admin.storefront-platforms.edit', 'icon' => 'storefront', 'active' => ['admin.storefront-platforms.*']],
                ['label' => 'Apa Kata Pelanggan Kami', 'route' => 'admin.apa-kata-pelanggan.index', 'icon' => 'badge-check', 'active' => ['admin.apa-kata-pelanggan.*']],
                ['label' => 'Hasil Pemasangan Kami', 'route' => 'admin.hasil-pemasangan.index', 'icon' => 'images', 'active' => ['admin.hasil-pemasangan.*']],
            ],
        ],
        'akun_sistem' => [
            'title' => 'Akun & Sistem',
            'items' => [
                ['label' => 'Log Aktivitas', 'route' => 'admin.activity-logs.index', 'capability' => 'activity_logs.view', 'icon' => 'history', 'active' => ['admin.activity-logs.*']],
                ['label' => 'Notifikasi', 'route' => 'admin.notifications.index', 'capability' => 'notifications.view', 'icon' => 'bell', 'active' => ['admin.notifications.*']],
                ['label' => 'Profil Saya', 'route' => 'admin.profile.edit', 'capability' => 'profile.view', 'icon' => 'user', 'active' => ['admin.profile.*']],
                ['label' => 'Manajemen Admin', 'route' => 'admin.users.index', 'capability' => 'users.view', 'icon' => 'user-cog', 'active' => ['admin.users.*']],
                ['label' => 'Pengaturan Sistem', 'route' => 'admin.settings.index', 'capability' => 'settings.view', 'icon' => 'settings', 'active' => ['admin.settings.*']],
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