<!DOCTYPE html>
<html lang="id">
<head>
    @php
        $pageProps = is_array($page ?? null) ? ($page['props'] ?? []) : [];
        $pdpProduct = is_array($pageProps['product'] ?? null) ? $pageProps['product'] : null;
        $isPdp = request()->routeIs('product.show') && $pdpProduct !== null;
        $metaTitle = $isPdp
            ? (string) ($pdpProduct['name'] ?? $pdpProduct['subtitle'] ?? config('sitemap.brand.name', config('app.name')))
            : config('sitemap.brand.name', config('app.name'));
        $metaDescription = $isPdp
            ? \Illuminate\Support\Str::limit((string) ($pdpProduct['description'] ?? $pdpProduct['subtitle'] ?? $metaTitle), 200)
            : config('sitemap.brand.name', config('app.name')).' — jendela & boven aluminium berkualitas untuk rumah dan bangunan Anda. Lihat katalog, harga, dan promo terbaru.';
        $pdpImage = is_array($pageProps['media'] ?? null) ? (($pageProps['media'][0]['url'] ?? null) ?: null) : null;
        $metaImage = $pdpImage
            ? (preg_match('/^https?:\/\//i', $pdpImage) ? $pdpImage : asset(ltrim($pdpImage, '/')))
            : asset('images/og-default.png');
        $variantParam = request()->query('variant', request()->query('variant_sku'));
        $metaUrl = $isPdp
            ? url()->current().($variantParam ? '?'.http_build_query(['variant' => $variantParam]) : '')
            : url()->current();
    @endphp
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#F4F6F5">
    <title inertia>{{ $metaTitle }}</title>
    <meta name="description" content="{{ $metaDescription }}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="{{ url()->current() }}">
    {{-- Preload logo hamburger: Sheet (radix) baru me-mount kontennya saat dibuka, jadi logo
         light-logo.png di-download terlambat → muncul setelah menu terbuka. Preload di head
         memastikan logo sudah di cache sebelum interaksi. --}}
    <link rel="preload" as="image" href="{{ asset('images/brand/light-logo.png') }}">
    <meta property="og:type" content="{{ $isPdp ? 'product' : 'website' }}">
    <meta property="og:site_name" content="{{ config('sitemap.brand.name', config('app.name')) }}">
    <meta property="og:title" content="{{ $metaTitle }}">
    <meta property="og:description" content="{{ $metaDescription }}">
    <meta property="og:url" content="{{ $metaUrl }}">
    <meta property="og:image" content="{{ $metaImage }}">
    <meta property="og:locale" content="id_ID">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $metaTitle }}">
    <meta name="twitter:description" content="{{ $metaDescription }}">
    <meta name="twitter:image" content="{{ $metaImage }}">
    @if(file_exists(public_path('images/site-favicon.ico')))
        <link rel="icon" href="{{ asset('images/site-favicon.ico') }}?v={{ filemtime(public_path('images/site-favicon.ico')) }}">
    @else
        <link rel="icon" href="{{ asset('favicon.ico') }}">
    @endif
    <link rel="apple-touch-icon" href="{{ asset('images/site-logo.png') }}">
    <link rel="manifest" href="{{ asset('manifest.json') }}">
    @routes
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="min-h-screen bg-background text-body antialiased">
    @inertia
    @if (request()->is('admin', 'admin/*'))
        {{-- Skeleton panel admin. Ditulis langsung di HTML supaya browser
             mengecatnya sebelum React selesai mount. Tanpa ini layar putih
             0,7 detik pada jaringan normal dan sampai 3,6 detik pada jaringan
             lambat setiap kali halaman dimuat ulang penuh.
             React createRoot().render() otomatis menggantikan isi #app. --}}
        <style>
            .admin-skel { display: flex; min-height: 100vh; }
            .admin-skel__side { width: 15rem; flex: none; border-right: 1px solid rgba(128,128,128,.22); padding: 1rem; display: flex; flex-direction: column; gap: .75rem; }
            .admin-skel__main { flex: 1; min-width: 0; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
            .admin-skel__bar { border-radius: .375rem; background: rgba(128,128,128,.18); animation: admin-skel-pulse 1.4s ease-in-out infinite; }
            .admin-skel__logo { height: 2rem; width: 65%; }
            .admin-skel__group { height: .625rem; width: 45%; margin-top: .5rem; }
            .admin-skel__row { height: 1.75rem; }
            .admin-skel__head { height: 2.25rem; width: 100%; }
            .admin-skel__title { height: 1.5rem; width: 30%; margin-top: 1.5rem; }
            .admin-skel__sub { height: .75rem; width: 50%; }
            .admin-skel__panel { flex: 1; min-height: 14rem; border-radius: .5rem; border: 1px solid rgba(128,128,128,.16); background: rgba(128,128,128,.08); }
            .admin-skel__fallback { display: flex; min-height: 100vh; flex-direction: column; align-items: center; justify-content: center; gap: .75rem; padding: 2rem; text-align: center; }
            @keyframes admin-skel-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }
            @media (max-width: 1023px) { .admin-skel__side { display: none } }
            @media (prefers-reduced-motion: reduce) { .admin-skel__bar { animation: none } }
        </style>
        <template id="admin-skel-template">
            <div id="app-skeleton" class="admin-skel" aria-busy="true">
                <div class="admin-skel__side">
                    <div class="admin-skel__bar admin-skel__logo"></div>
                    <div class="admin-skel__bar admin-skel__group"></div>
                    <div class="admin-skel__bar admin-skel__row"></div>
                    <div class="admin-skel__bar admin-skel__row"></div>
                    <div class="admin-skel__bar admin-skel__row"></div>
                    <div class="admin-skel__bar admin-skel__group"></div>
                    <div class="admin-skel__bar admin-skel__row"></div>
                    <div class="admin-skel__bar admin-skel__row"></div>
                </div>
                <div class="admin-skel__main">
                    <div class="admin-skel__bar admin-skel__head"></div>
                    <div class="admin-skel__bar admin-skel__title"></div>
                    <div class="admin-skel__bar admin-skel__sub"></div>
                    <div class="admin-skel__panel"></div>
                </div>
            </div>
        </template>
        <script>
            (function () {
                var mount = document.getElementById('app');
                var template = document.getElementById('admin-skel-template');
                if (!mount || !template) return;
                if (mount.children.length === 0) {
                    mount.appendChild(template.content.cloneNode(true));
                }
                // Jaring pengaman: bila bundle JS gagal dimuat (mis. 404 tepat saat
                // deploy, karena Vite menghapus public/build tiap build), skeleton
                // akan macet selamanya. Setelah 8 detik ganti dengan tombol muat
                // ulang supaya admin tidak buntu di layar abu-abu.
                window.setTimeout(function () {
                    var skeleton = document.getElementById('app-skeleton');
                    if (!skeleton) return;
                    skeleton.className = 'admin-skel__fallback';
                    skeleton.innerHTML =
                        '<p style="margin:0;font-size:15px;font-weight:600">Panel admin gagal dimuat</p>' +
                        '<p style="margin:0;max-width:24rem;font-size:13px;opacity:.7">Koneksi terputus atau aplikasi baru saja diperbarui. Muat ulang halaman untuk melanjutkan.</p>' +
                        '<button type="button" onclick="window.location.reload()" style="margin-top:.5rem;border:0;border-radius:9999px;background:#c20000;color:#fff;padding:.625rem 1.5rem;font-size:14px;font-weight:600;cursor:pointer">Muat ulang halaman</button>';
                }, 8000);
            })();
        </script>
    @endif
    <script>
      // Service Worker (PWA) — hanya production & bila didukung
      if ("serviceWorker" in navigator && location.hostname !== "localhost") {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("{{ asset('sw.js') }}").catch(function () {});
        });
      }
    </script>
</body>
</html>
