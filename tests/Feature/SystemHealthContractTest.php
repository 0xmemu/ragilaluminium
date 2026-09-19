<?php

namespace Tests\Feature;

use App\Services\SystemHealthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak System Health Console: status memakai kosakata integrasi, ambang
 * batas ditentukan di logic (bukan warna UI), dan status tidak pernah
 * diturunkan dari Boolean(config).
 */
class SystemHealthContractTest extends TestCase
{
    use RefreshDatabase;

    private function service(): SystemHealthService
    {
        return app(SystemHealthService::class);
    }

    /** Ambang memori: normal di bawah 75, perhatian 75-90, kritis di atas 90. */
    public function test_ambang_memori(): void
    {
        $svc = $this->service();

        $this->assertSame('healthy', $svc->memoryStatus(40.0));
        $this->assertSame('healthy', $svc->memoryStatus(74.9));
        $this->assertSame('warning', $svc->memoryStatus(75.0));
        $this->assertSame('warning', $svc->memoryStatus(90.0));
        $this->assertSame('failed', $svc->memoryStatus(90.1));
        $this->assertSame('unknown', $svc->memoryStatus(null));
    }

    /** Ambang disk memakai aturan yang sama dengan memori. */
    public function test_ambang_disk(): void
    {
        $svc = $this->service();

        $this->assertSame('healthy', $svc->diskStatus(38.4));
        $this->assertSame('warning', $svc->diskStatus(80.0));
        $this->assertSame('failed', $svc->diskStatus(95.0));
        $this->assertSame('unknown', $svc->diskStatus(null));
    }

    /**
     * Load dinilai terhadap jumlah vCPU. Load 4 pada 4 vCPU belum kritis,
     * tetapi load 4 pada 1 vCPU sudah jauh di atas kapasitas.
     */
    public function test_load_dinilai_terhadap_jumlah_vcpu(): void
    {
        $svc = $this->service();

        $this->assertSame('healthy', $svc->loadStatus(0.7, 4));
        $this->assertSame('warning', $svc->loadStatus(3.8, 4));
        $this->assertSame('failed', $svc->loadStatus(6.5, 4));

        // vCPU 1: beban 2 sudah dua kali kapasitas.
        $this->assertSame('failed', $svc->loadStatus(2.0, 1));
        $this->assertSame('warning', $svc->loadStatus(1.0, 1));

        // Tanpa jumlah vCPU, angka load tidak bisa dinilai.
        $this->assertSame('unknown', $svc->loadStatus(1.2, null));
        $this->assertSame('unknown', $svc->loadStatus(null, 4));
    }

    /** Latensi database memakai milidetik dengan ambang 200 dan 1000. */
    public function test_ambang_latensi_database(): void
    {
        $svc = $this->service();

        $this->assertSame('healthy', $svc->dbStatus(1.4));
        $this->assertSame('warning', $svc->dbStatus(250.0));
        $this->assertSame('failed', $svc->dbStatus(1500.0));
        $this->assertSame('unknown', $svc->dbStatus(null));
    }

    /** Setiap check memakai bentuk kontrak dan kosakata status yang sah. */
    public function test_bentuk_check_mengikuti_kontrak(): void
    {
        $checks = $this->service()->checks(false);

        $this->assertNotEmpty($checks);

        $sah = ['healthy', 'warning', 'failed', 'offline', 'not_configured', 'checking', 'unknown'];

        foreach ($checks as $check) {
            foreach (['key', 'name', 'group', 'provider', 'status', 'summary', 'checked_at', 'latency_ms', 'action', 'details'] as $kunci) {
                $this->assertArrayHasKey($kunci, $check, "Check {$check['key']} tidak punya field {$kunci}.");
            }

            $this->assertContains($check['group'], ['infrastructure', 'integration'], "Grup check {$check['key']} tidak dikenal.");
            $this->assertContains($check['status'], $sah, "Status check {$check['key']} di luar kosakata kontrak.");
            $this->assertNotSame('', trim($check['summary']), "Check {$check['key']} tanpa ringkasan.");
        }
    }

