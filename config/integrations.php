<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Integration Feature Gates
    |--------------------------------------------------------------------------
    |
    | Setiap integrasi aktif otomatis jika SEMUA credential yang diperlukan
    | ada di .env. Tidak perlu manual on/off — credential-driven.
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
        'ready'       => function () {
            return config('jnt.enabled')
                && ! blank(config('jnt.credentials.api_account'))
                && ! blank(config('jnt.credentials.private_key'))
                && ! blank(config('jnt.credentials.customer_code'))
                && ! blank(config('jnt.credentials.customer_password'));
        },
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
        'ready'       => function () {
            return ! blank(config('services.whatsapp.baileys.base_url'))
                && ! blank(config('services.whatsapp.baileys.api_key'));
        },
        'required' => [
            'WHATSAPP_BAILEYS_BASE_URL',
            'WHATSAPP_BAILEYS_API_KEY',
        ],
    ],

];
