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
        // Pemeriksaan halaman: layanan lokal dan konfigurasi. Uji koneksi ke
        // API eksternal hanya dijalankan dari tombol periksa (lihat run()).
        $checks = $this->health->checks(false);

        // Snapshot performa server diambil setiap halaman dibuka supaya grafik
        // punya titik terbaru. Penjadwal 15 menit mengisi sisanya.
        $this->health->storeSnapshot();

        $summary = $this->health->summary($checks);
        $this->health->rememberScan($summary);

        return Inertia::render('Admin/SystemHealth', [
            'title' => 'Pengaturan Sistem',
            'description' => 'Pantau kesehatan layanan, resource server, dan koneksi integrasi.',
            'checks' => $checks,
            'summary' => $summary,
            'server' => $this->health->serverMetrics(),
            'history' => $this->health->recentSnapshots(96),
            'lastCheckedAt' => $summary['checked_at'],
            'env' => [
                'app_env' => config('app.env'),
                'whatsapp_number_id' => config('services.whatsapp.number_id') ?: null,
                'jnt_environment' => \App\Support\JntReadiness::report()['environment'],
                'queue_connection' => (string) config('queue.default'),
                'cache_store' => (string) config('cache.default'),
                'media_disk' => (string) config('filesystems.disks.media.driver', 'local'),
                'cloudflare_hostname' => (string) config('services.cloudflare.hostname', 'ra.333labs.tech'),
                'cloudflare_zone' => '333labs.tech',
            ],
            'runUrl' => route('admin.settings.run'),
        ]);
    }

    /**
     * Jalankan pemeriksaan lengkap termasuk uji konektivitas nyata ke API
     * eksternal. Semua check memakai timeout pendek, jadi tombol ini aman
     * dipakai kapan pun tanpa mengganggu pengunjung.
     */
    public function run(): RedirectResponse
    {
        $checks = $this->health->checks(deep: true);
        $summary = $this->health->summary($checks);
        $this->health->rememberScan($summary);

        $counts = $summary['counts'];
        $bermasalah = ($counts['warning'] ?? 0)
            + ($counts['failed'] ?? 0)
            + ($counts['offline'] ?? 0)
            + ($counts['not_configured'] ?? 0)
            + ($counts['unknown'] ?? 0);

        $message = $bermasalah === 0
            ? 'Semua '.$summary['total'].' layanan sehat.'
            : $bermasalah.' dari '.$summary['total'].' layanan perlu perhatian. Lihat rinciannya di bawah.';

        return redirect()
            ->route('admin.settings.index')
            ->with($bermasalah === 0 ? 'success' : 'error', $message);
    }
}
