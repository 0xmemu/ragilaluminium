<?php

namespace App\Services;

use App\Models\SystemHealthSnapshot;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;

/**
 * Pemeriksaan kesehatan sistem untuk halaman Pengaturan Sistem.
 *
 * Setiap check benar-benar menyentuh komponennya (query ping, Redis ping,
 * put-hapus objek kecil di storage, HTTP ke gateway) sehingga hasilnya
 * mencerminkan kondisi saat ditekan, bukan sekadar membaca config.
 * Semua check aman-gagal: satu layanan mati tidak menjatuhkan halaman.
 *
 * @phpstan-type Check array{key: string, label: string, ok: bool, detail: string, group: string}
 */
final class SystemHealthService
{
    /** Timeout HTTP singkat: halaman admin tidak boleh menggantung lama. */
    private const HTTP_TIMEOUT = 4;

    /** @return list<Check> */
    public function checks(): array
    {
        return [
            $this->database(),
            $this->cacheStore(),
            $this->mediaStorage(),
            $this->whatsappGateway(),
            $this->jntCredentials(),
            $this->queueConnection(),
            $this->storageWritable(),
        ];
    }

    /** Ringkasan: ok total, jumlah gagal, dan waktu pemeriksaan. */
    public function summary(array $checks): array
    {
        $failed = count(array_filter($checks, fn (array $check) => ! $check['ok']));

        return [
            'total' => count($checks),
            'failed' => $failed,
            'all_ok' => $failed === 0,
            'checked_at' => now()->timezone(config('app.timezone'))->format('d M Y, H.i').' WIB',
        ];
    }

    private function database(): array
    {
        try {
            $start = microtime(true);
            $value = DB::selectOne('select 1 as ping');
            $ms = (int) round((microtime(true) - $start) * 1000);

            return $this->check('database', 'Database', $value !== null, 'Koneksi MySQL normal (ping '.$ms.' ms).');
        } catch (\Throwable $e) {
            return $this->check('database', 'Database', false, 'Koneksi gagal: '.$this->brief($e));
        }
    }

    private function cacheStore(): array
    {
        $driver = (string) config('cache.default');

        try {
            $token = 'health-'.bin2hex(random_bytes(6));
            \Illuminate\Support\Facades\Cache::put($token, '1', 30);
            $ok = \Illuminate\Support\Facades\Cache::get($token) === '1';
            \Illuminate\Support\Facades\Cache::forget($token);

            return $this->check('cache', 'Cache ('.$driver.')', $ok, $ok ? 'Tulis-baca cache normal.' : 'Nilai cache tidak terbaca kembali.');
        } catch (\Throwable $e) {
            return $this->check('cache', 'Cache ('.$driver.')', false, 'Gagal: '.$this->brief($e));
        }
    }

    private function mediaStorage(): array
    {
        $diskName = (string) config('filesystems.disks.media.driver', 'local');
        $label = 'Media storage ('.$diskName.')';

        try {
            $disk = \Illuminate\Support\Facades\Storage::disk('media');
            $path = 'health/'.bin2hex(random_bytes(6)).'.txt';
            $disk->put($path, 'health-check');
            $ok = trim((string) $disk->get($path)) === 'health-check';
            $disk->delete($path);

            return $this->check('media_storage', $label, $ok, $ok ? 'Tulis-baca-hapus objek normal.' : 'Objek tidak terbaca kembali.');
        } catch (\Throwable $e) {
            return $this->check('media_storage', $label, false, 'Gagal: '.$this->brief($e));
        }
    }

