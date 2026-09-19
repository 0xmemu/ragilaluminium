<?php

namespace App\Services;

use App\Models\SystemHealthSnapshot;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Kesehatan sistem untuk halaman Pengaturan Sistem (System Health Console).
 *
 * Setiap check menyentuh komponennya secara nyata (query ping, read/write
 * cache dan storage, HTTP ke gateway) sehingga hasilnya mencerminkan kondisi
 * saat diperiksa, bukan sekadar membaca config. Semua check aman-gagal: satu
 * layanan mati tidak menjatuhkan halaman.
 *
 * Status memakai kosakata kontrak integrasi: healthy, warning, failed,
 * offline, not_configured, checking, unknown. Status TIDAK PERNAH diturunkan
 * dari Boolean(config) - harus dari pemeriksaan nyata.
 *
 * @phpstan-type HealthAction array{label: string, href?: string}
 * @phpstan-type HealthCheck array{
 *   key: string,
 *   name: string,
 *   group: string,
 *   provider: string|null,
 *   status: string,
 *   summary: string,
 *   checked_at: string,
 *   latency_ms: float|null,
 *   action: HealthAction|null,
 *   details: list<string>
 * }
 */
final class SystemHealthService
{
    /** Timeout HTTP singkat: halaman admin tidak boleh menggantung lama. */
    private const HTTP_TIMEOUT = 4;

    /** State cache untuk menyimpan hasil pemeriksaan terakhir antar request. */
    private const CACHE_KEY = 'system-health:last-scan';

    /** Hasil uji konektivitas API eksternal terakhir (hanya dari tombol periksa). */
    private const DEEP_CACHE_KEY = 'system-health:last-deep-scan';

    /** Umur maksimum hasil uji konektivitas sebelum dianggap kedaluwarsa. */
    private const DEEP_TTL_MINUTES = 30;

    public const STATUS_HEALTHY = 'healthy';

    public const STATUS_WARNING = 'warning';

    public const STATUS_FAILED = 'failed';

    public const STATUS_OFFLINE = 'offline';

    public const STATUS_NOT_CONFIGURED = 'not_configured';

    public const STATUS_UNKNOWN = 'unknown';

    /**
     * Jalankan seluruh pemeriksaan.
     *
     * @param  bool  $deep  true = uji konektivitas nyata ke API eksternal
     *                      (hanya saat admin menekan tombol periksa).
     *                      false = periksa konfigurasi dan layanan lokal saja.
     * @return list<HealthCheck>
     */
    public function checks(bool $deep = false): array
    {
        return [
            // Kelompok 1: layanan infrastruktur (milik sendiri).
            $this->database(),
            $this->cacheStore(),
            $this->queueWorker(),
            $this->applicationStorage(),

            // Kelompok 2: integrasi eksternal.
            // J&T sengaja tidak diikutkan (owner 2026-09-20): integrasinya
            // berisiko disentuh, dicek manual lewat backend, bukan lewat
            // halaman ini. Tidak ada tombol di UI yang memicu API J&T.
            $this->cloudflare($deep),
            $this->mediaStorage(),
            $this->whatsappGateway(),
        ];
    }

    /**
     * Ringkasan status global. Hitungan per status supaya UI bisa menampilkan
     * "6 sehat, 1 perlu perhatian" seperti kontrak, bukan kalimat umum.
     *
     * @param  list<HealthCheck>  $checks
     * @return array{total: int, counts: array<string, int>, overall: string, headline: string, failed_names: list<string>, checked_at: string|null}
     */
    public function summary(array $checks): array
    {
        $counts = [
            self::STATUS_HEALTHY => 0,
            self::STATUS_WARNING => 0,
            self::STATUS_FAILED => 0,
            self::STATUS_OFFLINE => 0,
            self::STATUS_NOT_CONFIGURED => 0,
            self::STATUS_UNKNOWN => 0,
        ];

        $attention = [];

        foreach ($checks as $check) {
            $counts[$check['status']] = ($counts[$check['status']] ?? 0) + 1;
            if ($check['status'] !== self::STATUS_HEALTHY) {
                $attention[] = $check;
            }
        }

        // Prioritas keparahan: gagal/offline mengalahkan perhatian.
        $overall = match (true) {
            $counts[self::STATUS_FAILED] > 0 || $counts[self::STATUS_OFFLINE] > 0 => self::STATUS_FAILED,
            $counts[self::STATUS_WARNING] > 0 => self::STATUS_WARNING,
            $counts[self::STATUS_NOT_CONFIGURED] > 0 => self::STATUS_WARNING,
            $counts[self::STATUS_UNKNOWN] > 0 => self::STATUS_WARNING,
            default => self::STATUS_HEALTHY,
        };

        return [
            'total' => count($checks),
            'counts' => $counts,
            'overall' => $overall,
            'headline' => $this->headline($overall),
            'failed_names' => array_map(fn (array $c) => $c['name'], $attention),
            'checked_at' => $checks === [] ? null : $checks[0]['checked_at'],
        ];
    }

    /** Nama kondisi global dalam bahasa manusia. */
    public function headline(string $overall): string
    {
        return match ($overall) {
            self::STATUS_HEALTHY => 'Sistem sehat',
            self::STATUS_WARNING => 'Perlu perhatian',
            self::STATUS_FAILED => 'Gangguan sistem',
            self::STATUS_NOT_CONFIGURED => 'Sebagian belum dikonfigurasi',
            default => 'Belum diperiksa',
        };
    }

    /** Simpan hasil pemeriksaan supaya timestamp bertahan antar request. */
    public function rememberScan(array $summary): void
    {
        Cache::put(self::CACHE_KEY, [
            'checked_at' => now()->timezone(config('app.timezone'))->toIso8601String(),
            'summary' => $summary,
        ], now()->addHours(6));
    }

    /** Hasil pemeriksaan terakhir yang tersimpan (null bila belum pernah). */
    public function lastScan(): ?array
    {
        return Cache::get(self::CACHE_KEY);
    }

    // =====================================================================
    // METRIK RESOURCE SERVER
    // =====================================================================

    /**
     * Metrik performa server. Dibaca dari file sistem dan query internal,
     * tanpa dependensi eksternal.
     *
     * @return array<string, mixed>
     */
    public function serverMetrics(): array
    {
        $load = sys_getloadavg() ?: [null, null, null];
        $mem = $this->readMemInfo();
        $disk = $this->readDisk();

        $dbStart = microtime(true);
        $dbMs = null;
        try {
            DB::selectOne('select 1 as ping');
            $dbMs = round((microtime(true) - $dbStart) * 1000, 2);
        } catch (\Throwable) {
            $dbMs = null;
        }

        $backlog = null;
        try {
            $backlog = (int) Queue::size('default')
                + (int) Queue::size('imports')
                + (int) Queue::size('media');
        } catch (\Throwable) {
            $backlog = null;
        }

        $r2 = $this->readR2Usage();

        return [
            'taken_at' => now()->timezone(config('app.timezone'))->toIso8601String(),
            'load_1' => $load[0] !== null ? round((float) $load[0], 2) : null,
            'load_5' => $load[1] !== null ? round((float) $load[1], 2) : null,
            'load_15' => $load[2] !== null ? round((float) $load[2], 2) : null,
            'vcpu' => $this->vcpuCount(),
            'cpu_pct' => $this->cpuUtilization(),
            'memory_used_mb' => $mem['used'],
            'memory_total_mb' => $mem['total'],
            'memory_pct' => $mem['pct'],
            'disk_used_gb' => $disk['used'],
            'disk_total_gb' => $disk['total'],
            'disk_pct' => $disk['pct'],
            'disk_mount' => $disk['mount'],
            'db_response_ms' => $dbMs,
            'queue_backlog' => $backlog,
            'php_memory_mb' => round(memory_get_usage(true) / 1048576, 2),
            'php_peak_mb' => round(memory_get_peak_usage(true) / 1048576, 2),
            'r2_used_gb' => $r2['used_gb'] ?? null,
            'r2_limit_gb' => $r2['limit_gb'] ?? null,
            'r2_pct' => $r2['pct'] ?? null,
            'r2_object_count' => $r2['object_count'] ?? null,
            'r2_bucket' => (string) config('filesystems.disks.media.bucket', 'ra-media'),
        ];
    }

