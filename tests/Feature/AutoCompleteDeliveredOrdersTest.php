<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Item 1 antrean pekerjaan: pesanan Sampai otomatis menjadi Selesai setelah
 * masa tenggang 72 jam (di atas tenggat retur 48 jam).
 *
 * Kontrak:
 * - Sampai + lunas + lewat 72 jam + tanpa kasus retur open -> Selesai dengan
 *   sumber audit system.
 * - Yang belum lewat tenggang, punya kasus retur open, belum lunas, atau
 *   saat fitur dimatikan: tidak disentuh.
 */
class AutoCompleteDeliveredOrdersTest extends TestCase
{
    use RefreshDatabase;

    private function orderDelivered(string $umur = '-3 days', array $attributes = []): Order
    {
        $order = Order::create(array_merge([
            'order_number' => 'RA-AC-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '081200000123',
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'delivered',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ], $attributes));

        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'JNT',
            'waybill_number' => 'JT-AC-'.random_int(10000, 99999),
            'status' => 'delivered',
            'last_status_at' => now()->modify($umur),
        ]);

        return $order;
    }

    private function jalankan(): void
    {
        Http::fake(['*' => Http::response(['id' => 'WA-AC'], 200)]);
        $this->artisan('orders:auto-complete')->assertSuccessful();
    }

    public function test_pesanan_lewat_masa_tenggang_selesai_otomatis(): void
    {
        $order = $this->orderDelivered('-3 days');

        $this->jalankan();

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'order_status' => 'completed']);
    }

    public function test_belum_lewat_tenggang_tidak_disentuh(): void
    {
        $order = $this->orderDelivered('-1 day');

        $this->jalankan();

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'order_status' => 'delivered']);
    }

    public function test_kasus_retur_open_tidak_disentuh(): void
    {
        $order = $this->orderDelivered('-3 days');
        \App\Models\OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'rusak',
            'reason_detail' => 'uji',
            'fault_party' => 'other',
            'shipping_cost_borne_by_store' => true,
            'customer_notes' => 'uji',
        ]);

        $this->jalankan();

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'order_status' => 'delivered']);
    }

    public function test_belum_lunas_tidak_disentuh(): void
    {
        $order = $this->orderDelivered('-3 days', ['payment_status' => 'pending']);

        $this->jalankan();

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'order_status' => 'delivered']);
    }

    public function test_fitur_dimatikan_tidak_disentuh(): void
    {
        config(['operations.orders_auto_complete.enabled' => false]);
        $order = $this->orderDelivered('-3 days');

        $this->jalankan();

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'order_status' => 'delivered']);
    }
}
