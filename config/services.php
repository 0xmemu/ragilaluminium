<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | WhatsApp provider (Baileys-only; legacy Meta API diarsipkan)
    |--------------------------------------------------------------------------
    */

    'whatsapp' => [
        'allow_unsigned_webhooks' => (bool) env('WHATSAPP_ALLOW_UNSIGNED_WEBHOOKS', false),
        'default_provider' => env('WHATSAPP_PROVIDER', 'baileys'),
        'compare_provider' => env('WHATSAPP_COMPARE_PROVIDER'),
        'compare_allowlist' => array_values(array_filter(array_map(
            static fn (?string $phone) => $phone !== null ? trim($phone) : null,
            explode(',', (string) env('WHATSAPP_COMPARE_ALLOWLIST', ''))
        ))),
        // Legacy Stage 8 aliases keep existing callers stable and map to Meta.
        'base_url' => env('WHATSAPP_API_BASE_URL', 'https://graph.facebook.com/v20.0'),
        'token' => env('WHATSAPP_API_TOKEN'),
        'number_id' => env('WHATSAPP_BUSINESS_NUMBER_ID'),
        'verify_token' => env('WHATSAPP_VERIFY_TOKEN'),
        'app_secret' => env('WHATSAPP_APP_SECRET'),
        'business_phone' => env('WHATSAPP_BUSINESS_PHONE'),
        // Footer otomatis yang ditempelkan ke SEMUA pesan template
        // (kontrak anti-flag spam 2026-09-03). Teks ini juga ditampilkan
        // sebagai bacaan di /admin/whatsapp/templates supaya tidak ada
        // teks pesan yang hanya hidup di kode.
        'reply_signature' => env(
            'WHATSAPP_REPLY_SIGNATURE',
            // Owner 2026-09-15: footer balasan tidak lagi ditambahkan otomatis.
            '',
        ),
        'language' => env('WHATSAPP_LANGUAGE', 'id'),
        'timeout' => (int) env('WHATSAPP_TIMEOUT', 15),
        'baileys' => [
            'base_url' => env('WHATSAPP_BAILEYS_BASE_URL'),
            'api_key' => env('WHATSAPP_BAILEYS_API_KEY'),
            'session' => env('WHATSAPP_BAILEYS_SESSION', 'default'),
            'webhook_secret' => env('WHATSAPP_BAILEYS_WEBHOOK_SECRET'),
            'timeout' => (int) env('WHATSAPP_BAILEYS_TIMEOUT', env('WHATSAPP_TIMEOUT', 15)),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Shipping Providers (Stage 4)
    |--------------------------------------------------------------------------
    */

    'shipping' => [
        'jnt' => [
            'base_url' => env('SHIPPING_JNT_BASE_URL'),
            'api_key' => env('SHIPPING_JNT_API_KEY'),
            'customer_id' => env('SHIPPING_JNT_CUSTOMER_ID'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Cloudflare
    |--------------------------------------------------------------------------
    |
    | Tunnel adalah pintu masuk seluruh trafik produksi, jadi kesehatannya
    | diperiksa langsung dari endpoint metrics cloudflared di loopback.
    | Endpoint metrics sudah tersedia tanpa token karena dijalankan oleh
    | proses tunnel itu sendiri.
    |
    | API zona bersifat opsional: dipakai untuk analitik tingkat zona
    | (permintaan, cache, ancaman). Bila token belum diisi, pemeriksaan
    | melaporkan "belum dikonfigurasi" secara jujur, bukan sehat.
    |
    */

    'cloudflare' => [
        'tunnel_metrics_url' => env('CLOUDFLARE_TUNNEL_METRICS_URL', 'http://127.0.0.1:20241/metrics'),
        'api_token' => env('CLOUDFLARE_API_TOKEN'),
        'account_id' => env('CLOUDFLARE_ACCOUNT_ID', '474a54069f4a16c84c33c26d012bfe6a'),
        'r2_quota_gb' => (float) env('CLOUDFLARE_R2_QUOTA_GB', 10.0),
        'zone_id' => env('CLOUDFLARE_ZONE_ID'),
        'hostname' => env('CLOUDFLARE_TUNNEL_HOSTNAME', 'ra.333labs.tech'),
    ],

];
