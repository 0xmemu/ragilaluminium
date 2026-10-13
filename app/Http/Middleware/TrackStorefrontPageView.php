<?php

namespace App\Http\Middleware;

use App\Services\StorePerformanceService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TrackStorefrontPageView
{
    /**
     * Pola User-Agent yang bukan browser manusia: bot, crawler, skrip, dan
     * alat monitor. Permintaan dari agen ini tidak dihitung sebagai kunjungan.
     */
    private const NON_BROWSER_AGENTS = [
        'bot', 'crawl', 'spider', 'slurp', 'curl', 'wget', 'python', 'urllib',
        'httpie', 'http_request', 'java/', 'go-http', 'okhttp', 'axios',
        'node-fetch', 'guzzle', 'headless', 'phantomjs', 'puppeteer',
        'playwright', 'lighthouse', 'facebookexternalhit', 'preview',
        'monitor', 'uptime', 'scanner', 'nmap', 'masscan', 'zgrab',
        'semrush', 'ahrefs', 'mj12', 'dotbot', 'petalbot', 'yandex',
        'bingpreview', 'palo alto', 'cortex',
    ];

    public function __construct(protected StorePerformanceService $performance)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->isMethod('GET')) {
            return $response;
        }

        if ($request->is('admin*', 'login', 'logout', 'webhook*', 'api*', 'up', 'build*', 'images*', 'storage*')) {
            return $response;
        }

        if ($request->header('X-Inertia') || $request->ajax()) {
            // A SPA navigation is not a new document view. Skipping it avoids a
            // synchronous metrics write on every menu click and partial reload.
            return $response;
        }

        if (! $this->isHumanBrowserVisit($request)) {
            // Kunjungan bot, crawler, dan skrip tidak dihitung. Sebelumnya setiap
            // permintaan tanpa cookie dihitung sebagai pengunjung baru sehingga
            // angka pengunjung membengkak: temuan 2026-09-18 menunjukkan sekitar
            // 96% permintaan halaman depan berasal dari curl dan Python-urllib.
            return $response;
        }

        try {
            $this->performance->trackPageView((string) $request->session()->getId());
        } catch (\Throwable) {
            // Never break storefront if metrics write fails.
        }

        return $response;
    }

    /**
     * Kunjungan dihitung hanya bila permintaannya menyerupai navigasi browser
     * manusia: User-Agent bukan bot/skrip, meminta HTML, dan membawa bukti
     * perilaku browser berupa cookie sesi atau header navigasi Sec-Fetch.
     *
     * Skrip tanpa cookie seperti curl dan Python-urllib gagal pada syarat itu,
     * sedangkan browser asli tetap lolos walau baru pertama berkunjung karena
     * browser mengirim header Sec-Fetch pada navigasi dokumen.
     */
    private function isHumanBrowserVisit(Request $request): bool
    {
        $agent = strtolower(trim((string) $request->userAgent()));
        if ($agent === '') {
            return false;
        }

        foreach (self::NON_BROWSER_AGENTS as $needle) {
            if (str_contains($agent, $needle)) {
                return false;
            }
        }

        if (! str_contains(strtolower((string) $request->header('Accept')), 'text/html')) {
            return false;
        }

        $sessionCookie = (string) config('session.cookie');
        if ($sessionCookie !== '' && $request->cookies->has($sessionCookie)) {
            return true;
        }

        return $request->header('Sec-Fetch-Mode') !== null
            || $request->header('Sec-Fetch-Dest') !== null;
    }
}
