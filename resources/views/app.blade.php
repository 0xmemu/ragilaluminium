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
            : config('sitemap.brand.name', config('app.name')).' - jendela & boven aluminium berkualitas untuk rumah dan bangunan Anda. Lihat katalog, harga, dan promo terbaru.';
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
             Paddingnya mengikuti AdminShell sebenarnya: sidebar 15rem, header
             h-14, judul px-4 pt-6 pb-5 md:px-6 lg:px-8, konten px-4 pt-4
             md:px-6 md:pt-5 lg:px-8 lg:pb-10.
             React createRoot().render() otomatis menggantikan isi #app. --}}
        <style>
            .skel { border-radius: .375rem; background: rgba(128,128,128,.18); animation: skel-pulse 1.4s ease-in-out infinite; }
            .skel-flat { border-radius: 0; }
            .skel-panel { border-radius: .5rem; border: 1px solid rgba(128,128,128,.16); background: rgba(128,128,128,.08); }
            .skel-card { border-radius: .5rem; overflow: hidden; border: 1px solid rgba(128,128,128,.14); background: rgba(128,128,128,.06); }
            .skel-fallback { display: flex; min-height: 100vh; flex-direction: column; align-items: center; justify-content: center; gap: .75rem; padding: 2rem; text-align: center; }
            @keyframes skel-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }
            @media (prefers-reduced-motion: reduce) { .skel { animation: none } }
        </style>
        <template id="app-skel-template">
            <div id="app-skeleton" aria-busy="true">
                <div class="min-h-screen bg-background lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
                    <aside class="sticky top-0 hidden h-screen border-r border-border lg:block">
                        <div class="flex h-14 shrink-0 items-center border-b border-border px-3">
                            <div class="skel h-7 w-32"></div>
                        </div>
                        <div class="flex flex-col gap-1.5 px-2.5 py-3">
                            <div class="skel h-2.5 w-20"></div>
                            <div class="skel h-9 w-full"></div>
                            <div class="skel h-9 w-full"></div>
                            <div class="skel h-9 w-full"></div>
                            <div class="skel mt-2 h-2.5 w-24"></div>
                            <div class="skel h-9 w-full"></div>
                            <div class="skel h-9 w-full"></div>
                        </div>
                    </aside>
                    <div class="min-w-0">
                        <header class="flex h-14 items-center gap-2 border-b border-border px-4 md:px-6">
                            <div class="skel h-9 w-full max-w-xs"></div>
                            <div class="ml-auto flex items-center gap-1.5">
                                <div class="skel size-8 rounded-full"></div>
                                <div class="skel size-8 rounded-full"></div>
                                <div class="skel h-8 w-28 rounded-full"></div>
                            </div>
                        </header>
                        <div class="px-4 pb-5 pt-6 md:px-6 lg:px-8">
                            <div class="skel h-3 w-40"></div>
                            <div class="skel mt-6 h-6 w-72 max-w-full"></div>
                            <div class="skel mt-2 h-3 w-56 max-w-full"></div>
                        </div>
                        <div class="px-4 pb-24 pt-4 md:px-6 md:pt-5 lg:px-8 lg:pb-10">
                            <div class="skel-panel min-h-[14rem]"></div>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <script>
            (function () {
                var mount = document.getElementById('app');
                var template = document.getElementById('app-skel-template');
                if (!mount || !template) return;
                if (mount.children.length === 0) {
                    mount.appendChild(template.content.cloneNode(true));
                }
                // Jaring pengaman: bila bundle JS gagal dimuat (mis. 404 tepat saat
                // deploy karena Vite menghapus public/build tiap build), skeleton
                // akan macet selamanya. Setelah 8 detik ganti dengan tombol muat
                // ulang supaya admin tidak buntu di layar abu-abu.
                window.setTimeout(function () {
                    var skeleton = document.getElementById('app-skeleton');
                    if (!skeleton) return;
                    skeleton.className = 'skel-fallback';
                    skeleton.innerHTML =
                        '<p style="margin:0;font-size:15px;font-weight:600">Panel admin gagal dimuat</p>' +
                        '<p style="margin:0;max-width:24rem;font-size:13px;opacity:.7">Koneksi terputus atau aplikasi baru saja diperbarui. Muat ulang halaman untuk melanjutkan.</p>' +
                        '<button type="button" onclick="window.location.reload()" style="margin-top:.5rem;border:0;border-radius:9999px;background:#c20000;color:#fff;padding:.625rem 1.5rem;font-size:14px;font-weight:600;cursor:pointer">Muat ulang halaman</button>';
                }, 8000);
            })();
        </script>
    @else
        {{-- Skeleton etalase publik, mengikuti halaman yang sedang dimuat.
             Bentuk dan paddingnya memakai class yang sama dengan komponen asli
             (container-page, grid katalog, dsb.) sehingga cocok dengan halaman
             sebenarnya. Tanpa ini layar putih 2,3 detik di beranda dan 2,0 detik
             di katalog. React createRoot().render() menggantikan isi #app saat
             mount. --}}
        @php
            $skelComponent = is_array($page ?? null) ? (string) ($page['component'] ?? '') : '';
            $skelKind = 'default';
            if ($skelComponent === 'Public/Home') {
                $skelKind = 'home';
            } elseif ($skelComponent === 'Public/ProductDetail') {
                $skelKind = 'product';
            } elseif ($skelComponent === 'Public/Cart') {
                $skelKind = 'cart';
            } elseif (str_starts_with($skelComponent, 'Public/Catalog')
                || in_array($skelComponent, ['Public/ModelProduk', 'Public/Installations', 'Public/Reviews'], true)) {
                $skelKind = 'listing';
            }
        @endphp
        <style>
            .skel { border-radius: .375rem; background: rgba(128,128,128,.18); animation: skel-pulse 1.4s ease-in-out infinite; }
            .skel-flat { border-radius: 0; }
            .skel-panel { border-radius: .5rem; border: 1px solid rgba(128,128,128,.16); background: rgba(128,128,128,.08); }
            .skel-card { border-radius: 5px; overflow: hidden; border: 1px solid rgba(128,128,128,.14); background: rgba(128,128,128,.06); }
            .skel-fallback { display: flex; min-height: 100vh; flex-direction: column; align-items: center; justify-content: center; gap: .75rem; padding: 2rem; text-align: center; }
            @keyframes skel-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }
            @media (prefers-reduced-motion: reduce) { .skel { animation: none } }
        </style>
        <template id="app-skel-template">
            <div id="app-skeleton" aria-busy="true" class="min-h-screen bg-background">
                {{-- Announcement bar (hanya beranda) + header publik --}}
                @if ($skelKind === 'home')
                    <div class="skel skel-flat h-8"></div>
                @endif
                <div class="skel skel-flat h-14"></div>

                @if ($skelKind === 'home')
                    {{-- Beranda: hero full-bleed, lalu section dengan grid 2 kolom --}}
                    <div class="skel skel-flat h-[186px] lg:h-[420px]"></div>
                    <section class="bg-surface py-2.5">
                        <div class="container-page !px-2.5 md:!px-8 lg:!px-12">
                            <div class="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:gap-4 lg:max-w-none">
                                <div class="skel-panel h-[182px] lg:h-[204px]"></div>
                                <div class="skel-panel h-[182px] lg:h-[204px]"></div>
                            </div>
                        </div>
                    </section>
                    <section class="py-2.5">
                        <div class="container-page !px-2.5 md:!px-8 lg:!px-12">
                            <div class="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:gap-4 lg:max-w-none">
                                <div class="skel-panel h-[182px] lg:h-[204px]"></div>
                                <div class="skel-panel h-[182px] lg:h-[204px]"></div>
                            </div>
                        </div>
                    </section>
                @elseif ($skelKind === 'listing')
                    {{-- Katalog dan sejenisnya: bar filter + bar urutan + grid kartu --}}
                    <section class="border-b border-border bg-surface">
                        <div class="container-page !px-2.5 md:!px-8 lg:!px-12 py-4">
                            <div class="skel h-4 w-52 max-w-full"></div>
                            <div class="mt-3 flex flex-wrap gap-2">
                                <div class="skel h-8 w-24"></div>
                                <div class="skel h-8 w-28"></div>
                                <div class="skel h-8 w-24"></div>
                            </div>
                        </div>
                    </section>
                    <section class="bg-surface">
                        <div class="container-page !px-2.5 md:!px-8 lg:!px-12 py-3">
                            <div class="skel h-3 w-40"></div>
                        </div>
                    </section>
                    <section class="container-page !px-2.5 py-2.5 md:!px-8 lg:!px-12">
                        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        <div class="skel-card">
                            <div class="skel skel-flat aspect-square"></div>
                            <div class="flex flex-col gap-1.5 p-2.5">
                                <div class="skel h-3 w-[85%]"></div>
                                <div class="skel h-4 w-[55%]"></div>
                            </div>
                        </div>
                        </div>
                    </section>
                @elseif ($skelKind === 'product')
                    {{-- Halaman produk: bar breadcrumb, lalu galeri + info berdampingan --}}
                    <section class="hidden border-b border-border bg-surface md:block">
                        <div class="container-page !px-2.5 md:!px-8 lg:!px-12 py-3">
                            <div class="skel h-3 w-56"></div>
                        </div>
                    </section>
                    <section class="container-page !px-2.5 pb-4 pt-0 md:!px-8 lg:!px-12 lg:pt-5 lg:pb-5">
                        <div class="grid gap-6 lg:grid-cols-[480px_minmax(0,1fr)] lg:gap-8">
                            <div class="flex flex-col gap-2">
                                <div class="skel skel-flat aspect-square w-full rounded-lg"></div>
                                <div class="grid grid-cols-5 gap-2">
                                    <div class="skel aspect-square"></div>
                                    <div class="skel aspect-square"></div>
                                    <div class="skel aspect-square"></div>
                                    <div class="skel aspect-square"></div>
                                    <div class="skel aspect-square"></div>
                                </div>
                            </div>
                            <div class="flex flex-col gap-3">
                                <div class="skel h-6 w-[80%]"></div>
                                <div class="skel h-4 w-[45%]"></div>
                                <div class="skel mt-2 h-9 w-[55%]"></div>
                                <div class="skel mt-2 h-10 w-full"></div>
                                <div class="skel h-10 w-full"></div>
                                <div class="skel mt-2 h-11 w-full"></div>
                                <div class="skel h-11 w-full"></div>
                            </div>
                        </div>
                    </section>
                @elseif ($skelKind === 'cart')
                    {{-- Keranjang: judul, daftar item, ringkasan --}}
                    <section class="border-b border-border bg-surface">
                        <div class="container-page !px-2.5 md:!px-8 lg:!px-12 py-4">
                            <div class="skel h-5 w-40"></div>
                        </div>
                    </section>
                    <section class="container-page !px-2.5 py-2.5 md:!px-8 lg:!px-12">
                        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
                            <div class="flex flex-col gap-3">
                                <div class="skel-panel flex gap-3 p-3">
                                    <div class="skel size-20 shrink-0"></div>
                                    <div class="flex flex-1 flex-col gap-2">
                                        <div class="skel h-4 w-[70%]"></div>
                                        <div class="skel h-3 w-[40%]"></div>
                                        <div class="skel h-4 w-[30%]"></div>
                                    </div>
                                </div>
                                <div class="skel-panel flex gap-3 p-3">
                                    <div class="skel size-20 shrink-0"></div>
                                    <div class="flex flex-1 flex-col gap-2">
                                        <div class="skel h-4 w-[65%]"></div>
                                        <div class="skel h-3 w-[35%]"></div>
                                        <div class="skel h-4 w-[30%]"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="skel-panel flex flex-col gap-3 p-4">
                                <div class="skel h-4 w-32"></div>
                                <div class="skel h-3 w-full"></div>
                                <div class="skel h-3 w-[80%]"></div>
                                <div class="skel h-3 w-[60%]"></div>
                                <div class="skel mt-2 h-10 w-full"></div>
                            </div>
                        </div>
                    </section>
                @else
                    {{-- Halaman teks/statis: judul + paragraf --}}
                    <section class="container-page !px-2.5 py-4 md:!px-8 lg:!px-12 lg:py-8">
                        <div class="skel h-6 w-64 max-w-full"></div>
                        <div class="skel mt-2 h-3 w-80 max-w-full"></div>
                        <div class="skel-panel mt-5 flex flex-col gap-3 p-4">
                            <div class="skel h-3 w-full"></div>
                            <div class="skel h-3 w-[92%]"></div>
                            <div class="skel h-3 w-[86%]"></div>
                            <div class="skel h-3 w-[70%]"></div>
                            <div class="skel mt-2 h-3 w-[88%]"></div>
                            <div class="skel h-3 w-[64%]"></div>
                        </div>
                    </section>
                @endif
            </div>
        </template>
        <script>
            (function () {
                var mount = document.getElementById('app');
                var template = document.getElementById('app-skel-template');
                if (!mount || !template) return;
                if (mount.children.length === 0) {
                    mount.appendChild(template.content.cloneNode(true));
                }
                // Jaring pengaman: bila bundle JS gagal dimuat (mis. 404 tepat saat
                // deploy karena Vite menghapus public/build tiap build), skeleton
                // akan macet selamanya. Setelah 8 detik ganti dengan tombol muat
                // ulang supaya pengunjung tidak buntu di layar abu-abu.
                window.setTimeout(function () {
                    var skeleton = document.getElementById('app-skeleton');
                    if (!skeleton) return;
                    skeleton.className = 'skel-fallback';
                    skeleton.innerHTML =
                        '<p style="margin:0;font-size:15px;font-weight:600">Halaman gagal dimuat</p>' +
                        '<p style="margin:0;max-width:24rem;font-size:13px;opacity:.7">Koneksi terputus atau situs baru saja diperbarui. Muat ulang halaman untuk melanjutkan.</p>' +
                        '<button type="button" onclick="window.location.reload()" style="margin-top:.5rem;border:0;border-radius:9999px;background:#c20000;color:#fff;padding:.625rem 1.5rem;font-size:14px;font-weight:600;cursor:pointer">Muat ulang halaman</button>';
                }, 8000);
            })();
        </script>
    @endif
    <script>
      // Service Worker (PWA): hanya production & bila didukung
      if ("serviceWorker" in navigator && location.hostname !== "localhost") {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("{{ asset('sw.js') }}").catch(function () {});
        });
      }
    </script>
</body>
</html>
