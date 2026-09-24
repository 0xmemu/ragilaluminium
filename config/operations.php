<?php

return [
    'alert_log_channel' => env('OPS_ALERT_LOG_CHANNEL', env('LOG_CHANNEL', 'stack')),
    'export_max_rows' => max(1, (int) env('EXPORT_MAX_ROWS', 50000)),

    'queue_monitor' => [
        'enabled' => (bool) env('QUEUE_MONITOR_ENABLED', true),
        'connection' => env('QUEUE_MONITOR_CONNECTION', env('QUEUE_CONNECTION', 'database')),
        'queues' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('QUEUE_MONITOR_QUEUES', 'default,imports,media')),
        ))),
        'max_jobs' => max(1, (int) env('QUEUE_MONITOR_MAX_JOBS', 100)),
    ],

    'failed_job_retention_hours' => max(24, (int) env('QUEUE_FAILED_RETENTION_HOURS', 168)),

    // Umur maksimum notifikasi admin yang sudah dibaca sebelum boleh dipangkas
    // lewat tombol "Bersihkan lama" di /admin/notifications. Default 90 hari
    // supaya konservatif; notifikasi belum dibaca tidak pernah dipangkas.
    'notification_retention_days' => max(1, (int) env('NOTIFICATION_RETENTION_DAYS', 90)),

    // Sesi admin yang login TANPA mencentang "Tetap Login"
    // otomatis logout setelah idle selama ini (menit). Default 120 menit (2 jam).
    // 0 = matikan batas idle.
    // Yang mencentang remember tidak terkena aturan ini.
    'admin_session_idle_minutes' => max(0, (int) env('ADMIN_SESSION_IDLE_MINUTES', 120)),
];
