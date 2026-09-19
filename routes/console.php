<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

if ((bool) config('operations.queue_monitor.enabled', true)) {
    $connection = (string) config('operations.queue_monitor.connection', 'database');
    $targets = array_map(
        fn (string $queue): string => $connection.':'.$queue,
        config('operations.queue_monitor.queues', ['default', 'imports', 'media']),
    );

    if ($targets !== []) {
        Schedule::command('queue:monitor', [
            implode(',', $targets),
            '--max' => (int) config('operations.queue_monitor.max_jobs', 100),
        ])->everyMinute()->withoutOverlapping();
    }
}

Schedule::command('queue:prune-failed', [
    '--hours' => (int) config('operations.failed_job_retention_hours', 168),
])->dailyAt('02:15')->withoutOverlapping();

// Bersihkan upload presigned yang tidak pernah difinalisasi (pending/ > 24 jam)
// lalu kirim notifikasi admin dengan rincian pembersihan.
Schedule::command('media:prune-pending', [
    '--hours' => (int) config('media.pending_prune_hours', 24),
])->dailyAt('03:00')->withoutOverlapping();

// Pangkas log riwayat pemrosesan media yang lebih tua dari masa retensi.
Schedule::command('media:prune-logs', [
    '--days' => (int) config('media.log_retention_days', 30),
])->dailyAt('03:30')->withoutOverlapping();

// Rilis reservation stok kedaluwarsa (P2-3.2; aman walau feature disabled).
Schedule::call(function () {
    app(\App\Services\StockReservationService::class)->releaseExpired();
})->name('stock-reservations:release-expired')->everyFiveMinutes()->withoutOverlapping();

// Evaluasi ambang notifikasi Teruskan Popularitas. Dipindah dari GET halaman
// admin agar operasi baca bebas efek samping; notifikasi tetap sekali per boost.
Schedule::command('popularity:evaluate-thresholds')
    ->dailyAt('04:00')->withoutOverlapping();

// Sinkronkan nomor WhatsApp toko dari gateway Baileys (owner 2026-09-17).
// Nomor baru tersambung -> seluruh tampilan nomor di website ikut berganti.
// Perangkat terputus TIDAK menghapus nomor: website tetap memakai nomor terakhir.
Schedule::call(fn () => \App\Support\WhatsAppSessionPhone::sync())
    ->name('whatsapp-session-phone:sync')
    ->everyFiveMinutes()
    ->withoutOverlapping();

// Audit keamanan dependency bulanan (composer). Hasil JSON tersimpan di storage.
Schedule::exec(
    'cd '.base_path().' && composer audit --format=json > storage/logs/composer-audit-$(date +%Y%m).json 2>&1',
)->monthlyOn(1, '03:45')->withoutOverlapping();

// Snapshot kesehatan sistem tiap 15 menit untuk grafik performa server.
// Halaman Pengaturan Sistem juga mengambil snapshot setiap kali dibuka,
// jadi grafik tetap terisi walau cron sempat mati.
Schedule::call(fn () => app(\App\Services\SystemHealthService::class)->storeSnapshot())
    ->name('system-health-snapshot')
    ->everyFifteenMinutes()
    ->withoutOverlapping();

// Pangkas snapshot lama (di atas 30 hari) supaya tabel tidak membengkak.
Schedule::call(function (): void {
    \App\Models\SystemHealthSnapshot::query()
        ->where('taken_at', '<', now()->subDays(30))
        ->delete();
})->name('system-health-prune')
    ->dailyAt('03:15')
    ->withoutOverlapping();
