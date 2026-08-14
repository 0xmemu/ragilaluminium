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
    @routes
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="min-h-screen bg-background text-body antialiased">
    @inertia
</body>
</html>
