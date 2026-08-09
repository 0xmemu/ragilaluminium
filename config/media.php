<?php

/*
|--------------------------------------------------------------------------
| Media Ingestion & Delivery (import gambar dari URL Shopee)
|--------------------------------------------------------------------------
| Gambar diunduh dari source_url, diturunkan ke WebP thumb/card/pdp, lalu
| disimpan ke disk `media` (local atau R2/S3). Default: jangan simpan JPG/PNG
| original (MEDIA_KEEP_ORIGINAL=false) — stored_path = WebP pdp. Frontend
| memakai URL turunan; source_url hanya arsip unduh ulang.
*/

return [
    // Host yang diizinkan sebagai sumber unduhan (anti-SSRF). Kosong = izinkan
    // semua host publik (private/reserved IP tetap diblokir).
    'allowed_source_hosts' => array_filter(explode(',', (string) env('MEDIA_ALLOWED_HOSTS', 'cf.shopee.co.id,down-id.img.susercontent.com,cvws.img.susercontent.com,deo.shopeemobile.com'))),

    'max_bytes' => (int) env('MEDIA_MAX_BYTES', 10 * 1024 * 1024), // 10 MB image
    'max_video_bytes' => (int) env('MEDIA_MAX_VIDEO_BYTES', 50 * 1024 * 1024), // 50 MB video
    'download_timeout' => (int) env('MEDIA_DOWNLOAD_TIMEOUT', 60),
    'allowed_mime' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    'allowed_video_mime' => ['video/mp4', 'video/webm', 'video/quicktime'],

    // Disk name in config/filesystems.php (`media` switches local vs s3 via MEDIA_DISK).
    'disk' => 'media',

    // When false, ProductMedia never falls back to Shopee source_url (use placeholder).
    'allow_source_url_fallback' => filter_var(
        env('MEDIA_ALLOW_SOURCE_FALLBACK', env('APP_ENV', 'production') !== 'production'),
        FILTER_VALIDATE_BOOL
    ),

    // Max edge length (px) for WebP derivatives (longest side).
    'derivatives' => [
        'thumb' => (int) env('MEDIA_DERIV_THUMB', 400),
        'card' => (int) env('MEDIA_DERIV_CARD', 800),
        'pdp' => (int) env('MEDIA_DERIV_PDP', 1400),
    ],

    // When false (default): after WebP thumb/card/pdp succeed, do not keep the heavy
    // JPG/PNG original on disk. `stored_path` points at the largest WebP (`pdp`).
    // Re-download from `source_url` if a larger master is needed later.
    // Set MEDIA_KEEP_ORIGINAL=true only if you need permanent full-resolution archives.
    'keep_original' => filter_var(env('MEDIA_KEEP_ORIGINAL', false), FILTER_VALIDATE_BOOL),

    'webp_quality' => (int) env('MEDIA_WEBP_QUALITY', 82),

    // Public path under /public used when no stored media (relative to app URL via asset()).
    'placeholder' => env('MEDIA_PLACEHOLDER', 'images/home/product-flash.png'),
];