    /** Redis cache dan Queue worker adalah dua check terpisah. */
    public function test_redis_dan_queue_worker_dipisah(): void
    {
        $checks = collect($this->service()->checks(false));
        $keys = $checks->pluck('key')->all();

        $this->assertContains('cache', $keys, 'Pemeriksaan cache Redis harus ada.');
        $this->assertContains('queue-worker', $keys, 'Pemeriksaan queue worker harus ada.');

        $cache = $checks->firstWhere('key', 'cache');
        $worker = $checks->firstWhere('key', 'queue-worker');

        $this->assertSame('infrastructure', $cache['group']);
        $this->assertSame('infrastructure', $worker['group']);
        $this->assertNotSame($cache['name'], $worker['name'], 'Nama kedua check harus berbeda.');
    }

    /** Ringkasan konsisten dengan daftar check yang diberikan. */
    public function test_ringkasan_konsisten_dengan_daftar_check(): void
    {
        $svc = $this->service();
        $checks = $svc->checks(false);
        $summary = $svc->summary($checks);

        $this->assertSame(count($checks), $summary['total']);
        $this->assertSame($summary['total'], array_sum($summary['counts']));

        // failed_names harus tepat memuat nama check yang tidak sehat, tidak
        // kurang dan tidak lebih. Ini menjaga daftar "perlu perhatian" di UI
        // selalu sinkron dengan hasil pemeriksaan.
        $tidakSehat = array_values(array_map(
            fn (array $c) => $c['name'],
            array_filter($checks, fn (array $c) => $c['status'] !== 'healthy'),
        ));
        $this->assertSame($tidakSehat, $summary['failed_names']);
    }

    /** Kegagalan mengalahkan peringatan pada status global. */
    public function test_status_global_mengutamakan_kegagalan(): void
    {
        $svc = $this->service();

        $buat = fn (string $status) => [
            'key' => 'x', 'name' => 'X', 'group' => 'infrastructure', 'provider' => null,
            'status' => $status, 'summary' => 'ringkasan', 'checked_at' => now()->toIso8601String(),
            'latency_ms' => null, 'action' => null, 'details' => [],
        ];

        $gabungan = $svc->summary([$buat('healthy'), $buat('warning'), $buat('offline')]);
        $this->assertSame('failed', $gabungan['overall'], 'Offline harus mengalahkan warning.');

        $hanyaPeringatan = $svc->summary([$buat('healthy'), $buat('not_configured')]);
        $this->assertSame('warning', $hanyaPeringatan['overall']);

        $semuaSehat = $svc->summary([$buat('healthy'), $buat('healthy')]);
        $this->assertSame('healthy', $semuaSehat['overall']);
        $this->assertSame('Sistem sehat', $semuaSehat['headline']);
        $this->assertSame([], $semuaSehat['failed_names']);
    }

    /** Headline selalu punya padanan teks, bukan warna saja. */
    public function test_headline_punya_teks_untuk_setiap_status(): void
    {
        $svc = $this->service();

        foreach (['healthy', 'warning', 'failed', 'not_configured', 'unknown'] as $status) {
            $this->assertNotSame('', $svc->headline($status), "Status {$status} tidak punya headline.");
        }
    }

    /**
     * Kontrak owner 2026-09-20: J&T keluar dari Pengaturan Sistem karena
     * integrasinya berisiko disentuh; dicek manual lewat backend. Test ini
     * menjaga agar J&T tidak pernah kembali masuk daftar check tanpa
     * keputusan owner yang eksplisit.
     */
    public function test_jnt_tidak_masuk_daftar_pemeriksaan(): void
    {
        $keys = collect($this->service()->checks(false))->pluck('key')->all();
        $this->assertNotContains('jnt', $keys, 'J&T tidak boleh ada di Pengaturan Sistem (kontrak owner 2026-09-20).');
    }

    /** Halaman menampilkan server metrics dan riwayat untuk grafik. */
    public function test_halaman_mengirim_metrik_server_dan_riwayat(): void
    {
        config(['cache.default' => 'array']);

        $admin = \App\Models\User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.settings.index'))
            ->assertOk()
            ->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
                ->component('Admin/SystemHealth')
                ->has('checks')
                ->has('summary.overall')
                ->has('summary.counts')
                ->has('server.vcpu')
                ->has('server.load_1')
                ->has('server.memory_pct')
                ->has('server.disk_pct')
                ->has('server.disk_mount')
                ->has('history')
                ->has('lastCheckedAt'));
    }
}
