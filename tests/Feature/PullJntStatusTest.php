<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
use App\Models\Order;
use App\Models\ShippingRecord;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Mockery;
use Tests\TestCase;

/**
 * Item 7 antrean pekerjaan: penarik status J&T terjadwal sebagai cadangan
 * webhook. Ini satu-satunya penarik yang dijadwalkan.
 *
 * Kontrak:
 * - Resi J&T aktif (belum terminal, termasuk yang sedang bermasalah) ditarik;
 *   resi terminal tidak ditarik.
 * - Nama kurir yang dicari mengikuti konvensi penulisan resi di aplikasi
 *   (ShippingRecord::CARRIER_JNT), dan ejaan lama 'JNT' tetap ikut ditarik.
 *   Penjaga ini ada karena versi pertama perintah menyaring 'JNT' saja
 *   sementara penulis resi memakai 'J&T Cargo', sehingga tidak pernah ada
 *   resi yang cocok dan jaring pengaman webhook tidak pernah bekerja.
 * - Tiap resi punya jatah waktu (kolom next_poll_at); resi yang baru diperiksa
 *   tidak diambil lagi sebelum jatahnya lewat.
 * - Gagal API menggeser jadwal mundur, mencatat kesalahan, dan memberi tahu
 *   admin setelah beberapa kali gagal berturut-turut.
 * - Fitur dimatikan: tidak ada permintaan ke J&T.
 */
class PullJntStatusTest extends TestCase
{
    use RefreshDatabase;

