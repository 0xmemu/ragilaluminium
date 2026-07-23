<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#F4F6F5">
    <title inertia>{{ config('sitemap.brand.name', config('app.name')) }}</title>
    @if(file_exists(public_path('images/site-favicon.ico')))
        <link rel="icon" href="{{ asset('images/site-favicon.ico') }}?v={{ filemtime(public_path('images/site-favicon.ico')) }}">
    @endif
    @routes
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="min-h-screen bg-background text-foreground antialiased">
    @inertia
</body>
</html>
