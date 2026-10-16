<?php

namespace Tests\Feature;

use App\Events\AdminShippingStatusUpdated;
use App\Models\AdminNotification;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ShippingRecord;
use App\Services\AdminDataVersion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Penanda versi data panel admin (Tahap 2 live events, 16 Okt 2026).
 *
 * Penjaga ini mengunci tiga hal yang mudah rusak tanpa disadari:
 * 1. Penanda NAIK saat model yang tampil di panel berubah, dan tidak naik saat
 *    tidak ada perubahan. Kalau rusak, panel berhenti memuat ulang dirinya.
 * 2. Penanda TIDAK PERNAH melempar. Kalau melempar, penyimpanan data pelanggan
 *    ikut gagal karena penanda versi bukan data pelanggan.
 * 3. Daftar model yang diamati tetap lengkap. Model baru yang tampil di panel
 *    wajib ditambahkan; tes ini mengunci daftarnya supaya tidak diam-diam
 *    tertinggal.
 */
class AdminDataVersionTest extends TestCase
{
    use RefreshDatabase;

    private function buatOrder(): Order
    {
        return Order::create([
            'order_number' => 'ADV-'.strtoupper(uniqid()),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => 'processing',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 10000,
            'discount_amount' => 0,
            'total_amount' => 110000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    public function test_penanda_naik_saat_order_baru_disimpan(): void
    {
        $versi = app(AdminDataVersion::class);
        $sebelum = $versi->current();

        $this->buatOrder();

        $this->assertNotSame($sebelum, $versi->current(), 'Penanda wajib berubah saat ada pesanan baru');
    }

    public function test_penanda_naik_saat_notifikasi_admin_disimpan(): void
    {
        $versi = app(AdminDataVersion::class);
        $sebelum = $versi->current();

        AdminNotification::create([
            'type' => 'system',
            'title' => 'Uji',
            'body' => 'Uji penanda',
        ]);

        $this->assertNotSame($sebelum, $versi->current());
    }

    public function test_penanda_tidak_naik_tanpa_perubahan(): void
    {
        $versi = app(AdminDataVersion::class);
        $sebelum = $versi->current();

        // Beberapa pembacaan berturut-turut tidak boleh mengubah nilainya.
        $versi->current();
        $versi->current();

        $this->assertSame($sebelum, $versi->current());
    }

    public function test_penanda_selalu_berupa_string(): void
    {
        $nilai = app(AdminDataVersion::class)->current();

        $this->assertIsString($nilai);
        $this->assertNotSame('', $nilai);
    }

    /**
     * Bila Redis bermasalah, penanda versi TIDAK boleh menggagalkan penyimpanan
     * data pelanggan. Pengamat menelan galat dengan sengaja.
     */
    public function test_penanda_tidak_melempar_saat_cache_bermasalah(): void
    {
        Cache::shouldReceive('get')->andThrow(new \RuntimeException('redis mati'));
        Cache::shouldReceive('forever')->andThrow(new \RuntimeException('redis mati'));
        Cache::shouldReceive('increment')->andThrow(new \RuntimeException('redis mati'));

        $order = $this->buatOrder();

        $this->assertNotNull($order->id, 'Pesanan tetap tersimpan walau penanda versi gagal');
    }

    /**
     * Daftar model yang diamati dikunci di sini. Model baru yang tampil di panel
     * wajib ditambahkan ke AppServiceProvider; kalau tidak, panel berhenti
     * memuat ulang saat model itu berubah.
     */
    public function test_daftar_model_yang_diamati_lengkap(): void
    {
        $wajib = [
            \App\Models\Order::class,
            \App\Models\Payment::class,
            \App\Models\WhatsAppMessage::class,
            \App\Models\MediaAsset::class,
            \App\Models\ImportJob::class,
            \App\Models\OrderReturnCase::class,
            \App\Models\CmsTestimonial::class,
            \App\Models\CmsBanner::class,
            \App\Models\Announcement::class,
            \App\Models\StoreVoucher::class,
            \App\Models\Promotion::class,
            \App\Models\ShippingRecord::class,
            \App\Models\AdminNotification::class,
        ];

        foreach ($wajib as $model) {
            $this->assertTrue(
                $model::getEventDispatcher() !== null,
                $model.' wajib punya event dispatcher supaya pengamat terpasang'
            );

            $punya = false;
            foreach ($model::getEventDispatcher()->getListeners('eloquent.saved: '.$model) as $listener) {
                $punya = true;
                break;
            }

            $this->assertTrue($punya, 'Pengamat penanda versi belum terpasang pada '.$model);
        }
    }

    /**
     * Endpoint polling tetap mengembalikan data_version berbentuk string.
     * Kontrak ini dipakai klien untuk memutuskan memuat ulang.
     */
    public function test_endpoint_poll_mengembalikan_data_version_string(): void
    {
        $admin = \App\Models\User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $res = $this->actingAs($admin)->getJson(route('admin.notifications.poll'));

        $res->assertOk();
        $this->assertIsString($res->json('data_version'));
    }

    /**
     * Event resi untuk panel wajib TIDAK membawa data pelanggan.
     */
    public function test_event_resi_panel_tidak_membawa_data_pelanggan(): void
    {
        $order = $this->buatOrder();
        $record = new ShippingRecord([
            'order_id' => $order->id,
            'waybill_number' => 'WB-1',
            'provider' => 'jnt',
            'status' => 'in_transit',
        ]);
        $record->order_id = $order->id;

        $event = new AdminShippingStatusUpdated($order, $record, 'pending_pickup', 'in_transit');
        $json = json_encode(get_object_vars($event));

        $this->assertStringNotContainsString('Budi', (string) $json);
        $this->assertStringNotContainsString('628123456789', (string) $json);
        $this->assertStringNotContainsString('Jl. Uji', (string) $json);
        $this->assertSame('shipping.updated', $event->broadcastAs());
        $this->assertSame('broadcast', $event->broadcastQueue());
        $this->assertSame('private-admin.operations', $event->broadcastOn()[0]->name);
    }
}
