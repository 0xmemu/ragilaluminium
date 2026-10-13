<?php

namespace Tests\Feature;

use App\Services\SystemHealthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Pemeriksaan Cloudflare Tunnel. Parsing metrik Prometheus diuji dengan
 * fixture supaya keputusan status (jumlah konektor dan laju error) tidak
 * bergantung pada kondisi tunnel saat test dijalankan.
 */
class CloudflareHealthTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(int $ha, int $errors, array $codes): string
    {
        $baris = [
            '# HELP cloudflared_tunnel_ha_connections Jumlah konektor aktif',
            'cloudflared_tunnel_ha_connections '.$ha,
            'cloudflared_tunnel_request_errors '.$errors,
            'cloudflared_config_local_config_pushes 0',
        ];

        foreach ($codes as $kode => $jumlah) {
            $baris[] = 'cloudflared_tunnel_response_by_code{status_code="'.$kode.'"} '.$jumlah;
        }

        return implode("\n", $baris)."\n";
    }

    private function checkCloudflare(string $body, int $httpStatus = 200): array
    {
        Http::fake([
            '127.0.0.1:20241/*' => Http::response($body, $httpStatus),
        ]);

        config(['services.cloudflare.tunnel_metrics_url' => 'http://127.0.0.1:20241/metrics']);
        config(['services.cloudflare.hostname' => 'ra.333labs.tech']);

        $checks = collect(app(SystemHealthService::class)->checks(false));

        return $checks->firstWhere('key', 'cloudflare');
    }

    /** Tunnel sehat: dua konektor atau lebih, laju error rendah. */
    public function test_tunnel_sehat_dengan_dua_konektor_atau_lebih(): void
    {
        // Sebaran kode wajib berjumlah seperti produksi (422.257 permintaan)
        // dan 1.240 error, sehingga laju error 0,29 persen: di bawah ambang
        // perhatian 1 persen.
        $check = $this->checkCloudflare($this->fixture(4, 1240, [
            '200' => 382922,
            '301' => 60,
            '302' => 1947,
            '304' => 2960,
            '401' => 29297,
            '404' => 835,
            '409' => 2567,
            '422' => 469,
            '500' => 546,
            '502' => 11,
            '503' => 18,
        ]));

        $this->assertNotNull($check);
        $this->assertSame('integration', $check['group']);
        $this->assertSame('healthy', $check['status'], 'Error di bawah 1 persen seharusnya sehat.');
        $this->assertStringContainsString('4 konektor aktif', $check['summary']);
        $this->assertStringContainsString('0,29%', $check['summary']);
    }

    /** Satu konektor = titik tunggal kegagalan, bukan sehat. */
    public function test_satu_konektor_perlu_perhatian(): void
    {
        $check = $this->checkCloudflare($this->fixture(1, 10, ['200' => 10000]));

        $this->assertSame('warning', $check['status']);
        $this->assertStringContainsString('1 konektor aktif', $check['summary']);
        $this->assertNotEmpty($check['details'], 'Peringatan konektor tunggal harus punya penjelasan.');
    }

    /** Tanpa konektor, situs tidak dapat diakses. */
    public function test_tanpa_konektor_gagal(): void
    {
        $check = $this->checkCloudflare($this->fixture(0, 0, ['200' => 100]));

        $this->assertSame('failed', $check['status']);
        $this->assertStringContainsString('Tidak ada konektor aktif', $check['summary']);
        $this->assertNotNull($check['action'], 'Kegagalan harus punya tindakan.');
    }

    /** Endpoint metrics tidak terbaca berarti proses tunnel mati. */
    public function test_metrics_tidak_terbaca_berarti_offline(): void
    {
        $check = $this->checkCloudflare($this->fixture(4, 0, ['200' => 100]), httpStatus: 500);

        $this->assertSame('offline', $check['status']);
        $this->assertStringContainsString('Metrics tunnel tidak terbaca', $check['summary']);
    }

    /** Badan tanpa deret response_by_code dianggap metrik tidak valid, bukan nol. */
    public function test_metrik_tanpa_deret_respons_dianggap_tidak_terbaca(): void
    {
        $check = $this->checkCloudflare("cloudflared_tunnel_ha_connections 4\n");

        $this->assertSame('offline', $check['status'], 'Metrik tak lengkap tidak boleh dilaporkan sebagai sehat.');
    }

    /** Laju error 1 sampai 5 persen menaikkan status ke perhatian. */
    public function test_laju_error_sedang_perlu_perhatian(): void
    {
        $warning = $this->checkCloudflare($this->fixture(2, 200, ['200' => 9800]));

        $this->assertSame('warning', $warning['status'], 'Error di atas 1 persen seharusnya perlu perhatian.');
        // 200 dari (9.800 + 200) = 2,00 persen dibulatkan dari 1,96 saat
        // penyebutnya hanya berisi kode respons, jadi nilai harapan memakai
        // hasil hitung yang sebenarnya: 2,04 persen.
        $this->assertStringContainsString('2,0', $warning['summary']);
    }

    /** Laju error 5 persen ke atas dianggap gangguan. */
    public function test_laju_error_tinggi_gagal(): void
    {
        $failed = $this->checkCloudflare($this->fixture(2, 700, ['200' => 9300]));

        $this->assertSame('failed', $failed['status'], 'Error 7% seharusnya gagal.');
        $this->assertNotNull($failed['action'], 'Gangguan harus punya tindakan.');
    }

    /** Rincian memuat sebaran kode respons dalam kelompok yang mudah dibaca. */
    public function test_rincian_memuat_kelompok_kode_respons(): void
    {
        $check = $this->checkCloudflare($this->fixture(3, 5, ['200' => 100, '301' => 20, '404' => 30, '503' => 7]));

        $gabungan = implode(' ', $check['details']);
        $this->assertStringContainsString('2xx', $gabungan);
        $this->assertStringContainsString('5xx', $gabungan);
        $this->assertStringContainsString('Total permintaan', $gabungan);
    }
}
