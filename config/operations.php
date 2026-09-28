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

    // Item 1 antrean: pesanan Sampai otomatis menjadi Selesai setelah masa
    // tenggang. 72 jam sengaja di atas tenggat retur 48 jam agar hak retur
    // selalu menutup lebih dulu. enabled=false mematikan sepenuhnya.
    'orders_auto_complete' => [
        'enabled' => (bool) env('ORDERS_AUTO_COMPLETE_ENABLED', true),
        'grace_hours' => max(1, (int) env('ORDERS_AUTO_COMPLETE_GRACE_HOURS', 72)),
    ],

    // Item 7 antrean: penarik status J&T terjadwal sebagai cadangan webhook.
    // max_per_run menjaga kuota API; active_days membatasi resi yang sudah
    // lama tidak bergerak; subscribe (push J&T) default mati sampai payload
    //nya divalidasi live.
    'shipping_pull' => [
        'enabled' => (bool) env('JNT_PULL_ENABLED', true),
        'max_per_run' => max(1, (int) env('JNT_PULL_MAX_PER_RUN', 50)),
        'active_days' => max(1, (int) env('JNT_PULL_ACTIVE_DAYS', 30)),
        // Jeda minimal per resi supaya resi yang baru diperiksa tidak
        // ditembak lagi di jalanan berikutnya.
        'throttle_minutes' => max(1, (int) env('JNT_PULL_THROTTLE_MINUTES', 30)),
        // Batas percobaan per resi sebelum sistem berhenti mencoba.
        'max_attempts' => max(1, (int) env('JNT_PULL_MAX_ATTEMPTS', 20)),
        // Jumlah kegagalan berturut-turut sebelum admin diberi tahu.
        'failure_alert_threshold' => max(1, (int) env('JNT_PULL_FAILURE_ALERT_THRESHOLD', 5)),
        'subscribe' => (bool) env('JNT_PULL_SUBSCRIBE', false),
    ],
];
