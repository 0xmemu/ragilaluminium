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
 * - Banyak resi ditarik dalam SATU panggilan kurir (endpoint pelacakan
 *   menerima sampai 30 nomor resi), dan kabar tiap resi harus terpakai
 *   semuanya, bukan hanya resi pertama.
 * - Resi yang tidak disebut pada respons gabungan ditarik sendiri-sendiri,
 *   jadi penggabungan tidak pernah menghilangkan kabar kurir.
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

    /** Isi badan permintaan pelacakan: daftar nomor resi yang diminta. */
    private function kodeYangDiminta(string $body): array
    {
        parse_str($body, $form);
        $biz = json_decode((string) ($form['bizContent'] ?? '{}'), true);

        return array_values(array_filter(explode(',', (string) ($biz['billCodes'] ?? ''))));
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

    /** Potongan respons trace J&T untuk satu nomor resi. */
    private function potonganRespons(string $waybill, array $details): array
    {
        return ['billCode' => $waybill, 'details' => $details];
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

    public function test_banyak_resi_ditarik_dalam_satu_panggilan(): void
    {
        $this->nyalakanJnt();
        $this->resi('in_transit', '-1 day', 'JT-BATCH-1');
        $this->resi('in_transit', '-1 day', 'JT-BATCH-2');
        $this->resi('in_transit', '-1 day', 'JT-BATCH-3');

        $panggilan = [];

        Http::fake(function ($request) use (&$panggilan) {
            $panggilan[] = $request->body();

            return Http::response([
                'code' => '1',
                'msg' => 'success',
                'data' => [
                    $this->potonganRespons('JT-BATCH-1', [[
                        'scanCode' => 3, 'scanType' => 'Scan Kirim',
                        'desc' => 'kabar resi pertama', 'scanTime' => '2026-09-28 10:00:00',
                    ]]),
                    $this->potonganRespons('JT-BATCH-2', [[
                        'scanCode' => 3, 'scanType' => 'Scan Kirim',
                        'desc' => 'kabar resi kedua', 'scanTime' => '2026-09-28 11:00:00',
                    ]]),
                    // Nomor tak dikenal: J&T mengirim elemen dengan daftar scan
                    // kosong, bukan galat (diverifikasi pada akun produksi).
                    $this->potonganRespons('JT-BATCH-3', []),
                ],
            ], 200);
        });

        $this->artisan('shipping:pull-jnt')
            ->expectsOutputToContain('Resi ditarik: 3, gagal: 0')
            ->assertSuccessful();

        $this->assertCount(1, $panggilan, 'tiga resi harus menjadi satu panggilan kurir saja');
        $this->assertEqualsCanonicalizing(
            ['JT-BATCH-1', 'JT-BATCH-2', 'JT-BATCH-3'],
            $this->kodeYangDiminta($panggilan[0]),
        );

        // Inti penjaga: kabar resi KEDUA harus ikut terpakai. Pengurai lama
        // hanya membaca elemen pertama sehingga kabar ini hilang tanpa suara.
        $this->assertDatabaseHas('shipping_tracking_events', [
            'waybill_number' => 'JT-BATCH-1',
            'description' => 'kabar resi pertama',
        ]);
        $this->assertDatabaseHas('shipping_tracking_events', [
            'waybill_number' => 'JT-BATCH-2',
            'description' => 'kabar resi kedua',
        ]);
    }

    public function test_resi_tanpa_entri_pada_respons_gabungan_ditarik_sendiri(): void
    {
        $this->nyalakanJnt();
        $this->resi('in_transit', '-1 day', 'JT-LENGKAP-1');
        $this->resi('in_transit', '-1 day', 'JT-HILANG-1');

        $panggilan = [];

        Http::fake(function ($request) use (&$panggilan) {
            $kode = $this->kodeYangDiminta($request->body());
            $panggilan[] = $kode;

            // Respons gabungan hanya menyebut satu dari dua resi yang diminta.
            if (count($kode) === 2) {
                return Http::response([
                    'code' => '1',
                    'data' => [
                        $this->potonganRespons('JT-LENGKAP-1', [[
                            'scanCode' => 3, 'desc' => 'kabar dari respons gabungan',
                            'scanTime' => '2026-09-28 10:00:00',
                        ]]),
                    ],
                ], 200);
            }

            return Http::response([
                'code' => '1',
                'data' => [
                    $this->potonganRespons('JT-HILANG-1', [[
                        'scanCode' => 3, 'desc' => 'kabar dari panggilan sendiri',
                        'scanTime' => '2026-09-28 12:00:00',
                    ]]),
                ],
            ], 200);
        });

        $this->artisan('shipping:pull-jnt')
            ->expectsOutputToContain('Resi ditarik: 2, gagal: 0')
            ->assertSuccessful();

        $this->assertCount(2, $panggilan, 'satu panggilan gabungan, lalu satu panggilan sendiri');
        $this->assertCount(1, $panggilan[1], 'resi yang tidak disebut ditarik satu per satu');

        $this->assertDatabaseHas('shipping_tracking_events', [
            'waybill_number' => 'JT-LENGKAP-1',
            'description' => 'kabar dari respons gabungan',
        ]);
        $this->assertDatabaseHas('shipping_tracking_events', [
            'waybill_number' => 'JT-HILANG-1',
            'description' => 'kabar dari panggilan sendiri',
        ]);
    }

    public function test_panggilan_gabungan_gagal_tidak_menembak_ulang_per_resi(): void
    {
        $this->nyalakanJnt();
        $this->resi('in_transit', '-1 day', 'JT-MATI-1');
        $this->resi('in_transit', '-1 day', 'JT-MATI-2');

        $panggilan = [];

        Http::fake(function ($request) use (&$panggilan) {
            $panggilan[] = $this->kodeYangDiminta($request->body());

            return Http::response(['code' => '500', 'msg' => 'gateway down'], 500);
        });

        $this->artisan('shipping:pull-jnt')
            ->expectsOutputToContain('Resi ditarik: 0, gagal: 2')
            ->assertSuccessful();

        $this->assertEmpty(
            collect($panggilan)->filter(fn ($kode) => count($kode) === 1)->all(),
            'kurir yang sedang bermasalah tidak boleh ditembak ulang per resi'
        );
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
        $mock->shouldReceive('refreshMany')
            ->once()
            ->andReturn([$rekam->id => null]);
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
        $mock->shouldReceive('refreshMany')
            ->once()
            ->andReturn([$rekam->id => new \RuntimeException('J&T gateway timeout')]);
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
