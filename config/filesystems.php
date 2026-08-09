<?php

$r2Key = env('AWS_ACCESS_KEY_ID') ?: env('CLOUDFLARE_R2_ACCESS_KEY_ID');
$r2Secret = env('AWS_SECRET_ACCESS_KEY') ?: env('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
$r2Bucket = env('AWS_BUCKET') ?: env('CLOUDFLARE_R2_BUCKET');
$r2Url = env('AWS_URL') ?: env('CLOUDFLARE_R2_PUBLIC_URL');
$r2Endpoint = env('AWS_ENDPOINT') ?: env('CLOUDFLARE_R2_ENDPOINT');

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        'imports' => [
            'driver' => 'local',
            'root' => storage_path('app/imports'),
            'throw' => false,
        ],

        /*
         | Product media: local (dev) or S3-compatible (R2/S3) in production.
         | Set MEDIA_DISK=s3 and AWS_* / AWS_ENDPOINT / AWS_URL for Cloudflare R2.
         */
        'media' => env('MEDIA_DISK', 'local') === 's3'
            ? [
                'driver' => 's3',
                'key' => $r2Key,
                'secret' => $r2Secret,
                'region' => env('AWS_DEFAULT_REGION', 'auto'),
                'bucket' => $r2Bucket,
                'url' => env('MEDIA_PUBLIC_URL') ?: $r2Url,
                'proxy_url' => env('MEDIA_PROXY_URL'),
                'endpoint' => $r2Endpoint,
                'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', true),
                'visibility' => 'public',
                'throw' => false,
                'report' => false,
            ]
            : [
                'driver' => 'local',
                'root' => storage_path('app/public/media'),
                'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage/media',
                'visibility' => 'public',
                'throw' => false,
                'report' => false,
            ],

        's3' => [
            'driver' => 's3',
            'key' => $r2Key,
            'secret' => $r2Secret,
            'region' => env('AWS_DEFAULT_REGION', 'auto'),
            'bucket' => $r2Bucket,
            'url' => env('MEDIA_PUBLIC_URL') ?: $r2Url,
            'proxy_url' => env('MEDIA_PROXY_URL'),
            'endpoint' => $r2Endpoint,
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', true),
            'throw' => false,
            'report' => false,
        ],

    ],

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
