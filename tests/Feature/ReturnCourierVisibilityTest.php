<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\User;
use App\Models\WhatsAppMessage;
use App\Services\ReturnService;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Item 4 antrean pekerjaan: retur dari kurir tidak boleh terlihat nol bagi
 * admin, dan pesanan di luar Sampai tetap menampilkan alasan returnya.
 *
 * Kontrak:
 * - openRefusedReturnCase mengumumkan diri lewat OrderReturnCreated sehingga
 *   notifikasi return_created tercipta (idempoten per kasus).
 * - Kasus retur pasca-diterima tidak menyebut "sebelum diterima pembeli".
 * - Transisi kurir yang ditolak memunculkan notifikasi sekali per pesanan.
 */
class ReturnCourierVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function order(array $attributes = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-IT4-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '081200000123',
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'shipped',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ], $attributes));
    }

    public function test_kasus_otomatis_mengumumkan_diri_ke_notifikasi_admin(): void
    {
        $order = $this->order();

        $terbentuk = app(ReturnService::class)->openRefusedReturnCase($order);

        $this->assertTrue($terbentuk);
        $this->assertDatabaseHas('admin_notifications', [
            'type' => 'return_created',
            'order_id' => $order->id,
        ]);
    }

    public function test_kasus_pasca_diterima_tidak_menyebut_sebelum_diterima(): void
    {
        // Jaring pengaman: bila alur manapun mencoba mengirim WA, dipalsukan.
        Http::fake(['*' => Http::response(['id' => 'WA-X'], 200)]);

        $order = $this->order([
            'order_status' => 'delivered',
            'payment_status' => 'paid',
        ]);
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'JNT',
            'waybill_number' => 'JT-TEST-1',
            'status' => 'delivered',
        ]);

        $terbentuk = app(ReturnService::class)->openRefusedReturnCase($order->fresh());

        $this->assertTrue($terbentuk);
        $kasus = $order->returnCases()->first();
        $this->assertStringContainsString('setelah sempat diterima pembeli', (string) $kasus->reason_detail);
        $this->assertStringNotContainsString('sebelum diterima', (string) $kasus->reason_detail);
    }

    public function test_transisi_ditolak_memberi_notifikasi_sekali(): void
    {
        $order = $this->order(['order_status' => 'cancelled']);
        $svc = app(ShippingService::class);

        $svc->notifyCarrierReturnRejected($order, 'return_in_process');
        $svc->notifyCarrierReturnRejected($order, 'return_in_process');

        $jumlah = \App\Models\AdminNotification::query()
            ->where('type', 'carrier_return_rejected')
            ->where('order_id', $order->id)
            ->count();
        $this->assertSame(1, $jumlah);
    }
}
