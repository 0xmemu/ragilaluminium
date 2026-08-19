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
    | WhatsApp Business API (Stage 8)
    |--------------------------------------------------------------------------
    */

    'whatsapp' => [
        'allow_unsigned_webhooks' => (bool) env('WHATSAPP_ALLOW_UNSIGNED_WEBHOOKS', false),
        'default_provider' => env('WHATSAPP_PROVIDER', 'meta'),
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
        'language' => env('WHATSAPP_LANGUAGE', 'id'),
        'timeout' => (int) env('WHATSAPP_TIMEOUT', 15),
        'meta' => [
            'base_url' => env('WHATSAPP_API_BASE_URL', 'https://graph.facebook.com/v20.0'),
            'token' => env('WHATSAPP_API_TOKEN'),
            'number_id' => env('WHATSAPP_BUSINESS_NUMBER_ID'),
            'verify_token' => env('WHATSAPP_VERIFY_TOKEN'),
            'app_secret' => env('WHATSAPP_APP_SECRET'),
            'business_phone' => env('WHATSAPP_BUSINESS_PHONE'),
            'language' => env('WHATSAPP_LANGUAGE', 'id'),
            'timeout' => (int) env('WHATSAPP_TIMEOUT', 15),
        ],
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

];
