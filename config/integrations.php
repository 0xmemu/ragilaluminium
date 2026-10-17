<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Integration Feature Gates
    |--------------------------------------------------------------------------
    |
    | Setiap integrasi aktif otomatis jika SEMUA credential yang diperlukan
    | ada di .env. Tidak perlu manual on/off, credential-driven.
    |
    | `ready` = callback yang mengembalikan bool.
    | `label` = nama tampilan untuk admin panel.
    | `description` = penjelasan singkat status.
    | `required` = daftar env key yang harus terisi.
    |
    */

    'jnt' => [
        'label'       => 'J&T Cargo Integration',
        'description' => 'Pengiriman & tracking paket via J&T Cargo Open Platform.',
        // Dibaca langsung dari env, bukan config(), supaya nilainya serializable
        // dan `php artisan config:cache` tetap berjalan. Kontraknya tetap boolean.
        'ready'       => filter_var(env('JNT_ENABLED', false), FILTER_VALIDATE_BOOL)
            && filled(env('JNT_API_ACCOUNT'))
            && filled(env('JNT_PRIVATE_KEY'))
            && filled(env('JNT_CUSTOMER_CODE'))
            && filled(env('JNT_CUSTOMER_PASSWORD')),
        'required' => [
            'JNT_ENABLED',
            'JNT_API_ACCOUNT',
            'JNT_PRIVATE_KEY',
            'JNT_CUSTOMER_CODE',
            'JNT_CUSTOMER_PASSWORD',
        ],
    ],

    'whatsapp' => [
        'label'       => 'WhatsApp Integration',
        'description' => 'Notifikasi order & pesan pelanggan via WhatsApp (Baileys).',
        'ready'       => filled(env('WHATSAPP_BAILEYS_BASE_URL'))
            && filled(env('WHATSAPP_BAILEYS_API_KEY')),
        'required' => [
            'WHATSAPP_BAILEYS_BASE_URL',
            'WHATSAPP_BAILEYS_API_KEY',
        ],
    ],

];
