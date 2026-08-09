<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#F4F6F5">
    <title inertia>{{ config('sitemap.brand.name', config('app.name')) }}</title>
    <meta name="description" content="{{ config('sitemap.brand.name', config('app.name')) }} — jendela & boven aluminium berkualitas untuk rumah dan bangunan Anda. Lihat katalog, harga, dan promo terbaru.">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="{{ url()->current() }}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="{{ config('sitemap.brand.name', config('app.name')) }}">
    <meta property="og:title" content="{{ config('sitemap.brand.name', config('app.name')) }}">
    <meta property="og:description" content="Jendela & boven aluminium berkualitas untuk rumah dan bangunan Anda. Lihat katalog, harga, dan promo terbaru.">
    <meta property="og:url" content="{{ url()->current() }}">
    <meta property="og:image" content="{{ asset('images/og-default.png') }}">
    <meta property="og:locale" content="id_ID">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ config('sitemap.brand.name', config('app.name')) }}">
    <meta name="twitter:description" content="Jendela & boven aluminium berkualitas untuk rumah dan bangunan Anda.">
    <meta name="twitter:image" content="{{ asset('images/og-default.png') }}">
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
