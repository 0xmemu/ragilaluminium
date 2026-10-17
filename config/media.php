<?php

/*
|--------------------------------------------------------------------------
| Media Ingestion & Delivery (import gambar dari URL Shopee)
|--------------------------------------------------------------------------
| Gambar diunduh dari source_url, diturunkan ke WebP thumb/card/pdp, lalu
| disimpan ke disk `media` (local atau R2/S3). Default: jangan simpan JPG/PNG
| original (MEDIA_KEEP_ORIGINAL=false), stored_path = WebP pdp. Frontend
| memakai URL turunan; source_url hanya arsip unduh ulang.
*/

return [
    // Daftar host sumber yang DIIZINKAN secara eksplisit. Kosong (bawaan) =
    // semua host publik diterima, dan satu-satunya syarat adalah berkasnya
    // benar-benar bisa diunduh. Penjagaan SSRF (IP privat/loopback) tetap
    // berjalan di UrlGuard, jadi mengosongkan daftar ini tidak membuka akses
    // ke jaringan internal.
    //
    // Isi hanya bila owner ingin MEMBATASI sumber ke host tertentu; itu
    // pengerasan tambahan, bukan syarat normal.
    'allowed_source_hosts' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('MEDIA_ALLOWED_HOSTS', ''))
    ))),

    // Identitas peramban saat mengunduh dan memeriksa media. Banyak CDN
    // menolak permintaan tanpa User-Agent (mis. Wikimedia membalas 403),
    // sehingga foto dari host lain gagal padahal berkasnya ada.
    'user_agent' => (string) env(
        'MEDIA_USER_AGENT',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    ),
    'accept_header' => 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',

    // Periksa file menguji apakah URL media eksternal benar-benar bisa
    // diunduh. Bisa dimatikan di lingkungan test supaya tidak menembak jaringan.
    'preview_probe' => filter_var(env('MEDIA_PREVIEW_PROBE', true), FILTER_VALIDATE_BOOL),
    'preview_probe_timeout' => (int) env('MEDIA_PREVIEW_PROBE_TIMEOUT', 5),
    // Test memakai host palsu sehingga pemeriksaan DNS dimatikan di sana.
    'probe_dns_check' => filter_var(env('MEDIA_PROBE_DNS_CHECK', true), FILTER_VALIDATE_BOOL),

    // Jumlah baris rincian yang dikirim ke layar. Pemeriksaan tetap menyentuh
    // SEMUA baris; angka ini hanya batas tampilan tabel.
    'preview_display_rows' => (int) env('MEDIA_PREVIEW_DISPLAY_ROWS', 500),

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

    // Batas umur niat unggah yang tidak pernah memberi kabar (menit) sebelum
    // ditandai "terputus" oleh media:close-stale-intents. Harus lebih panjang
    // daripada unggahan terlama yang wajar: video 50 MB pada 0,6 MB/detik butuh
    // sekitar 85 detik, dan koneksi admin bisa jauh lebih lambat.
    'upload_intent_timeout_minutes' => (int) env('MEDIA_UPLOAD_INTENT_TIMEOUT_MINUTES', 30),

    // Catatan niat unggah lebih tua dari ini (hari) dipangkas. Tabelnya alat bantu
    // operasional, bukan buku besar audit, jadi tidak perlu tumbuh tanpa batas.
    'upload_intent_retention_days' => (int) env('MEDIA_UPLOAD_INTENT_RETENTION_DAYS', 14),

    // Retensi log riwayat pemrosesan media (hari), otomatis dipangkas oleh media:prune-logs
    'log_retention_days' => (int) env('MEDIA_LOG_RETENTION_DAYS', 30),
];