    /**
     * Ambang status resource. Ditentukan di logic aplikasi, bukan hanya warna
     * di UI (kontrak: threshold harus punya dasar, bukan kosmetik).
     */
    public function memoryStatus(?float $pct): string
    {
        if ($pct === null) {
            return self::STATUS_UNKNOWN;
        }

        return match (true) {
            $pct > 90 => self::STATUS_FAILED,
            $pct >= 75 => self::STATUS_WARNING,
            default => self::STATUS_HEALTHY,
        };
    }

    public function diskStatus(?float $pct): string
    {
        if ($pct === null) {
            return self::STATUS_UNKNOWN;
        }

        return match (true) {
            $pct > 90 => self::STATUS_FAILED,
            $pct >= 75 => self::STATUS_WARNING,
            default => self::STATUS_HEALTHY,
        };
    }

    /**
     * Status load average dinilai terhadap jumlah vCPU, bukan angka mentah.
     * Load 4 pada mesin 1 core adalah kritis; pada 8 core adalah sepertiga.
     */
    public function loadStatus(?float $load, ?int $vcpu): string
    {
        if ($load === null || $vcpu === null || $vcpu <= 0) {
            return self::STATUS_UNKNOWN;
        }

        $ratio = $load / $vcpu;

        return match (true) {
            $ratio >= 1.5 => self::STATUS_FAILED,
            $ratio >= 0.9 => self::STATUS_WARNING,
            default => self::STATUS_HEALTHY,
        };
    }

    public function dbStatus(?float $ms): string
    {
        if ($ms === null) {
            return self::STATUS_UNKNOWN;
        }

        return match (true) {
            $ms >= 1000 => self::STATUS_FAILED,
            $ms >= 200 => self::STATUS_WARNING,
            default => self::STATUS_HEALTHY,
        };
    }

    // =====================================================================
    // SNAPSHOT UNTUK GRAFIK
    // =====================================================================

    public function storeSnapshot(bool $force = false): ?SystemHealthSnapshot
    {
        // Temuan audit 2026-09-20 (P1-1): snapshot yang diambil di setiap GET
        // halaman membuat kepadatan titik grafik mengikuti kunjungan admin,
        // bukan interval 15 menit (bukti: 25 snapshot dalam satu jam).
        // Page-load hanya menyimpan bila snapshot terakhir sudah berumur
        // lebih dari 5 menit; cron tetap menyimpan tiap 15 menit.
        if (! $force) {
            $latest = SystemHealthSnapshot::query()->latest('taken_at')->first();

            if ($latest !== null && $latest->taken_at->gt(now()->subMinutes(5))) {
                return null;
            }
        }

        $m = $this->serverMetrics();

        return SystemHealthSnapshot::create([
            'taken_at' => now(),
            'load_1' => $m['load_1'],
            'load_5' => $m['load_5'],
            'load_15' => $m['load_15'],
            'cpu_pct' => $m['cpu_pct'],
            'vcpu' => $m['vcpu'],
            'memory_used_mb' => $m['memory_used_mb'],
            'memory_total_mb' => $m['memory_total_mb'],
            'memory_pct' => $m['memory_pct'],
            'disk_used_gb' => $m['disk_used_gb'],
            'disk_total_gb' => $m['disk_total_gb'],
            'disk_pct' => $m['disk_pct'],
            'disk_mount' => $m['disk_mount'],
            'db_response_ms' => $m['db_response_ms'],
            'queue_backlog' => $m['queue_backlog'],
            'php_memory_mb' => $m['php_memory_mb'],
            'php_peak_mb' => $m['php_peak_mb'],
        ]);
    }

