<?php

/**
 * Sitemap: public information architecture ↔ Laravel route ↔ Inertia page.
 * Visual governance: frontend/brand + frontend/docs.
 * Functional contract: docs/PRODUCT-HANDOFF.md.
 */
return [

    'theme' => 'precision-domestic-inertia',

    /*
    |--------------------------------------------------------------------------
    | Wireframe pages → backend binding
    | status: implemented | planned (planned = no live nav link)
    |--------------------------------------------------------------------------
    */
    'pages' => [
        'Halaman Beranda' => [
            'route' => 'home',
            'path' => '/',
            'view' => 'Public/Home',
            'controller' => 'HomeController@index',
            'group' => 'core',
            'status' => 'implemented',
        ],
        'Halaman Semua Model Produk' => [
            'route' => 'catalog.index',
            'path' => '/products',
            'view' => 'Public/ModelProduk',
            'controller' => 'CatalogController@index',
            'group' => 'catalog',
            'status' => 'implemented',
            'notes' => 'Hub model (card-model-produk). Bukan daftar SKU.',
        ],
        'Halaman Semua Produk' => [
            'route' => 'catalog.all',
            'path' => '/products/all',
            'view' => 'Public/Catalog',
            'controller' => 'CatalogController@index',
            'group' => 'catalog',
            'status' => 'implemented',
            'notes' => 'Listing seluruh SKU (card-produk). Default popular tanpa query sort.',
        ],
        'Halaman Promo' => [
            'route' => 'catalog.promo',
            'path' => '/promo',
            'view' => 'Public/Catalog',
            'controller' => 'CatalogController@promo',
            'group' => 'catalog',
            'status' => 'implemented',
            'notes' => 'Listing SKU dengan atribut promo eksplisit (card-produk).',
        ],

        'Halaman Produk Satuan' => [
            'route' => 'product.show',
            'path' => '/product/{parent_sku}',
            'view' => 'Public/ProductDetail',
            'controller' => 'ProductController@show',
            'group' => 'catalog',
            'status' => 'implemented',
        ],
        'Halaman Paling Banyak Dipesan' => [
            'route' => 'catalog.index',
            'path' => '/products',
            'view' => 'Public/Catalog',
            'query' => ['sort' => 'popular'],
            'group' => 'catalog',
            'status' => 'implemented',
        ],
        'Halaman Apa Kata Pelanggan kami' => [
            'route' => 'reviews.screenshots',
            'path' => '/reviews/ss',
            'view' => 'Public/Reviews',
            'controller' => 'PageController@reviewsScreenshots',
            'group' => 'core',
            'status' => 'implemented',
        ],
        'Halaman Ulasan Pembeli' => [
            'route' => 'ulasan',
            'path' => '/ulasan',
            'view' => 'Public/Ulasan',
            'controller' => 'PageController@ulasan',
            'group' => 'core',
            'status' => 'implemented',
        ],
        'Halaman Hasil Pemasangan Kami' => [
            'route' => 'reviews.website',
            'path' => '/reviews/web',
            'view' => 'Public/Reviews',
            'group' => 'core',
            'status' => 'implemented',
        ],
        'Informasi Toko' => [
            'route' => 'about',
            'path' => '/about',
            'view' => 'Public/CmsPage',
            'controller' => 'PageController@about',
            'cms_slug' => 'tentang-kami',
            'group' => 'info',
            'status' => 'implemented',
        ],
        'Halaman Keranjang Belanja' => [
            'route' => 'cart.index',
            'path' => '/cart',
            'view' => 'Public/Cart',
            'controller' => 'CartController@index',
            'group' => 'transaction',
            'status' => 'implemented',
        ],
        'Halaman Order' => [
            'route' => 'checkout.index',
            'path' => '/checkout',
            'view' => 'Public/Checkout',
            'controller' => 'CheckoutController@index',
            'group' => 'transaction',
            'status' => 'implemented',
        ],
        'Halaman Setelah CO TF' => [
            'route' => 'order.confirmation',
            'path' => '/order/{order_number}/confirmation',
            'view' => 'Public/OrderConfirmation',
            'controller' => 'OrderController@confirmation',
            'group' => 'transaction',
            'status' => 'implemented',
        ],
        'Halaman Setelah CO COD' => [
            'route' => 'order.confirmation',
            'path' => '/order/{order_number}/confirmation',
            'view' => 'Public/OrderConfirmation',
            'group' => 'transaction',
            'status' => 'implemented',
        ],
        'Pesanan Saya' => [
            'route' => 'order.status',
            'path' => '/order/status',
            'view' => 'Public/OrderStatus',
            'controller' => 'OrderController@statusForm',
            'group' => 'transaction',
            'status' => 'implemented',
        ],
        'Halaman Lihat detail pesanan' => [
            'route' => 'order.status',
            'path' => '/order/status',
            'view' => 'Public/OrderStatus',
            'group' => 'transaction',
            'status' => 'implemented',
        ],
        'Halaman Cara Pemesanan' => [
            'route' => 'cara-pemesanan',
            'path' => '/cara-pemesanan',
            'view' => 'Public/CmsPage',
            'controller' => 'PageController@howToOrder',
            'cms_slug' => 'cara-pemesanan',
            'group' => 'info',
            'status' => 'implemented',
        ],
        'Halaman Sering Ditanyakan' => [
            'route' => 'faq',
            'path' => '/faq',
            'view' => 'Public/CmsPage',
            'controller' => 'PageController@faq',
            'cms_slug' => 'faq',
            'group' => 'info',
            'status' => 'implemented',
        ],
        /* Implemented information page */
        'Halaman Masalah & Solusi' => [
            'route' => 'masalah-dan-solusi',
            'path' => '/masalah-dan-solusi',
            'view' => 'Public/MasalahSolusi',
            'controller' => 'PageController@problemsSolutions',
            'cms_slug' => 'masalah-solusi',
            'group' => 'info',
            'status' => 'implemented',
        ],
        'Halaman Kebijakan Privasi' => [
            'route' => 'privacy',
            'path' => '/policy/privacy',
            'view' => 'Public/CmsPage',
            'controller' => 'PageController@privacy',
            'cms_slug' => 'kebijakan-privasi',
            'group' => 'info',
            'status' => 'implemented',
        ],
        'Halaman Ketentuan Layanan' => [
            'route' => 'terms',
            'path' => '/policy/terms',
            'view' => 'Public/CmsPage',
            'controller' => 'PageController@terms',
            'cms_slug' => 'ketentuan-layanan',
            'group' => 'info',
            'status' => 'implemented',
        ],
        'Halaman Retur Diproses' => [
            'path' => null,
            'view' => null,
            'group' => 'transaction',
            'status' => 'planned',
            'note' => 'Planned only — no public route',
        ],
        'Halaman Retur Selesai' => [
            'path' => null,
            'view' => null,
            'group' => 'transaction',
            'status' => 'planned',
            'note' => 'Planned only — no public route',
        ],
        'Halaman Isi Hasil Pemasangan Kami' => [
            'path' => null,
            'view' => null,
            'group' => 'core',
            'status' => 'planned',
            'note' => 'Customer submit form planned; public listing is /hasil-pemasangan (model) → /hasil-pemasangan/{category}/{model} (produk) → /hasil-pemasangan/{parent_sku} (galeri)',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Global navigation (planned items excluded)
    |--------------------------------------------------------------------------
    */
    'navigation' => [
        'mobile_bottom' => [
            [
                'label' => 'Beranda',
                'route' => 'home',
                'icon' => 'house',
                'active' => ['home'],
            ],
            [
                'label' => 'Model Produk',
                'route' => 'catalog.index',
                'icon' => 'package',
                'active' => ['catalog.index', 'catalog.all', 'catalog.category', 'catalog.model', 'catalog.design', 'catalog.windows', 'catalog.doors', 'catalog.bouven', 'product.show'],
            ],
            [
                'label' => 'Pesanan',
                'route' => 'order.status',
                'icon' => 'clipboard-list',
                'active' => ['order.status', 'order.status.lookup'],
            ],
            [
                'label' => 'Tentang Kami',
                'route' => 'about',
                'icon' => 'info',
                'active' => ['about'],
            ],
        ],

        /*
        | Drawer mobile — dipisah per grup IA (produk vs informasi/bantuan).
        | Model submenu berasal dari CatalogTaxonomy::modelCards() di Inertia share.
        | `hamburger` digabung di HandleInertiaRequests untuk kompatibilitas.
        */
        'hamburger_product' => [
            [
                'label' => 'Model Produk',
                'route' => 'catalog.index',
                'icon' => 'package',
                'active' => ['catalog.index', 'catalog.category', 'catalog.model', 'catalog.design', 'catalog.windows', 'catalog.doors', 'catalog.bouven', 'product.show'],
            ],
            [
                'label' => 'Semua Produk',
                'route' => 'catalog.all',
                'icon' => 'grid-2x2',
                'active' => ['catalog.all', 'catalog.category', 'catalog.model', 'catalog.design', 'catalog.windows', 'catalog.doors', 'catalog.bouven', 'product.show'],
            ],
            [
                'label' => 'Hasil Pemasangan',
                'route' => 'installation.index',
                'icon' => 'image',
                'active' => ['installation.index', 'installation.model', 'installation.show'],
            ],
            [
                'label' => 'Ulasan',
                'route' => 'reviews.website',
                'icon' => 'star',
                'active' => ['reviews.website', 'reviews.screenshots'],
            ],
        ],

        'hamburger_info' => [
            [
                'label' => 'Lacak Pengiriman',
                'route' => 'order.status',
                'icon' => 'truck',
                'active' => ['order.status', 'order.status.lookup'],
            ],
            [
                'label' => 'Konsultasi Gratis',
                'route' => 'contact',
                'icon' => 'headset',
                'active' => ['contact'],
            ],
            [
                'label' => 'Cara Pemesanan',
                'route' => 'cara-pemesanan',
                'icon' => 'info',
                'active' => ['cara-pemesanan'],
            ],
            [
                'label' => 'Sering Ditanyakan',
                'route' => 'faq',
                'icon' => 'circle-help',
                'active' => ['faq'],
            ],
            [
                'label' => 'Masalah & Solusi',
                'route' => 'masalah-dan-solusi',
                'icon' => 'warning',
                'active' => ['masalah-dan-solusi'],
            ],
            [
                'label' => 'Informasi Toko',
                'route' => 'about',
                'icon' => 'storefront',
                'active' => ['about'],
            ],
        ],

        'hamburger_footer' => [
            [
                'label' => 'Ketentuan Layanan',
                'route' => 'terms',
            ],
            [
                'label' => 'Kebijakan Privasi',
                'route' => 'privacy',
            ],
        ],
        'hamburger_copyright' => 'Copyright @2026',

        'desktop_main' => [
            [
                'label' => 'Model Produk',
                'route' => 'catalog.index',
                'active' => ['catalog.index'],
            ],
            [
                'label' => 'Produk',
                'route' => 'catalog.all',
                'active' => ['catalog.all', 'catalog.category', 'catalog.model', 'catalog.design', 'catalog.windows', 'catalog.doors', 'catalog.bouven', 'product.show'],
            ],
            [
                'label' => 'Ulasan',
                'route' => 'reviews.website',
                'active' => ['reviews.website', 'reviews.screenshots'],
            ],
            [
                'label' => 'Hasil Pemasangan',
                'route' => 'installation.index',
                'active' => ['installation.index', 'installation.model', 'installation.show'],
            ],
            [
                'label' => 'Informasi Toko',
                'route' => 'about',
                'active' => ['about'],
            ],
        ],

        /* Category strip removed — main nav is desktop_main only */
        'desktop_categories' => [],

        /*
        | Model Produk mega-menu — taxonomy filters (unchanged)
        */
        'mega_menu' => [
            [
                'title' => 'Jendela Aluminium',
                'route' => 'catalog.windows',
                'items' => [
                    ['label' => 'Jendela Sliding', 'model' => 'SLIDING', 'design' => null],
                    ['label' => 'Jendela Sliding Ornamen', 'model' => 'SLIDING', 'design' => 'ORNAMEN'],
                    ['label' => 'Jendela Jungkit', 'model' => 'JUNGKIT', 'design' => null],
                    ['label' => 'Jendela Jungkit Ornamen', 'model' => 'JUNGKIT', 'design' => 'ORNAMEN'],
                    ['label' => 'Jendela Swing', 'model' => 'SWING', 'design' => null],
                    ['label' => 'Jendela Swing Ornamen', 'model' => 'SWING', 'design' => 'ORNAMEN'],
                    ['label' => 'Jendela Kaca Mati', 'model' => 'KACA_MATI', 'design' => null],
                    ['label' => 'Jendela Kaca Mati Ornamen', 'model' => 'KACA_MATI', 'design' => 'ORNAMEN'],
                    ['label' => 'Jendela Kombinasi', 'model' => null, 'design' => 'KOMBINASI'],
                ],
            ],
            [
                'title' => 'Boven Aluminium',
                'route' => 'catalog.bouven',
                'items' => [
                    ['label' => 'Boven Sliding', 'model' => 'SLIDING', 'design' => null],
                    ['label' => 'Boven Sliding Ornamen', 'model' => 'SLIDING', 'design' => 'ORNAMEN'],
                    ['label' => 'Boven Jungkit', 'model' => 'JUNGKIT', 'design' => null],
                    ['label' => 'Boven Jungkit Ornamen', 'model' => 'JUNGKIT', 'design' => 'ORNAMEN'],
                    ['label' => 'Boven Swing', 'model' => 'SWING', 'design' => null],
                    ['label' => 'Boven Swing Ornamen', 'model' => 'SWING', 'design' => 'ORNAMEN'],
                    ['label' => 'Boven Zigzag', 'model' => 'ZIGZAG', 'design' => null],
                ],
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Footer columns
    |--------------------------------------------------------------------------
    */
    'footer' => [
        'products' => [
            'title' => 'Jelajahi Produk',
            'links' => [
                ['label' => 'Model Produk', 'route' => 'catalog.index'],
                ['label' => 'Paling Banyak Dipesan', 'route' => 'catalog.index', 'params' => ['sort' => 'popular']],
                ['label' => 'Jendela', 'route' => 'catalog.windows'],
                ['label' => 'Boven', 'route' => 'catalog.bouven'],
            ],
        ],
        'help' => [
            'title' => 'Pusat Bantuan',
            'links' => [
                ['label' => 'Cara Pemesanan', 'route' => 'cara-pemesanan'],
                ['label' => 'Sering Ditanyakan', 'route' => 'faq'],
                ['label' => 'Masalah & Solusi', 'route' => 'masalah-dan-solusi'],
                ['label' => 'Hubungi Kami', 'route' => 'contact'],
            ],
        ],
        'company' => [
            'title' => 'Informasi Toko',
            'links' => [
                ['label' => 'Profil Perusahaan', 'route' => 'about'],
                ['label' => 'Ulasan', 'route' => 'reviews.website'],
                ['label' => 'Hasil Pemasangan', 'route' => 'installation.index'],
                ['label' => 'Pesanan', 'route' => 'order.status'],
            ],
        ],
        'legal' => [
            ['label' => 'Kebijakan Privasi', 'route' => 'privacy'],
            ['label' => 'Ketentuan Layanan', 'route' => 'terms'],
        ],
        'social' => [
            ['key' => 'facebook', 'label' => 'Facebook', 'href' => env('SOCIAL_FACEBOOK', '#'), 'icon' => '/images/icons/social/facebook.svg'],
            ['key' => 'instagram', 'label' => 'Instagram', 'href' => env('SOCIAL_INSTAGRAM', '#'), 'icon' => '/images/icons/social/instagram.svg'],
            ['key' => 'tiktok', 'label' => 'TikTok', 'href' => env('SOCIAL_TIKTOK', '#'), 'icon' => '/images/icons/social/tiktok.svg'],
            ['key' => 'shopee', 'label' => 'Shopee', 'href' => env('SOCIAL_SHOPEE', '#'), 'icon' => '/images/icons/social/shopee.svg'],
            ['key' => 'lazada', 'label' => 'Lazada', 'href' => env('SOCIAL_LAZADA', '#'), 'icon' => '/images/icons/social/lazada.png'],
            ['key' => 'youtube', 'label' => 'YouTube', 'href' => env('SOCIAL_YOUTUBE', '#'), 'icon' => '/images/icons/social/youtube.svg'],
            ['key' => 'tokopedia', 'label' => 'Tokopedia', 'href' => env('SOCIAL_TOKOPEDIA', '#'), 'icon' => '/images/icons/social/tokopedia.png'],
        ],
    ],

    'brand' => [
        'name' => 'Jendela Ragil Aluminium',
        'short_name' => 'Ragil Aluminium',
        'tagline' => 'Pusat Belanja Jendela Aluminium',
        'email' => 'ragilaluminium29@gmail.com',
        'phone' => env('BRAND_PHONE', '+62 851-9966-6810'),
        'address' => env(
            'BRAND_ADDRESS',
            'Jln. Raya Mandiraja Wetan, Samping Barat Pom Bensin Mandiraja, Desa Mandiraja Wetan, Kec. Mandiraja, Kab. Banjarnegara, Jawa Tengah 53473'
        ),
        'hours' => env('BRAND_HOURS', 'Senin – Sabtu, 08.00 – 17.00 WIB'),
        // Query untuk embed + tautan Google Maps (override via .env bila pin lebih akurat).
        'maps_query' => env(
            'BRAND_MAPS_QUERY',
            'Toko Ragil Aluminium Jln. Raya Mandiraja Wetan Samping Barat Pom Bensin Mandiraja Banjarnegara'
        ),
        'maps_url' => env('BRAND_MAPS_URL'),
        // Social proof beranda (teks); logo marketplace → platforms + Informasi Toko/Footer.
        'units_installed_label' => env(
            'BRAND_UNITS_INSTALLED_LABEL',
            '1.000.000+ Unit Terpasang di Seluruh Indonesia'
        ),
        'years_experience_label' => env(
            'BRAND_YEARS_EXPERIENCE_LABEL',
            '15+ Tahun Pengalaman'
        ),
        // Instruksi transfer di halaman konfirmasi order (public). Override via .env bila perlu.
        'bank' => [
            'bank_name' => env('BANK_NAME', 'BCA'),
            'account_name' => env('BANK_ACCOUNT_NAME', 'Ragil Aluminium'),
            'account_number' => env('BANK_ACCOUNT_NUMBER', '1234567890'),
            'notes' => env(
                'BANK_TRANSFER_NOTES',
                'Transfer tepat sesuai total tagihan. Cantumkan nomor pesanan di berita transfer, lalu kirim bukti pembayaran via WhatsApp.'
            ),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Channel toko: marketplace (jual-beli) vs media sosial (konten)
    | Marketplace: Shopee / Tokopedia / Lazada / TikTok Shop.
    | Facebook / YouTube / Instagram / TikTok = social, bukan marketplace.
    | Tampil di: Informasi Toko (/about) + Footer.
    | Edit URL: Admin → Pengaturan Website → Marketplace & Media Sosial
    |   (`admin.storefront-platforms.*` → cms_pages.storefront-platforms.content.links).
    | Catalog key/label/channel/icon tetap di sini; env SOCIAL_* = fallback awal saja.
    |--------------------------------------------------------------------------
    */
    'platforms' => [
        ['key' => 'shopee', 'label' => 'Shopee', 'channel' => 'marketplace', 'href' => env('SOCIAL_SHOPEE', '#'), 'icon' => '/images/icons/social/shopee.svg'],
        ['key' => 'tokopedia', 'label' => 'Tokopedia', 'channel' => 'marketplace', 'href' => env('SOCIAL_TOKOPEDIA', '#'), 'icon' => '/images/icons/social/tokopedia.png'],
        ['key' => 'lazada', 'label' => 'Lazada', 'channel' => 'marketplace', 'href' => env('SOCIAL_LAZADA', '#'), 'icon' => '/images/icons/social/lazada.png'],
        ['key' => 'tiktok_shop', 'label' => 'TikTok Shop', 'channel' => 'marketplace', 'href' => env('SOCIAL_TIKTOK_SHOP', '#'), 'icon' => '/images/icons/social/tiktok.svg'],
        ['key' => 'instagram', 'label' => 'Instagram', 'channel' => 'social', 'href' => env('SOCIAL_INSTAGRAM', '#'), 'icon' => '/images/icons/social/instagram.svg'],
        ['key' => 'tiktok', 'label' => 'TikTok', 'channel' => 'social', 'href' => env('SOCIAL_TIKTOK', '#'), 'icon' => '/images/icons/social/tiktok.svg'],
        ['key' => 'youtube', 'label' => 'YouTube', 'channel' => 'social', 'href' => env('SOCIAL_YOUTUBE', '#'), 'icon' => '/images/icons/social/youtube.svg'],
        ['key' => 'facebook', 'label' => 'Facebook', 'channel' => 'social', 'href' => env('SOCIAL_FACEBOOK', '#'), 'icon' => '/images/icons/social/facebook.svg'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Announcement bar (ticker merah di atas navbar)
    |--------------------------------------------------------------------------
    | Sumber: items di bawah + CMS banners (include_cms_banners) + hero promos (include_homepage_promos).
    | Hanya item dengan jadwal aktif (starts_at / ends_at) yang ditampilkan.
    | Tiap item wajib tujuan klik: href ATAU route (+ params).
    | UI: ticker slide otomatis di bar atas header (bukan teks statis).
    |
    | Copy rules (wajib):
    | - Boleh: diskon, promo, periode promo, subsidi ongkir, benefit toko (COD/garansi/kirim), ajakan model.
    | - Fokus model (Jungkit / Swing / Sliding), bukan ukuran SKU.
    | - Flash Sale di ticker HANYA dari periode kampanye live (FlashSalePeriodSettings) — maksimal 1 item.
    |   Jangan taruh teks "Flash Sale" di items/CMS/banner; produk Flash Sale dipilih pelanggan di /flash-sale atau search.
    | - Dilarang: "obral", "stok terbatas", "kuota habis", atau implikasi stok menipis.
    |   Stok produk selalu tersedia; yang terbatas hanya masa promo/diskon.
    |   Runtime juga memfilter frasa terlarang + teriakan Flash Sale di luar slot periode.
    |
    | Edit: config/sitemap.php → announcement.items
    | Runtime: App\Support\ActiveAnnouncements → Inertia share `announcements`
    | Flash Sale periode live → maksimal 1 item ticker (bukan per produk).
    */
    'announcement' => [
        'enabled' => true,
        'include_cms_banners' => true,
        'include_homepage_promos' => true,
        'items' => [
            [
                'text' => 'Promo Boven Jungkit: harga miring untuk model favorit rumah Indonesia',
                'route' => 'catalog.bouven',
                'params' => ['model' => 'JUNGKIT'],
                'starts_at' => '2026-07-01',
                'ends_at' => '2026-09-30',
            ],
            [
                'text' => 'Diskon model Swing dan Sliding: jendela aluminium siap pilih dan bisa custom',
                'route' => 'catalog.windows',
                'params' => ['sort' => 'newest'],
                'starts_at' => '2026-07-01',
                'ends_at' => '2026-09-30',
            ],
            [
                'text' => 'Pintu aluminium promo aktif. Bandingkan model di katalog sekarang',
                'route' => 'catalog.doors',
                'starts_at' => '2026-07-01',
                'ends_at' => '2026-09-30',
            ],
            [
                'text' => 'COD, garansi 100%, dan kirim ke seluruh Indonesia',
                'route' => 'catalog.promo',
                'starts_at' => '2026-07-01',
                'ends_at' => '2026-12-31',
            ],
            [
                'text' => 'Butuh ukuran khusus? Konsultasi gratis via WhatsApp toko',
                'route' => 'contact',
                'starts_at' => '2026-07-01',
                'ends_at' => '2026-12-31',
            ],
        ],
    ],
];