    private function resi(
        string $status,
        string $umur = '-2 days',
        string $waybill = 'JT-PULL-1',
        string $carrier = ShippingRecord::CARRIER_JNT,
    ): ShippingRecord {
        $order = Order::create([
            'order_number' => 'RA-PULL-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '081200000123',
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'shipped',
            'payment_status' => 'pending',
            'shipping_status' => $status,
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);

        return ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => $carrier,
            'waybill_number' => $waybill,
            'status' => $status,
            'last_status_at' => now()->modify($umur),
        ]);
    }

    private function nyalakanJnt(): void
    {
        config([
            'jnt.enabled' => true,
            'jnt.credentials.api_account' => 'uji',
            'jnt.credentials.private_key' => 'kunci-uji',
            'jnt.base_url' => [
                'sandbox' => 'https://apitest.jnt.test',
                'production' => 'https://apitest.jnt.test',
            ],
            'jnt.environment' => 'sandbox',
        ]);
    }

    /** Resi yang benar-benar dikirim ke J&T pada satu kali jalan. */
    private function resiYangDitempelKeApi(): array
    {
        $ditempel = [];

        Http::assertSent(function ($request) use (&$ditempel) {
            if (! str_contains($request->url(), '/api/logistics/trace')) {
                return false;
            }
            $ditempel[] = $request->body();

            return true;
        });

        return $ditempel;
    }

    public function test_hanya_resi_aktif_yang_ditarik(): void
    {
        $this->nyalakanJnt();
        $this->resi('in_transit', '-5 days', 'JT-AKTIF-1');
        $this->resi('delivered', '-1 day', 'JT-SELESAI-1');

        Http::fake(['*' => Http::response(['success' => false, 'reason' => 'uji'], 500)]);

        $this->artisan('shipping:pull-jnt')->assertSuccessful();

        $ditempel = $this->resiYangDitempelKeApi();

        $this->assertNotEmpty($ditempel);
        $this->assertTrue(collect($ditempel)->every(fn ($body) => str_contains($body, 'JT-AKTIF-1')));
        $this->assertTrue(collect($ditempel)->every(fn ($body) => ! str_contains($body, 'JT-SELESAI-1')));
    }

    public function test_resi_bermasalah_ikut_ditarik(): void
    {
        $this->nyalakanJnt();
        $this->resi('exception', '-3 days', 'JT-KENDALA-1');

        Http::fake(['*' => Http::response(['success' => false, 'reason' => 'uji'], 500)]);

        $this->artisan('shipping:pull-jnt')->assertSuccessful();

        $ditempel = $this->resiYangDitempelKeApi();

        $this->assertNotEmpty($ditempel, 'resi bermasalah harus terus diperiksa sampai ada kabar baru');
        $this->assertStringContainsString('JT-KENDALA-1', $ditempel[0]);
    }

    public function test_ejaan_lama_jnt_tetap_ditarik(): void
    {
        $this->nyalakanJnt();
        $this->resi('in_transit', '-2 days', 'JT-LEGACY-1', 'JNT');

        Http::fake(['*' => Http::response(['success' => false, 'reason' => 'uji'], 500)]);

        $this->artisan('shipping:pull-jnt')->assertSuccessful();

        $ditempel = $this->resiYangDitempelKeApi();

        $this->assertNotEmpty($ditempel);
        $this->assertStringContainsString('JT-LEGACY-1', $ditempel[0]);
    }

    public function test_resi_yang_jatahnya_belum_lewat_tidak_ditarik(): void
    {
        $this->nyalakanJnt();
        $rekam = $this->resi('in_transit', '-1 day', 'JT-SEGAR-1');
        $rekam->update(['next_poll_at' => now()->addMinutes(10)]);

        Http::fake(['*' => Http::response([], 200)]);

        $this->artisan('shipping:pull-jnt')
            ->expectsOutputToContain('Tidak ada resi aktif untuk ditarik.')
            ->assertSuccessful();

        Http::assertNothingSent();
    }

    public function test_berhasil_menggeser_jadwal_berikutnya_dan_mereset_pencatat(): void
    {
        $this->nyalakanJnt();
        $rekam = $this->resi('in_transit', '-1 day', 'JT-SUKSES-1');
        $rekam->update(['poll_attempts' => 3, 'last_poll_error' => 'gagal sebelumnya']);

        $mock = Mockery::mock(ShippingService::class);
        $mock->shouldReceive('refreshStatus')->once()->with(Mockery::on(fn ($r) => $r->id === $rekam->id));
        $this->app->instance(ShippingService::class, $mock);

        $this->artisan('shipping:pull-jnt')
            ->expectsOutputToContain('Resi ditarik: 1, gagal: 0')
            ->assertSuccessful();

        $rekam->refresh();

        $this->assertSame(0, $rekam->poll_attempts);
        $this->assertNull($rekam->last_poll_error);
        $this->assertNotNull($rekam->last_polled_at);
        $this->assertTrue($rekam->next_poll_at->isFuture(), 'jadwal berikutnya di masa depan');
    }

    public function test_gagal_api_menggeser_jadwal_mundur_dan_memberi_tahu_admin(): void
    {
        $this->nyalakanJnt();
        $rekam = $this->resi('in_transit', '-1 day', 'JT-GAGAL-1');
        // Percobaan ke-4, kegagalan di jalan ini menjadi ke-5 -> ambang alert.
        $rekam->update(['poll_attempts' => 4]);

        $mock = Mockery::mock(ShippingService::class);
        $mock->shouldReceive('refreshStatus')->once()->andThrow(new \RuntimeException('J&T gateway timeout'));
        $this->app->instance(ShippingService::class, $mock);

        $this->artisan('shipping:pull-jnt')
            ->expectsOutputToContain('Resi ditarik: 0, gagal: 1')
            ->assertSuccessful();

        $rekam->refresh();

        $this->assertSame(5, $rekam->poll_attempts);
        $this->assertStringContainsString('timeout', (string) $rekam->last_poll_error);
        $this->assertTrue($rekam->next_poll_at->isFuture(), 'jadwal mundur ke masa depan');
        $this->assertTrue(
            $rekam->next_poll_at->gt(now()->addMinutes(30)),
            'kegagalan memakai mundur bertingkat, bukan jeda normal'
        );
        $this->assertSame('in_transit', $rekam->status, 'kegagalan API tidak boleh mengubah status');

        $this->assertDatabaseHas('admin_notifications', [
            'type' => 'shipping_poll_failed',
            'related_type' => ShippingRecord::class,
            'related_id' => $rekam->id,
        ]);
        $this->assertSame(
            1,
            AdminNotification::where('related_id', $rekam->id)->count(),
            'pemberitahuan idempoten, satu per resi'
        );
    }

    public function test_fitur_dimatikan_tidak_menembak_api(): void
    {
        config(['operations.shipping_pull.enabled' => false]);
        $this->resi('in_transit');

        Http::fake(['*' => Http::response([], 200)]);

        $this->artisan('shipping:pull-jnt')->assertSuccessful();

        Http::assertNothingSent();
    }
}
