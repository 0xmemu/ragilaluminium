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
                ['label' => 'Produk', 'route' => 'admin.products.index', 'capability' => 'products.view', 'icon' => 'package', 'active' => ['admin.products.index', 'admin.products.create', 'admin.products.store', 'admin.products.edit', 'admin.products.update', 'admin.products.show', 'admin.products.archive', 'admin.products.unarchive', 'admin.products.publish', 'admin.products.duplicate', 'admin.products.export', 'admin.products.variants.*', 'admin.products.attributes.*', 'admin.products.media.*']],
                ['label' => 'Kategori', 'route' => 'admin.categories.index', 'capability' => 'products.view', 'icon' => 'tags', 'active' => ['admin.categories.*']],
                ['label' => 'Model Produk', 'route' => 'admin.model-products.index', 'capability' => 'products.view', 'icon' => 'layers', 'active' => ['admin.model-products.*']],
                ['label' => 'Sub Model', 'route' => 'admin.sub-models.index', 'capability' => 'products.view', 'icon' => 'git-branch', 'active' => ['admin.sub-models.*']],
                ['label' => 'Import', 'route' => 'admin.imports.index', 'capability' => 'products.view', 'icon' => 'upload', 'active' => ['admin.imports.*']],
                ['label' => 'Teruskan Popularitas', 'route' => 'admin.products.popularity-boosts.index', 'capability' => 'products.view', 'icon' => 'trending-up', 'active' => ['admin.products.popularity-boosts.*']],
                ['label' => 'Media Library', 'route' => 'admin.media.library', 'capability' => 'products.view', 'icon' => 'image', 'active' => ['admin.media.library', 'admin.media.history']],
            ],
        ],
        'harga_promo' => [
            'title' => 'Harga & Promo',
            'items' => [
                [
                    'label' => 'Promo Toko',
                    'route' => 'admin.promotions.index',
                    'icon' => 'ticket',
                    'active' => [
                        'admin.promotions.*',
                        'admin.vouchers.*',
                        'admin.banners.*',
                        'admin.announcements.*',
                        'admin.flash-sale.*',
                    ],
                ],
                ['label' => 'Subsidi Ongkir', 'route' => 'admin.shipping-subsidy.edit', 'icon' => 'truck', 'active' => ['admin.shipping-subsidy.*']],
                ['label' => 'Biaya COD', 'route' => 'admin.cod-settings.edit', 'capability' => 'cod_settings.view', 'icon' => 'hand-coins', 'active' => ['admin.cod-settings.*']],
            ],
        ],
        'pelanggan_komunikasi' => [
            'title' => 'Pelanggan & Komunikasi',
            'items' => [
                ['label' => 'Customer', 'route' => 'admin.customers.index', 'capability' => 'customers.view', 'icon' => 'users', 'active' => ['admin.customers.*']],
                ['label' => 'Ulasan', 'route' => 'admin.testimonials.index', 'capability' => 'testimonials.view', 'icon' => 'star', 'active' => ['admin.testimonials.*', 'admin.gallery-items.*', 'admin.apa-kata-pelanggan.*', 'admin.hasil-pemasangan.*']],
                [
                    'label' => 'WhatsApp',
                    'route' => 'admin.whatsapp.dashboard', 'capability' => 'whatsapp.view',
                    'icon' => 'message-circle',
                    'active' => ['admin.whatsapp.dashboard', 'admin.whatsapp.messages.*', 'admin.whatsapp.pairing', 'admin.whatsapp.templates.*'],
                ],
            ],
        ],
        'pengaturan_website' => [
            'title' => 'Pengaturan Website',
            'items' => [
                [
                    'label' => 'Profil & Kontak Toko',
                    'route' => 'admin.store-settings.index',
                    'capability' => 'storefront_content.view',
                    'icon' => 'storefront',
                    'active' => [
                        'admin.store-settings.*',
                        'admin.storefront-platforms.*',
                        'admin.beranda.kontak.*',
                    ],
                ],
                ['label' => 'Sering Ditanyakan', 'route' => 'admin.faq.index', 'icon' => 'help-circle', 'active' => ['admin.faq.*']],
                ['label' => 'Masalah & Solusi', 'route' => 'admin.masalah-solusi.index', 'icon' => 'alert-circle', 'active' => ['admin.masalah-solusi.*']],
                ['label' => 'Cara Pemesanan', 'route' => 'admin.cara-pemesanan.edit', 'icon' => 'hand-coins', 'active' => ['admin.cara-pemesanan.*']],
                ['label' => 'Tentang Kami', 'route' => 'admin.tentang-kami.edit', 'icon' => 'info', 'active' => ['admin.tentang-kami.*']],
                ['label' => 'Dokumen Halaman', 'route' => 'admin.documents.index', 'icon' => 'file-text', 'active' => ['admin.documents.*', 'admin.ketentuan-layanan.*', 'admin.kebijakan-privasi.*']],
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