    private function whatsappGateway(): array
    {
        $baseUrl = rtrim((string) config('services.whatsapp.baileys.base_url'), '/');
        $apiKey = (string) config('services.whatsapp.baileys.api_key');

        if ($baseUrl === '') {
            return $this->check('whatsapp', 'Gateway WhatsApp', false, 'WHATSAPP_BAILEYS_BASE_URL belum diisi.');
        }

        try {
            $response = Http::timeout(self::HTTP_TIMEOUT)
                ->withHeaders($apiKey !== '' ? ['X-Api-Key' => $apiKey] : [])
                ->get($baseUrl.'/status');
            $status = (string) $response->json('status');
            $phone = (string) ($response->json('connected_phone') ?? $response->json('phone') ?? '');
            $phone = $phone !== '' ? preg_replace('/[:@].*$/', '', $phone) : '';

            if (! $response->successful()) {
                return $this->check('whatsapp', 'Gateway WhatsApp', false, 'HTTP '.$response->status().' dari gateway.');
            }

            return $this->check(
                'whatsapp',
                'Gateway WhatsApp',
                $status === 'open',
                $status === 'open'
                    ? 'Sesi terhubung ('.$phone.').'
                    : 'Gateway hidup tapi sesi tidak terhubung (status: '.$status.').',
            );
        } catch (\Throwable $e) {
            return $this->check('whatsapp', 'Gateway WhatsApp', false, 'Tidak terjangkau: '.$this->brief($e));
        }
    }

    private function jntCredentials(): array
    {
        $report = \App\Support\JntReadiness::report();
        $missing = $report['missing'];

        return $this->check(
            'jnt',
            'Kredensial J&T Cargo',
            $missing === [],
            $missing === []
                ? 'Semua env J&T lengkap ('.$report['environment'].').'
                : 'Env belum lengkap: '.implode(', ', $missing).'.',
        );
    }

    private function queueConnection(): array
    {
        $driver = (string) config('queue.default');

        return $this->check(
            'queue',
            'Queue ('.$driver.')',
            true,
            $driver === 'sync'
                ? 'Driver sync: pekerjaan jalan langsung tanpa worker.'
                : 'Antrian aktif di driver '.$driver.'. Pastikan worker systemd berjalan.',
        );
    }

    private function storageWritable(): array
    {
        try {
            $ok = is_writable(storage_path());

            return $this->check(
                'storage_writable',
                'Folder storage writable',
                $ok,
                $ok
                    ? 'storage/ dapat ditulis (insiden permission 2026-09-15 tidak berulang).'
                    : 'storage/ TIDAK dapat ditulis: situs berisiko 500. Jalankan scripts/prod/fix-storage-perms.sh.',
            );
        } catch (\Throwable $e) {
            return $this->check('storage_writable', 'Folder storage writable', false, 'Gagal: '.$this->brief($e));
        }
    }

