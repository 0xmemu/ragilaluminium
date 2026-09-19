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
        $period = (string) request()->query('period', '24h');
        if (! in_array($period, ['6h', '12h', '24h', '3d', '7d'], true)) {
            $period = '24h';
        }

        // Snapshot performa server diambil setiap halaman dibuka supaya grafik
        // punya titik terbaru. Penjadwal 15 menit mengisi sisanya. Throttle
        // 5 menit di dalam storeSnapshot mencegah page-load membanjiri tabel.
        $this->health->storeSnapshot();

        // Temuan audit 2026-09-20 (P2-4): props berat dibungkus Inertia::lazy
        // supaya partial reload (klik periode, only: history/period/server)
        // tidak lagi mengeksekusi checks() 3 detik + API eksternal di server.
        return Inertia::render('Admin/SystemHealth', [
            'title' => 'Pengaturan Sistem',
            'description' => 'Pantau kesehatan layanan, resource server, dan koneksi integrasi.',
            'checks' => Inertia::optional(fn () => $this->health->checks(false)),
            'summary' => Inertia::optional(function (): array {
                $checks = $this->health->checks(false);
                $summary = $this->health->summary($checks);
                $this->health->rememberScan($summary);

                return $summary;
            }),
            'server' => $this->health->serverMetrics(),
            'history' => $this->health->recentSnapshots($period),
            'period' => $period,
            'periodOptions' => [
                ['value' => '6h', 'label' => '6 Jam'],
                ['value' => '12h', 'label' => '12 Jam'],
                ['value' => '24h', 'label' => '24 Jam'],
                ['value' => '3d', 'label' => '3 Hari'],
                ['value' => '7d', 'label' => '7 Hari'],
            ],
            'lastCheckedAt' => $this->health->lastLocalScanAt(),
            'env' => [
                'app_env' => config('app.env'),
                'whatsapp_number_id' => config('services.whatsapp.number_id') ?: null,
                // jnt_environment tidak lagi dikirim (owner 2026-09-20):
                // J&T keluar dari halaman ini, dicek manual lewat backend.
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