    /**
     * Riwayat snapshot untuk grafik. Nilai null dibiarkan null supaya grafik
     * tidak menggambar garis dari angka 0 palsu. Mendukung filter periode
     * operasional server: 6h, 12h, 24h, 3d, 7d.
     *
     * @param int|string $period
     * @return list<array<string, mixed>>
     */
    public function recentSnapshots(int|string $period = '24h'): array
    {
        $since = null;
        if (is_numeric($period)) {
            $limit = (int) $period;
        } else {
            $hours = match ($period) {
                '6h' => 6,
                '12h' => 12,
                '3d' => 72,
                '7d' => 168,
                default => 24,
            };
            $since = now()->subHours($hours);
            $limit = match ($period) {
                '6h' => 30,
                '12h' => 60,
                '3d' => 320,
                '7d' => 720,
                default => 110,
            };
        }

        $query = SystemHealthSnapshot::query()->orderByDesc('taken_at');
        if ($since !== null) {
            $query->where('taken_at', '>=', $since);
        }

        $isMultiDay = $since !== null && $since->diffInHours(now()) > 24;

        return $query
            ->limit($limit)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (SystemHealthSnapshot $s) => [
                'taken_at' => $s->taken_at->timezone(config('app.timezone'))->format($isMultiDay ? 'd/m H:i' : 'H:i'),
                'taken_iso' => $s->taken_at->timezone(config('app.timezone'))->toIso8601String(),
                'load_1' => $s->load_1 !== null ? (float) $s->load_1 : null,
                'cpu_pct' => $s->cpu_pct !== null ? (float) $s->cpu_pct : null,
                'memory_pct' => $s->memory_pct !== null ? (float) $s->memory_pct : null,
                'disk_pct' => $s->disk_pct !== null ? (float) $s->disk_pct : null,
                'db_response_ms' => $s->db_response_ms !== null ? (float) $s->db_response_ms : null,
                'queue_backlog' => $s->queue_backlog !== null ? (int) $s->queue_backlog : null,
            ])
            ->all();
    }

    // =====================================================================
    // PEMERIKSAAN
    // =====================================================================

    /** @return HealthCheck */
    private function database(): array
    {
        $start = microtime(true);

        try {
            $ok = DB::selectOne('select 1 as ping') !== null;
            $ms = round((microtime(true) - $start) * 1000, 2);

            return $this->check(
                key: 'database',
                name: 'Database',
                group: 'infrastructure',
                provider: 'MySQL',
                status: $ok ? ($this->dbStatus($ms) === self::STATUS_HEALTHY ? self::STATUS_HEALTHY : $this->dbStatus($ms)) : self::STATUS_FAILED,
                summary: $ok ? 'Ping '.$this->ms($ms) : 'Query ping gagal dijalankan.',
                latencyMs: $ms,
            );
        } catch (\Throwable $e) {
            return $this->check(
                key: 'database',
                name: 'Database',
                group: 'infrastructure',
                provider: 'MySQL',
                status: self::STATUS_OFFLINE,
                summary: 'Tidak dapat dihubungi: '.$this->brief($e),
                action: ['label' => 'Lihat log server'],
            );
        }
    }

    /** @return HealthCheck */
    private function cacheStore(): array
    {
        $driver = (string) config('cache.default');
        $provider = Str::headline($driver);

        try {
            $token = 'health-'.bin2hex(random_bytes(6));
            $start = microtime(true);
            Cache::put($token, '1', 30);
            $ok = Cache::get($token) === '1';
            Cache::forget($token);
            $ms = round((microtime(true) - $start) * 1000, 2);

            return $this->check(
                key: 'cache',
                name: 'Redis cache',
                group: 'infrastructure',
                provider: $provider.' · read/write',
                status: $ok ? self::STATUS_HEALTHY : self::STATUS_FAILED,
                summary: $ok ? 'Read/write cache berhasil' : 'Nilai cache tidak terbaca kembali',
                latencyMs: $ms,
            );
        } catch (\Throwable $e) {
            return $this->check(
                key: 'cache',
                name: 'Redis cache',
                group: 'infrastructure',
                provider: $provider,
                status: self::STATUS_OFFLINE,
                summary: 'Tidak dapat dihubungi: '.$this->brief($e),
                action: ['label' => 'Lihat detail'],
            );
        }
    }

    /**
     * Queue worker DIPISAH dari Redis. Redis adalah backend antrean; worker
     * adalah proses yang menjalankan pekerjaan. Redis hidup tanpa worker
     * berarti pekerjaan menumpuk tanpa yang mengerjakan.
     *
     * @return HealthCheck
     */
    private function queueWorker(): array
    {
        $driver = (string) config('queue.default');
        $provider = Str::headline($driver).' queue';
        $worker = $this->findQueueWorker();

        if ($worker === null) {
            return $this->check(
                key: 'queue-worker',
                name: 'Queue worker',
                group: 'infrastructure',
                provider: $provider,
                status: self::STATUS_WARNING,
                summary: 'Proses worker tidak ditemukan. Pekerjaan menumpuk tanpa dikerjakan.',
                details: ['Jalankan systemctl start ragil-queue di server.'],
                action: ['label' => 'Lihat detail'],
            );
        }

        $ago = $worker['started_ago_seconds'];

        return $this->check(
            key: 'queue-worker',
            name: 'Queue worker',
            group: 'infrastructure',
            provider: $provider,
            status: self::STATUS_HEALTHY,
            summary: 'Worker aktif selama '.$this->humanDuration($ago).' (PID '.$worker['pid'].')',
            details: ['Perintah: '.$worker['command']],
        );
    }

    /** @return HealthCheck */
    private function applicationStorage(): array
    {
        $path = storage_path();

        try {
            $file = $path.'/health-'.bin2hex(random_bytes(6)).'.txt';
            $written = @file_put_contents($file, 'health-check') !== false;
            $read = $written ? trim((string) @file_get_contents($file)) === 'health-check' : false;
            if ($written) {
                @unlink($file);
            }

            $ok = $written && $read;

            return $this->check(
                key: 'storage-app',
                name: 'Storage aplikasi',
                group: 'infrastructure',
                provider: 'Filesystem',
                status: $ok ? self::STATUS_HEALTHY : self::STATUS_FAILED,
                summary: $ok
                    ? 'Read/write berhasil di storage/'
                    : 'storage/ tidak dapat ditulis. Situs berisiko error 500.',
                details: $ok ? [] : ['Jalankan scripts/prod/fix-storage-perms.sh di server.'],
                action: $ok ? null : ['label' => 'Lihat detail'],
            );
        } catch (\Throwable $e) {
            return $this->check(
                key: 'storage-app',
                name: 'Storage aplikasi',
                group: 'infrastructure',
                provider: 'Filesystem',
                status: self::STATUS_FAILED,
                summary: 'Gagal: '.$this->brief($e),
            );
        }
    }

    /** @return HealthCheck */
    private function mediaStorage(): array
    {
        $driver = (string) config('filesystems.disks.media.driver', 'local');
        $provider = match ($driver) {
            's3' => 'S3',
            'local' => 'Filesystem lokal',
            default => Str::headline($driver),
        };

        try {
            $disk = Storage::disk('media');
            $path = 'health/'.bin2hex(random_bytes(6)).'.txt';
            $start = microtime(true);
            $disk->put($path, 'health-check');
            $ok = trim((string) $disk->get($path)) === 'health-check';
            $disk->delete($path);
            $ms = round((microtime(true) - $start) * 1000, 2);

            $r2 = $this->readR2Usage();
            $details = [];

            if ($r2 !== null) {
                $usedGbFormatted = number_format($r2['used_gb'], 2, ',', '.');
                $limitGbFormatted = number_format($r2['limit_gb'], 0, ',', '.');
                $pctFormatted = number_format($r2['pct'], 1, ',', '.');
                $objectCountFormatted = number_format($r2['object_count'], 0, ',', '.');

                $provider = 'Cloudflare R2 · '.config('filesystems.disks.media.bucket', 'ra-media');
                $summary = $ok
                    ? $usedGbFormatted.' GB dari '.$limitGbFormatted.' GB terpakai ('.$pctFormatted.'%) · '.$objectCountFormatted.' objek'
                    : 'Objek tidak terbaca kembali';

                $details = [
                    'Kapasitas: '.$usedGbFormatted.' GB dari '.$limitGbFormatted.' GB kuota tier ('.$pctFormatted.'% terpakai)',
                    'Jumlah objek: '.$objectCountFormatted.' file media tersimpan',
                    'Operasi I/O: Upload, baca, dan hapus objek berhasil ('.$this->ms($ms).')',
                    'URL publik: '.config('filesystems.disks.media.url', 'https://media.333labs.tech'),
                ];
            } else {
                $summary = $ok ? 'Upload, baca, dan hapus objek berhasil' : 'Objek tidak terbaca kembali';
            }

            return $this->check(
                key: 'media-storage',
                name: 'Media storage',
                group: 'integration',
                provider: $provider,
                status: $ok ? self::STATUS_HEALTHY : self::STATUS_FAILED,
                summary: $summary,
                details: $details,
                latencyMs: $ms,
            );
        } catch (\Throwable $e) {
            return $this->check(
                key: 'media-storage',
                name: 'Media storage',
                group: 'integration',
                provider: $provider,
                status: self::STATUS_OFFLINE,
                summary: 'Tidak dapat dihubungi: '.$this->brief($e),
                action: ['label' => 'Lihat detail'],
            );
        }
    }

    /**
     * Baca penggunaan penyimpanan Cloudflare R2 via API.
     *
     * @return array{bytes: float, used_gb: float, limit_gb: float, pct: float, object_count: int}|null
     */
    private function readR2Usage(): ?array
    {
        $apiToken = (string) config('services.cloudflare.api_token', '');
        $accountId = (string) config('services.cloudflare.account_id', '474a54069f4a16c84c33c26d012bfe6a');
        $bucket = (string) config('filesystems.disks.media.bucket', 'ra-media');

        if ($apiToken === '' || $accountId === '' || $bucket === '') {
            return null;
        }

        return Cache::remember('cf_r2_usage_'.$bucket, 180, function () use ($apiToken, $accountId, $bucket) {
            try {
                $resp = Http::withToken($apiToken)
                    ->timeout(4)
                    ->get("https://api.cloudflare.com/client/v4/accounts/{$accountId}/r2/buckets/{$bucket}/usage");

                if (! $resp->successful()) {
                    return null;
                }

                $json = $resp->json();
                if (! ($json['success'] ?? false) || ! isset($json['result'])) {
                    return null;
                }

                $res = $json['result'];
                $bytes = (float) ($res['payloadSize'] ?? 0);
                $usedGb = round($bytes / (1024 * 1024 * 1024), 2);
                $limitGb = (float) config('services.cloudflare.r2_quota_gb', 10.0);
                $pct = $limitGb > 0 ? round(($usedGb / $limitGb) * 100, 1) : 0.0;
                $objectCount = (int) ($res['objectCount'] ?? 0);

                return [
                    'bytes' => $bytes,
                    'used_gb' => $usedGb,
                    'limit_gb' => $limitGb,
                    'pct' => $pct,
                    'object_count' => $objectCount,
                ];
            } catch (\Throwable) {
                return null;
            }
        });
    }

    /** @return HealthCheck */
    private function whatsappGateway(): array
    {
        $baseUrl = rtrim((string) config('services.whatsapp.baileys.base_url'), '');
        $apiKey = (string) config('services.whatsapp.baileys.api_key');

        if ($baseUrl === '') {
            return $this->check(
                key: 'whatsapp',
                name: 'Gateway WhatsApp',
                group: 'integration',
                provider: 'WhatsApp',
                status: self::STATUS_NOT_CONFIGURED,
                summary: 'URL gateway belum diisi di environment server',
                action: ['label' => 'Konfigurasi'],
            );
        }

        try {
            $start = microtime(true);
            $response = Http::timeout(self::HTTP_TIMEOUT)
                ->withHeaders($apiKey !== '' ? ['X-Api-Key' => $apiKey] : [])
                ->get($baseUrl.'/status');
            $ms = round((microtime(true) - $start) * 1000, 2);

            $payload = $response->json() ?? [];
            $status = (string) ($payload['status'] ?? '');
            $rawPhone = (string) ($payload['connected_phone'] ?? ($payload['phone'] ?? ''));
            $phone = $rawPhone !== '' ? (string) preg_replace('/[:@].*/', '', $rawPhone) : '';

            if (! $response->successful()) {
                return $this->check(
                    key: 'whatsapp',
                    name: 'Gateway WhatsApp',
                    group: 'integration',
                    provider: 'WhatsApp',
                    status: self::STATUS_FAILED,
                    summary: 'Gateway membalas HTTP '.$response->status(),
                    latencyMs: $ms,
                    action: ['label' => 'Coba lagi'],
                );
            }

            if ($status === 'open') {
                return $this->check(
                    key: 'whatsapp',
                    name: 'Gateway WhatsApp',
                    group: 'integration',
                    provider: 'WhatsApp',
                    status: self::STATUS_HEALTHY,
                    summary: 'Sesi terhubung'.($phone !== '' ? ' · '.$this->maskPhone($phone) : ''),
                    latencyMs: $ms,
                );
            }

            return $this->check(
                key: 'whatsapp',
                name: 'Gateway WhatsApp',
                group: 'integration',
                provider: 'WhatsApp',
                status: self::STATUS_WARNING,
                summary: 'Gateway hidup, tetapi sesi belum terhubung'.($status !== '' ? ' ('.$status.')' : ''),
                latencyMs: $ms,
                details: ['Pindai ulang QR pada perangkat gateway.'],
                action: ['label' => 'Lihat detail'],
            );
        } catch (\Throwable $e) {
            return $this->check(
                key: 'whatsapp',
                name: 'Gateway WhatsApp',
                group: 'integration',
                provider: 'WhatsApp',
                status: self::STATUS_OFFLINE,
                summary: 'Tidak dapat dihubungi: '.$this->brief($e),
                action: ['label' => 'Coba lagi'],
            );
        }
    }

    /**
     * J&T: bedakan "credential tersedia" dari "API dapat digunakan".
     *
     * Tanpa $deep kita hanya memeriksa kelengkapan env dan menyatakan jujur
     * bahwa koneksi belum diuji. Dengan $deep kita benar-benar memanggil API
     * ringan (ambil bill code) sehingga status Sehat berarti API merespons.
     *
     * @return HealthCheck
     */
    private function jntCargo(bool $deep): array
    {
        // Tidak dipanggil lagi dari checks() (owner 2026-09-20). Method ini
        // dibiarkan sebagai referensi, bukan jalur aktif halaman.
        $report = \App\Support\JntReadiness::report();
        $missing = $report['missing'];
        $environment = (string) $report['environment'];

        if ($missing !== []) {
            return $this->check(
                key: 'jnt',
                name: 'J&T Cargo',
                group: 'integration',
                provider: 'J&T API',
                status: self::STATUS_NOT_CONFIGURED,
                summary: 'Credential belum lengkap: '.implode(', ', $missing),
                action: ['label' => 'Konfigurasi'],
            );
        }

        if (! $deep) {
            // Hasil uji konektivitas terakhir dipakai kembali selama masih
            // segar, supaya status tidak berubah jadi "belum diuji" hanya
            // karena halaman dimuat ulang.
            $cached = Cache::get(self::DEEP_CACHE_KEY);

            if (is_array($cached) && isset($cached['at'], $cached['check'])) {
                $ageMinutes = now()->diffInMinutes(\Illuminate\Support\Carbon::parse($cached['at']));

                if ($ageMinutes <= self::DEEP_TTL_MINUTES) {
                    return $cached['check'];
                }
            }

            return $this->check(
                key: 'jnt',
                name: 'J&T Cargo',
                group: 'integration',
                provider: 'J&T API · '.$environment,
                status: self::STATUS_WARNING,
                summary: 'Credential tersedia · koneksi API belum diuji',
                details: ['Tekan Jalankan pemeriksaan untuk menguji koneksi API.'],
                action: ['label' => 'Uji koneksi'],
            );
        }

        try {
            $client = app(\App\Services\Shipping\JntCargoClient::class);

            if (! $client->isEnabled()) {
                return $this->check(
                    key: 'jnt',
                    name: 'J&T Cargo',
                    group: 'integration',
                    provider: 'J&T API · '.$environment,
                    status: self::STATUS_WARNING,
                    summary: 'Integrasi dimatikan (JNT_ENABLED=false)',
                    action: ['label' => 'Konfigurasi'],
                );
            }

            $start = microtime(true);
            $response = $client->getBatchBillCode(1);
            $ms = round((microtime(true) - $start) * 1000, 2);

            if ($response->ok) {
                return $this->rememberDeep($this->check(
                    key: 'jnt',
                    name: 'J&T Cargo',
                    group: 'integration',
                    provider: 'J&T API · '.$environment,
                    status: self::STATUS_HEALTHY,
                    summary: 'Credential valid dan API merespons',
                    latencyMs: $ms,
                ));
            }

            return $this->rememberDeep($this->check(
                key: 'jnt',
                name: 'J&T Cargo',
                group: 'integration',
                provider: 'J&T API · '.$environment,
                status: self::STATUS_FAILED,
                summary: 'API menolak permintaan: '.Str::limit((string) $response->message(), 100),
                latencyMs: $ms,
                action: ['label' => 'Coba lagi'],
            ));
        } catch (\Throwable $e) {
            return $this->check(
                key: 'jnt',
                name: 'J&T Cargo',
                group: 'integration',
                provider: 'J&T API · '.$environment,
                status: self::STATUS_OFFLINE,
                summary: 'Tidak dapat dihubungi: '.$this->brief($e),
                action: ['label' => 'Coba lagi'],
            );
        }
    }

    // =====================================================================
    // PEMBANTU
    // =====================================================================

    /**
     * @param  list<string>  $details
     * @param  HealthAction|null  $action
     * @return HealthCheck
     */
    private function check(
        string $key,
        string $name,
        string $group,
        ?string $provider,
        string $status,
        string $summary,
        ?float $latencyMs = null,
        ?array $action = null,
        array $details = [],
    ): array {
        return [
            'key' => $key,
            'name' => $name,
            'group' => $group,
            'provider' => $provider,
            'status' => $status,
            'summary' => $summary,
            'checked_at' => now()->timezone(config('app.timezone'))->toIso8601String(),
            'latency_ms' => $latencyMs,
            'action' => $action,
            'details' => $details,
        ];
    }

    /**
     * Jumlah CPU yang terlihat sistem, dipakai sebagai konteks load average.
     * Load tanpa pembanding jumlah core tidak bermakna.
     */
    private function vcpuCount(): ?int
    {
        if (! is_readable('/proc/cpuinfo')) {
            return null;
        }

        $count = substr_count((string) file_get_contents('/proc/cpuinfo'), 'processor');

        return $count > 0 ? $count : null;
    }

    /**
     * Utilisasi CPU dari dua cuplikan /proc/stat. Bukan persentase sejak boot
     * (angka itu tidak berguna), melainkan beban sesaat saat diperiksa.
     */
    private function cpuUtilization(): ?float
    {
        // Temuan audit 2026-09-20 (P1-2): sampel dua cuplikan /proc/stat
        // berjarak 150 ms selalu berada di ujung distribusi (0% atau 100%)
        // sehingga garis CPU di grafik menjadi noise yang mengcontradiksi
        // load average. Sekarang utilitas dihitung dari delta sejak
        // pembacaan terakhir yang di-cache: jendela waktunya mengikuti
        // jarak antar snapshot (5-15 menit), hasilnya rata-rata nyata.
        $current = $this->readCpuStat();
        if ($current === null) {
            return null;
        }

        $previous = Cache::get('system-health:cpu-stat');
        Cache::put('system-health:cpu-stat', $current, now()->addHours(2));

        if (! is_array($previous)) {
            return null;
        }

        $totalDelta = $current['total'] - $previous['total'];
        $idleDelta = $current['idle'] - $previous['idle'];

        if ($totalDelta <= 0 || $idleDelta < 0) {
            return null;
        }

        $busy = max(0, $totalDelta - $idleDelta);

        return round(($busy / $totalDelta) * 100, 1);
    }

    /** @return array{total: int, idle: int}|null */
    private function readCpuStat(): ?array
    {
        if (! is_readable('/proc/stat')) {
            return null;
        }

        $lines = @file('/proc/stat');
        if ($lines === false || ! isset($lines[0])) {
            return null;
        }

        $parts = preg_split('/\s+/', trim((string) $lines[0]));
        if ($parts === false || ($parts[0] ?? '') !== 'cpu') {
            return null;
        }

        $values = array_map('intval', array_slice($parts, 1));
        // user, nice, system, idle, iowait, irq, softirq, steal
        $idle = ($values[3] ?? 0) + ($values[4] ?? 0);

        return ['total' => array_sum($values), 'idle' => $idle];
    }

    /**
     * Cari proses queue worker lewat /proc. Bukti nyata bahwa ada yang
     * mengerjakan antrean, bukan sekadar config queue terisi.
     *
     * @return array{pid: int, command: string, started_ago_seconds: int}|null
     */
    private function findQueueWorker(): ?array
    {
        if (! is_dir('/proc')) {
            return null;
        }

        $uptime = $this->systemUptimeSeconds();
        $ticks = 100; // CLK_TCK standar pada Linux x86_64.

        foreach (glob('/proc/[0-9]*') ?: [] as $dir) {
            $cmdline = @file_get_contents($dir.'/cmdline');
            if ($cmdline === false || $cmdline === '') {
                continue;
            }

            $command = trim(str_replace("\0", ' ', $cmdline));

            // Batasi pada proses PHP yang benar-benar menjalankan artisan
            // queue, supaya perintah pencarian lain tidak ikut cocok.
            if (! preg_match('#\bphp\b.*artisan\s+queue:(work|listen)\b#', $command)) {
                continue;
            }

            $pid = (int) basename($dir);
            $startedAgo = null;

            $stat = @file_get_contents($dir.'/stat');
            if ($stat !== false && $uptime !== null) {
                // Field 22 = starttime (dalam tick sejak boot). Nama proses bisa
                // memuat spasi, jadi hitung dari penutup kurung terakhir.
                $close = strrpos($stat, ')');
                if ($close !== false) {
                    $fields = preg_split('/\s+/', trim(substr($stat, $close + 1)));
                    $startTicks = isset($fields[19]) ? (int) $fields[19] : null;
                    if ($startTicks !== null) {
                        $startedAgo = max(0, (int) ($uptime - ($startTicks / $ticks)));
                    }
                }
            }

            return [
                'pid' => $pid,
                'command' => Str::limit($command, 120),
                'started_ago_seconds' => $startedAgo ?? 0,
            ];
        }

        return null;
    }

    private function systemUptimeSeconds(): ?float
    {
        if (! is_readable('/proc/uptime')) {
            return null;
        }

        $raw = @file_get_contents('/proc/uptime');

        return $raw === false ? null : (float) explode(' ', trim($raw))[0];
    }

    /** @return array{total: float|null, used: float|null, pct: float|null, mount: string|null} */
    private function readMemInfo(): array
    {
        if (! is_readable('/proc/meminfo')) {
            return ['total' => null, 'used' => null, 'pct' => null, 'mount' => null];
        }

        $raw = (string) file_get_contents('/proc/meminfo');
        $total = $available = null;

        if (preg_match('/MemTotal:\s+(\d+)/', $raw, $m)) {
            $total = (int) $m[1];
        }
        if (preg_match('/MemAvailable:\s+(\d+)/', $raw, $m)) {
            $available = (int) $m[1];
        }

        if ($total === null) {
            return ['total' => null, 'used' => null, 'pct' => null, 'mount' => null];
        }

        $avail = $available ?? 0;
        $used = $total - $avail;

        return [
            'total' => round($total / 1024, 2),
            'used' => round($used / 1024, 2),
            'pct' => $total > 0 ? round(($used / $total) * 100, 2) : null,
            'mount' => null,
        ];
    }

    /**
     * Disk tempat storage aplikasi berada.
     *
     * Catatan angka: disk_free_space() mengembalikan ruang yang tersedia untuk
     * pengguna biasa, sehingga blok cadangan root ikut terhitung terpakai.
     * Karena itu persentasenya sedikit lebih tinggi daripada df. Angkanya tetap
     * konsisten dengan dirinya sendiri antar waktu, jadi trennya sahih.
     *
     * @return array{total: float|null, used: float|null, pct: float|null, mount: string|null}
     */
    private function readDisk(): array
    {
        $path = storage_path();
        $total = @disk_total_space($path);
        $free = @disk_free_space($path);

        if ($total === false || $free === false || $total <= 0) {
            return ['total' => null, 'used' => null, 'pct' => null, 'mount' => null];
        }

        $used = $total - $free;

        return [
            'total' => round($total / 1073741824, 2),
            'used' => round($used / 1073741824, 2),
            'pct' => round(($used / $total) * 100, 2),
            'mount' => $this->mountPointFor($path),
        ];
    }

    /** Mount point yang menaungi sebuah path, dibaca dari /proc/mounts. */
    private function mountPointFor(string $path): ?string
    {
        if (! is_readable('/proc/mounts')) {
            return null;
        }

        $real = realpath($path) ?: $path;
        $best = null;
        $bestLength = -1;

        foreach (explode("\n", (string) file_get_contents('/proc/mounts')) as $line) {
            $parts = preg_split('/\s+/', trim($line));
            if ($parts === false || count($parts) < 2 || ! str_starts_with($parts[1], '/')) {
                continue;
            }

            $mount = $parts[1];
            if (str_starts_with($real, $mount) && strlen($mount) > $bestLength) {
                $best = $mount;
                $bestLength = strlen($mount);
            }
        }

        return $best;
    }

    /** Simpan hasil uji konektivitas API eksternal supaya bisa dipakai ulang. */
    private function rememberDeep(array $check): array
    {
        Cache::put(self::DEEP_CACHE_KEY, [
            'at' => now()->toIso8601String(),
            'check' => $check,
        ], now()->addMinutes(self::DEEP_TTL_MINUTES * 2));

        return $check;
    }

    /** Waktu pemeriksaan lokal terakhir (bukan uji API) untuk label header. */
    public function lastLocalScanAt(): ?string
    {
        $scan = $this->lastScan();

        return is_array($scan) ? ($scan['checked_at'] ?? null) : null;
    }

    /**
     * Cloudflare: pintu masuk seluruh trafik produksi.
     *
     * Kesehatannya diperiksa dari dua layer:
     * 1. Metrics tunnel cloudflared di loopback (jumlah konektor, request, dan laju error).
     * 2. Cloudflare API (status zona dan verifikasi Edge DNS proxied).
     *
     * @return HealthCheck
     */
    private function cloudflare(bool $deep): array
    {
        $metricsUrl = (string) config('services.cloudflare.tunnel_metrics_url', '');
        $hostname = (string) config('services.cloudflare.hostname', '');

        if ($hostname === '') {
            $hostname = (string) parse_url((string) config('app.url'), PHP_URL_HOST);
        }

        $metrik = $this->readTunnelMetrics($metricsUrl);

        // Endpoint metrics tidak terbaca: proses tunnel mati atau metrics
        // dimatikan. Ini kondisi paling berbahaya karena trafik tidak masuk.
        if ($metrik === null) {
            return $this->check(
                key: 'cloudflare',
                name: 'Cloudflare',
                group: 'integration',
                provider: 'Cloudflare · '.($hostname !== '' ? $hostname : 'tunnel'),
                status: self::STATUS_OFFLINE,
                summary: 'Metrics tunnel tidak terbaca. Pastikan proses cloudflared hidup.',
                details: $metricsUrl !== '' ? ['Endpoint metrics: '.$metricsUrl] : [],
                action: ['label' => 'Lihat detail'],
            );
        }

        $konektor = $metrik['ha_connections'];
        $total = $metrik['total_requests'];
        $errors = $metrik['errors'];
        $rate = $total > 0 ? round(($errors / $total) * 100, 2) : 0.0;

        // Tanpa konektor, tunnel tidak meneruskan apa pun.
        if ($konektor === 0) {
            return $this->check(
                key: 'cloudflare',
                name: 'Cloudflare',
                group: 'integration',
                provider: 'Cloudflare · '.($hostname !== '' ? $hostname : 'tunnel'),
                status: self::STATUS_FAILED,
                summary: 'Tidak ada konektor aktif. Situs tidak dapat diakses dari internet.',
                details: ['Jalankan systemctl restart cloudflared di server.'],
                action: ['label' => 'Lihat detail'],
            );
        }

        $apiToken = (string) config('services.cloudflare.api_token', '');
        $zoneId = (string) config('services.cloudflare.zone_id', '');
        $zoneInfo = $this->readCloudflareZone($apiToken, $zoneId, $hostname);

        $zoneDetails = [];
        if ($zoneInfo !== null) {
            $zoneDetails[] = 'Zona Cloudflare: '.$zoneInfo['zone_name'].' ('.$zoneInfo['zone_status'].($zoneInfo['plan'] !== '' ? ' · '.$zoneInfo['plan'] : '').')';
            if ($zoneInfo['proxied'] === true) {
                $zoneDetails[] = 'Edge DNS: '.($hostname !== '' ? $hostname : 'hostname').' terhubung ke tunnel (proxied)';
            }
        } elseif ($apiToken !== '' && $zoneId !== '') {
            $zoneDetails[] = 'API zona Cloudflare: tidak merespons';
        }

        $detail = array_merge($zoneDetails, [
            'Total permintaan: '.number_format($total, 0, ',', '.').' sejak tunnel berjalan.',
            'Kode respons: '.$this->kodeResponsRingkas($metrik['by_code']),
        ]);

        // Satu konektor = titik tunggal kegagalan. ADR-003 meminta minimal dua.
        if ($konektor < 2) {
            return $this->check(
                key: 'cloudflare',
                name: 'Cloudflare',
                group: 'integration',
                provider: 'Cloudflare · '.($hostname !== '' ? $hostname : 'tunnel'),
                status: self::STATUS_WARNING,
                summary: '1 konektor aktif. Bila konektor ini putus, situs langsung tidak dapat diakses.',
                details: array_merge($detail, ['ADR-003 meminta minimal dua konektor untuk ketersediaan.']),
                action: ['label' => 'Lihat detail'],
            );
        }

        $status = match (true) {
            $rate >= 5.0 => self::STATUS_FAILED,
            $rate >= 1.0 => self::STATUS_WARNING,
            $metrik['server_errors'] > 0 && $total > 0 && ($metrik['server_errors'] / $total) * 100 >= 1.0 => self::STATUS_WARNING,
            $zoneInfo !== null && ($zoneInfo['zone_status'] !== 'active' || $zoneInfo['paused']) => self::STATUS_WARNING,
            default => self::STATUS_HEALTHY,
        };

        $summaryPrefix = $konektor.' konektor aktif';
        if ($zoneInfo !== null && $zoneInfo['proxied'] === true) {
            $summaryPrefix .= ' · DNS proxied';
        }

        return $this->check(
            key: 'cloudflare',
            name: 'Cloudflare',
            group: 'integration',
            provider: 'Cloudflare · '.($hostname !== '' ? $hostname : 'tunnel'),
            status: $status,
            summary: $summaryPrefix.' · error tunnel '.$this->persen($rate),
            details: $detail,
            action: $status === self::STATUS_HEALTHY ? null : ['label' => 'Lihat detail'],
        );
    }

    /**
     * Baca status zona dan DNS Cloudflare melalui API.
     *
     * @return array{zone_name: string, zone_status: string, plan: string, paused: bool, proxied: ?bool}|null
     */
    private function readCloudflareZone(string $apiToken, string $zoneId, string $hostname): ?array
    {
        if ($apiToken === '' || $zoneId === '') {
            return null;
        }

        return Cache::remember('cf_zone_status_'.$zoneId, 180, function () use ($apiToken, $zoneId, $hostname) {
            try {
                $zoneResp = Http::withToken($apiToken)
                    ->timeout(3)
                    ->get("https://api.cloudflare.com/client/v4/zones/{$zoneId}");

                if (! $zoneResp->successful()) {
                    return null;
                }

                $json = $zoneResp->json();
                if (! ($json['success'] ?? false) || ! isset($json['result'])) {
                    return null;
                }

                $res = $json['result'];
                $proxied = null;

                if ($hostname !== '') {
                    $dnsResp = Http::withToken($apiToken)
                        ->timeout(3)
                        ->get("https://api.cloudflare.com/client/v4/zones/{$zoneId}/dns_records", [
                            'name' => $hostname,
                        ]);

                    if ($dnsResp->successful()) {
                        $dnsJson = $dnsResp->json();
                        if (($dnsJson['success'] ?? false) && ! empty($dnsJson['result'][0])) {
                            $proxied = (bool) ($dnsJson['result'][0]['proxied'] ?? false);
                        }
                    }
                }

                return [
                    'zone_name' => (string) ($res['name'] ?? ''),
                    'zone_status' => (string) ($res['status'] ?? 'unknown'),
                    'plan' => (string) ($res['plan']['name'] ?? ''),
                    'paused' => (bool) ($res['paused'] ?? false),
                    'proxied' => $proxied,
                ];
            } catch (\Throwable) {
                return null;
            }
        });
    }

    /**
     * Baca dan ringkas metrik tunnel cloudflared.
     *
     * @return array{ha_connections: int, total_requests: int, errors: int, server_errors: int, by_code: array<string, int>}|null
     */
    private function readTunnelMetrics(string $url): ?array
    {
        if ($url === '') {
            return null;
        }

        try {
            $response = Http::timeout(3)->get($url);

            if (! $response->successful()) {
                return null;
            }

            $byCode = [];
            $total = 0;
            $ha = 0;
            $errors = 0;

            foreach (preg_split('/\r?\n/', (string) $response->body()) ?: [] as $baris) {
                if ($baris === '' || str_starts_with($baris, '#')) {
                    continue;
                }

                if (preg_match('/^cloudflared_tunnel_ha_connections\s+([\d.]+)/', $baris, $m)) {
                    $ha = (int) $m[1];
                    continue;
                }

                if (preg_match('/^cloudflared_tunnel_request_errors\s+([\d.]+)/', $baris, $m)) {
                    $errors = (int) $m[1];
                    continue;
                }

                if (preg_match('/^cloudflared_tunnel_response_by_code\{status_code="(\d+)"\}\s+([\d.]+)/', $baris, $m)) {
                    $kode = $m[1];
                    $jumlah = (int) $m[2];
                    $byCode[$kode] = ($byCode[$kode] ?? 0) + $jumlah;
                    $total += $jumlah;
                }
            }

            // Tanpa satu pun deret response_by_code, metrik dianggap tidak valid.
            if ($byCode === []) {
                return null;
            }

            $serverErrors = 0;
            foreach ($byCode as $kode => $jumlah) {
                if (str_starts_with($kode, '5')) {
                    $serverErrors += $jumlah;
                }
            }

            return [
                'ha_connections' => $ha,
                'total_requests' => $total,
                'errors' => $errors,
                'server_errors' => $serverErrors,
                'by_code' => $byCode,
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Ringkas kode respons menjadi kelompok yang berguna dibaca admin.
     *
     * @param  array<string, int>  $byCode
     */
    private function kodeResponsRingkas(array $byCode): string
    {
        $kelompok = ['2xx' => 0, '3xx' => 0, '4xx' => 0, '5xx' => 0];

        foreach ($byCode as $kode => $jumlah) {
            $awalan = substr((string) $kode, 0, 1).'xx';
            if (isset($kelompok[$awalan])) {
                $kelompok[$awalan] += $jumlah;
            }
        }

        $bagian = [];
        foreach ($kelompok as $label => $jumlah) {
            if ($jumlah > 0) {
                $bagian[] = $label.' '.number_format($jumlah, 0, ',', '.');
            }
        }

        return $bagian === [] ? 'belum ada data' : implode(' · ', $bagian);
    }

    /** Persen dengan koma desimal, konsisten dengan format Indonesia. */
    private function persen(float $value): string
    {
        return number_format($value, 2, ',', '.').'%';
    }

    /**
     * Status backup & pemulihan untuk panel admin (kontrak owner 2026-09-20).
     *
     * Sumber data = artefak nyata di server: dump harian, log arsip mingguan
     * dan bulanan, marker uji restore, dan marker ALERT. Semua dibaca
     * read-only oleh www-data tanpa sudo. Bila direktori backup tidak ada
     * (mis. lingkungan lokal), return null supaya UI menyembunyikan panel,
     * bukan mengarang status. Copy ditulis awam, tanpa istilah teknis.
     *
     * Setiap item memuat waktu terakhir berjalan dan jadwal berikutnya
     * (sampai menit) supaya admin tahu kapan backup lalu dan kapan lagi.
     *
     * @return array{overall: string, items: list<array{key: string, label: string, status: string, last: string, next: string, hint: string, scope: string}>}|null
     */
    public function backupStatus(): ?array
    {
        $dir = '/root/backups';

        if (! is_dir($dir)) {
            return null;
        }

        $now = now();
        $wib = ' WIB';
        $format = 'd M Y, H.i';
        $items = [];

        // ===== 1) Backup harian: dump penuh tiap malam 03.17 UTC (10.17 WIB) =====
        $latest = $dir.'/ragil/ragil_aluminium-latest.sql.gz';

        if (is_file($latest)) {
            $mtime = @filemtime($latest);
            $umurDetik = $mtime !== null ? max(0, $now->getTimestamp() - $mtime) : null;
            $last = $mtime !== null
                ? \Illuminate\Support\Carbon::createFromTimestampUTC($mtime)->setTimezone(config('app.timezone', 'UTC'))->locale('id')->translatedFormat($format).$wib
                : 'Tidak ditemukan';
            $status = $umurDetik !== null && $umurDetik <= 26 * 3600
                ? self::STATUS_HEALTHY
                : ($umurDetik !== null && $umurDetik <= 48 * 3600 ? self::STATUS_WARNING : self::STATUS_FAILED);
        } else {
            $last = 'Tidak ditemukan';
            $status = self::STATUS_FAILED;
        }

        $items[] = [
            'key' => 'backup-harian',
            'label' => 'Backup harian',
            'status' => $status,
            'last' => $last,
            'next' => $this->nextUtcRun(3, 17)->locale('id')->translatedFormat($format).$wib,
            'hint' => 'Salinan lengkap seluruh data toko dibuat otomatis setiap malam.',
            'scope' => 'Data pelanggan, pesanan, pembayaran, ulasan, dan pengaturan toko.',
        ];

        // ===== 2) Backup mingguan: arsip tiap Senin 05.00 UTC (12.00 WIB) =====
        $mingguan = $this->arsipTerakhir($dir.'/weekly-archive.log', 'weekly/');
        $items[] = [
            'key' => 'backup-mingguan',
            'label' => 'Backup mingguan',
            'status' => $mingguan !== null
                ? ($now->diffInDays($mingguan['at']) <= 10 ? self::STATUS_HEALTHY : self::STATUS_WARNING)
                : self::STATUS_WARNING,
            'last' => $mingguan !== null
                ? $mingguan['at']->locale('id')->translatedFormat($format).$wib
                : 'Belum pernah',
            'next' => $this->nextUtcRun(5, 0, 1)->locale('id')->translatedFormat($format).$wib,
            'hint' => 'Salinan cadangan mingguan yang disimpan di luar server, aman bila server bermasalah.',
            'scope' => 'Sama seperti backup harian, disimpan terpisah di penyimpanan awan.',
        ];

        // ===== 3) Backup bulanan: arsip tanggal 1, 05.00 UTC (12.00 WIB) =====
        $bulanan = $this->arsipTerakhir($dir.'/monthly-archive.log', 'monthly/');
        $items[] = [
            'key' => 'backup-bulanan',
            'label' => 'Backup bulanan',
            'status' => $bulanan !== null
                ? ($now->diffInDays($bulanan['at']) <= 40 ? self::STATUS_HEALTHY : self::STATUS_WARNING)
                : self::STATUS_WARNING,
            'last' => $bulanan !== null
                ? $bulanan['at']->locale('id')->translatedFormat($format).$wib.' ('.$bulanan['label'].')'
                : 'Belum pernah',
            'next' => \Illuminate\Support\Carbon::now('UTC')->startOfMonth()->addMonth()->setTime(5, 0, 0)->setTimezone(config('app.timezone', 'UTC'))->locale('id')->translatedFormat($format).$wib,
            'hint' => 'Salinan cadangan bulanan jangka panjang di penyimpanan awan.',
            'scope' => 'Sama seperti backup harian, disimpan terpisah di penyimpanan awan.',
        ];

        // ===== 4) Uji pemulihan: Senin 04.30 UTC (11.30 WIB) =====
        $markerRestore = $dir.'/last-restore-test-pass';
        $waktuRestore = null;

        if (is_file($markerRestore)) {
            $isi = trim((string) @file_get_contents($markerRestore));
            $waktuRestore = $isi !== '' ? \Illuminate\Support\Carbon::parse($isi, 'UTC') : null;
        }

        $items[] = [
            'key' => 'backup-uji-pulihkan',
            'label' => 'Uji pemulihan',
            'status' => $waktuRestore !== null
                ? ($now->diffInDays($waktuRestore) <= 8 ? self::STATUS_HEALTHY : self::STATUS_WARNING)
                : self::STATUS_FAILED,
            'last' => $waktuRestore !== null
                ? $waktuRestore->setTimezone(config('app.timezone', 'UTC'))->locale('id')->translatedFormat($format).$wib
                : 'Belum pernah',
            'next' => $this->nextUtcRun(4, 30, 1)->locale('id')->translatedFormat($format).$wib,
            'hint' => 'Rutin memastikan cadangan benar-benar bisa dipakai, bukan sekadar ada.',
            'scope' => 'Salinan terbaru dikembalikan ke server uji lalu dibandingkan dengan data asli.',
        ];

        // ===== 5) Pemeriksaan pendukung: tiap 5 menit, tanpa jadwal tetap =====
        $alertAktif = [];
        $alertTerbaru = 0;
        foreach (glob($dir.'/ALERT-*') ?: [] as $file) {
            $mtime = @filemtime($file);
            if ($mtime === null) {
                continue;
            }
            if (($now->getTimestamp() - $mtime) <= 24 * 3600) {
                $alertAktif[] = basename($file);
                $alertTerbaru = max($alertTerbaru, $mtime);
            }
        }

        $items[] = [
            'key' => 'backup-alert',
            'label' => 'Kondisi sistem pendukung',
            'status' => $alertAktif === [] ? self::STATUS_HEALTHY : self::STATUS_WARNING,
            'last' => $alertAktif === []
                ? 'Tidak ada masalah dalam 24 jam terakhir'
                : 'Terakhir menandai masalah '.$now->setTimestamp($alertTerbaru)->locale('id')->translatedFormat($format).$wib,
            'next' => 'Berjalan terus, tiap 5 menit',
            'hint' => 'Pemeriksaan otomatis server pendukung backup dan situs.',
            'scope' => $alertAktif === []
                ? 'Semua pemeriksaan otomatis lulus.'
                : count($alertAktif).' pemeriksaan perlu ditinjau: '.implode(', ', $alertAktif),
        ];

        $terburuk = self::STATUS_HEALTHY;
        foreach ($items as $item) {
            if ($item['status'] === self::STATUS_FAILED) {
                $terburuk = self::STATUS_FAILED;
                break;
            }
            if ($item['status'] === self::STATUS_WARNING) {
                $terburuk = self::STATUS_WARNING;
            }
        }

        return [
            'overall' => $terburuk,
            'items' => $items,
        ];
    }

    /**
     * Jadwal berikutnya dari cron server (zona UTC), dikonversi ke zona
     * waktu aplikasi. $dayOfWeek ISO 1-7 (Senin = 1); null = setiap hari.
     */
    private function nextUtcRun(int $hour, int $minute, ?int $dayOfWeek = null): \Illuminate\Support\Carbon
    {
        $nowUtc = \Illuminate\Support\Carbon::now('UTC');
        $candidate = $nowUtc->copy()->setTime($hour, $minute, 0);

        if ($dayOfWeek !== null) {
            while ((int) $candidate->format('N') !== $dayOfWeek) {
                $candidate->addDay();
            }
        }

        if ($candidate->lessThanOrEqualTo($nowUtc)) {
            $candidate->addDays($dayOfWeek !== null ? 7 : 1);
        }

        return $candidate->setTimezone(config('app.timezone', 'UTC'));
    }

    /**
     * Periode arsip terakhir yang berhasil diunggah, dari log uploader.
     * Baris upload tidak memuat timestamp, tetapi nama file memuat periode
     * arsip: mingguan `YYYY-Www`, bulanan `YYYY-MM`. Keduanya dikonversi
     * menjadi tanggal representatif di zona waktu aplikasi.
     *
     * @return array{label: string, at: \Illuminate\Support\Carbon\CarbonInterface}|null
     */
    private function arsipTerakhir(string $logPath, string $prefix): ?array
    {
        $baris = @file($logPath, FILE_IGNORE_NEW_LINES) ?: [];

        for ($i = count($baris) - 1; $i >= 0; $i--) {
            $barisLog = $baris[$i];

            if (! str_contains($barisLog, $prefix) || ! str_contains($barisLog, ': 200')) {
                continue;
            }

            $tz = config('app.timezone', 'UTC');

            if (str_contains($prefix, 'weekly') && preg_match('/(\d{4})-W(\d{2})\.sql\.gz/', $barisLog, $m)) {
                // Senin pekan tersebut sebagai wakil tanggal arsip mingguan.
                $at = \Illuminate\Support\Carbon::parse($m[1].'W'.$m[2].' 05:00', 'UTC')->setTimezone($tz);

                return ['label' => 'Pekan '.$m[2].' '.$m[1], 'at' => $at];
            }

            if (str_contains($prefix, 'monthly') && preg_match('/(\d{4})-(\d{2})\.sql\.gz/', $barisLog, $m)) {
                $at = \Illuminate\Support\Carbon::parse($m[1].'-'.$m[2].'-01 05:00', 'UTC')->setTimezone($tz);

                return ['label' => \Illuminate\Support\Carbon::parse($m[1].'-'.$m[2].'-01')->locale('id')->translatedFormat('F Y'), 'at' => $at];
            }
        }

        return null;
    }

    private function ms(float $value): string
    {
        return $value >= 100 ? round($value).' ms' : number_format($value, 1, ',', '.').' ms';
    }

    /** Durasi dalam bahasa manusia: 12 detik lalu, 8 menit lalu, 3 jam lalu. */
    private function humanDuration(int $seconds): string
    {
        return match (true) {
            $seconds < 60 => $seconds.' detik',
            $seconds < 3600 => intdiv($seconds, 60).' menit',
            $seconds < 86400 => intdiv($seconds, 3600).' jam',
            default => intdiv($seconds, 86400).' hari',
        };
    }

    /** Masking nomor: hanya 4 digit akhir yang tampak. */
    private function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if (strlen($digits) < 6) {
            return '••••';
        }

        return '+'.substr($digits, 0, 2).' '.substr($digits, 2, 3).' •••• '.substr($digits, -4);
    }

    private function brief(\Throwable $e): string
    {
        return Str::limit($e->getMessage(), 120);
    }
}