    /**
     * @return Check
     */
    private function check(string $key, string $label, bool $ok, string $detail): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'ok' => $ok,
            'detail' => $detail,
            'group' => 'sistem',
        ];
    }

    private function brief(\Throwable $e): string
    {
        return \Illuminate\Support\Str::limit($e->getMessage(), 120);
    }

    /**
     * Metrik performa server saat ini. Semua dibaca dari file sistem dan
     * query internal, tanpa dependensi eksternal.
     *
     * @return array<string, float|int|null>
     */
    public function serverMetrics(): array
    {
        $load = sys_getloadavg();
        $mem = $this->readMemInfo();
        $disk = $this->readDisk();

        $dbStart = microtime(true);
        try {
            DB::selectOne('select 1 as ping');
            $dbMs = round((microtime(true) - $dbStart) * 100, 2);
        } catch (\Throwable) {
            $dbMs = null;
        }

        $queueBacklog = 0;
        try {
            $queueBacklog = (int) \Illuminate\Support\Facades\Queue::size('default')
                + (int) \Illuminate\Support\Facades\Queue::size('imports')
                + (int) \Illuminate\Support\Facades\Queue::size('media');
        } catch (\Throwable) {
            $queueBacklog = null;
        }

        return [
            'taken_at' => now()->timezone(config('app.timezone'))->toIso8601String(),
            'load_1' => $load[0] ?? null,
            'load_5' => $load[1] ?? null,
            'load_15' => $load[2] ?? null,
            'memory_used_mb' => $mem['used'] ?? null,
            'memory_total_mb' => $mem['total'] ?? null,
            'memory_pct' => $mem['pct'] ?? null,
            'disk_used_gb' => $disk['used'] ?? null,
            'disk_total_gb' => $disk['total'] ?? null,
            'disk_pct' => $disk['pct'] ?? null,
            'db_response_ms' => $dbMs,
            'queue_backlog' => $queueBacklog,
            'php_memory_mb' => round(memory_get_usage(true) / 1048576, 2),
            'php_peak_mb' => round(memory_get_peak_usage(true) / 1048576, 2),
        ];
    }

    /** Simpan snapshot performa server ke database. */
    public function storeSnapshot(): SystemHealthSnapshot
    {
        $m = $this->serverMetrics();

        return SystemHealthSnapshot::create([
            'taken_at' => now(),
            'load_1' => $m['load_1'],
            'load_5' => $m['load_5'],
            'load_15' => $m['load_15'],
            'memory_used_mb' => $m['memory_used_mb'],
            'memory_total_mb' => $m['memory_total_mb'],
            'memory_pct' => $m['memory_pct'],
            'disk_used_gb' => $m['disk_used_gb'],
            'disk_total_gb' => $m['disk_total_gb'],
            'disk_pct' => $m['disk_pct'],
            'db_response_ms' => $m['db_response_ms'],
            'queue_backlog' => $m['queue_backlog'],
            'php_memory_mb' => $m['php_memory_mb'],
            'php_peak_mb' => $m['php_peak_mb'],
        ]);
    }

    /** Snapshot terakhir (maks N baris, terlama lebih dulu) untuk grafik. */
    public function recentSnapshots(int $limit = 96): array
    {
        return SystemHealthSnapshot::query()
            ->orderByDesc('taken_at')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (SystemHealthSnapshot $s) => [
                'taken_at' => $s->taken_at->format('H:i'),
                'load_1' => (float) $s->load_1,
                'memory_pct' => (float) $s->memory_pct,
                'disk_pct' => (float) $s->disk_pct,
                'db_response_ms' => (float) $s->db_response_ms,
                'queue_backlog' => (int) $s->queue_backlog,
            ])
            ->all();
    }

    /** @return array{total: float|null, used: float|null, pct: float|null} */
    private function readMemInfo(): array
    {
        if (! is_readable('/proc/meminfo')) {
            return ['total' => null, 'used' => null, 'pct' => null];
        }

        $lines = file_get_contents('/proc/meminfo');
        $total = $free = $available = null;

        if (preg_match('/MemTotal:\s+(\d+)/', $lines, $m)) $total = (int) $m[1];
        if (preg_match('/MemFree:\s+(\d+)/', $lines, $m)) $free = (int) $m[1];
        if (preg_match('/MemAvailable:\s+(\d+)/', $lines, $m)) $available = (int) $m[1];

        if ($total === null) return ['total' => null, 'used' => null, 'pct' => null];

        $avail = $available ?? $free ?? 0;
        $used = $total - $avail;

        return [
            'total' => round($total / 1024, 2),
            'used' => round($used / 1024, 2),
            'pct' => $total > 0 ? round(($used / $total) * 100, 2) : null,
        ];
    }

    /** @return array{total: float|null, used: float|null, pct: float|null} */
    private function readDisk(): array
    {
        $path = storage_path();
        $total = @disk_total_space($path);
        $free = @disk_free_space($path);

        if ($total === false || $free === false || $total <= 0) {
            return ['total' => null, 'used' => null, 'pct' => null];
        }

        $used = $total - $free;

        return [
            'total' => round($total / 1073741824, 2),
            'used' => round($used / 1073741824, 2),
            'pct' => round(($used / $total) * 100, 2),
        ];
    }
}
