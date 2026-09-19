<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SystemHealthService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function __construct(protected SystemHealthService $health) {}

    public function index(): Response
    {
        $checks = $this->health->checks();

        // Snapshot performa server diambil setiap halaman dibuka supaya grafik
        // punya titik terbaru. Penjadwal 15 menit mengisi sisanya.
        $this->health->storeSnapshot();

        return Inertia::render('Admin/SystemHealth', [
            'title' => 'Pengaturan Sistem',
            'description' => 'Kesehatan layanan dan performa server: database, cache, storage, gateway WhatsApp, kredensial J&T, beban CPU, memori, dan disk.',
            'checks' => $checks,
            'summary' => $this->health->summary($checks),
            'server' => $this->health->serverMetrics(),
            'history' => $this->health->recentSnapshots(96),
            'env' => [
                'app_env' => config('app.env'),
                'whatsapp_number_id' => config('services.whatsapp.number_id') ?: null,
                'jnt_environment' => \App\Support\JntReadiness::report()['environment'],
                'queue_connection' => (string) config('queue.default'),
                'cache_store' => (string) config('cache.default'),
                'media_disk' => (string) config('filesystems.disks.media.driver', 'local'),
            ],
            'runUrl' => route('admin.settings.run'),
        ]);
    }

    /**
     * Jalankan ulang seluruh pemeriksaan. Check yang menyentuh layanan luar
     * dibatasi timeout pendek, jadi tombol ini aman dipakai kapan pun.
     */
    public function run(): RedirectResponse
    {
        $checks = $this->health->checks();
        $summary = $this->health->summary($checks);

        $message = $summary['all_ok']
            ? 'Semua '.$summary['total'].' pemeriksaan sehat.'
            : $summary['failed'].' dari '.$summary['total'].' pemeriksaan bermasalah. Lihat rinciannya di bawah.';

        return redirect()
            ->route('admin.settings.index')
            ->with($summary['all_ok'] ? 'success' : 'error', $message);
    }
}
