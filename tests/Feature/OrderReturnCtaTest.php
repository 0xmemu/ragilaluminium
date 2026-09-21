<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Phase D — Tracking normalization, delivered confirmation & return CTA.
 */
class OrderReturnCtaTest extends TestCase
{
    use RefreshDatabase;

    protected function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-RC-1',
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_district' => 'Menteng',
            'shipping_postal_code' => '10310',
            'order_status' => 'delivered',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'payment_method' => 'transfer',
            'cod_flag' => false,
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
        ], $overrides));
    }

    private function deliveredRecord(Order $order, int $hoursAgo = 1): ShippingRecord
    {
        return ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-RC-1',
            'status' => 'delivered',
            'status_raw' => 'RAW-DELIVERED-INTERNAL',
            'last_status_at' => now()->subHours($hoursAgo),
        ]);
    }

    public function test_delivered_paid_within_window_returns_eligible_block_and_cta(): void
    {
        $order = $this->makeOrder();
        $this->deliveredRecord($order, 5);

        $this->post('/order/status', [
            'order_number' => 'RA-RC-1',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.order_number', 'RA-RC-1')
            ->where('order.return_block.eligible', true)
            ->where('order.delivered_at', fn ($v) => is_string($v) && $v !== '')
            ->where('order.return_whatsapp_url', fn ($url) => is_string($url) && str_contains($url, 'wa.me/'))
            ->where('order.return_block.deadline', fn ($d) => is_string($d) && $d !== ''));
    }

    /**
     * Skema retur full manual (2026-09-21): pesanan Sampai yang belum lunas tetap
     * boleh mengajukan pengembalian lewat WhatsApp; status lunasnya muncul sebagai
     * peringatan, bukan penolakan. Teks peringatan tidak boleh membocorkan catatan
     * internal.
     */
    public function test_delivered_unpaid_still_eligible_with_safe_warning(): void
    {
        $order = $this->makeOrder(['payment_status' => 'pending']);
        $this->deliveredRecord($order, 5);

        $this->post('/order/status', [
            'order_number' => 'RA-RC-1',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.return_block.eligible', true)
            ->where('order.return_block.warnings', fn ($w) => str_contains($w->implode(' '), 'lunas')));
    }

    public function test_delivered_past_window_still_eligible_with_safe_warning(): void
    {
        // Halaman status menyegarkan pengiriman dari J&T saat dibuka, dan
        // penyegaran itu menulis ulang waktu sampai menjadi "sekarang". Bila
        // dibiarkan, batas 48 jam tidak akan pernah terlihat lewat karena selalu
        // dihitung dari waktu yang baru saja ditimpa. Penyegarannya dimatikan
        // supaya test ini menguji aturan retur, bukan perilaku penyegaran.
        $this->partialMock(\App\Services\ShippingService::class, function ($mock) {
            $mock->shouldReceive('refreshStatus')->andReturn(null);
        });

        $order = $this->makeOrder();
        $this->deliveredRecord($order, 60); // > 48 jam

        $this->post('/order/status', [
            'order_number' => 'RA-RC-1',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.return_block.eligible', true)
            ->where('order.return_block.warnings', fn ($w) => str_contains($w->implode(' '), '48 jam'))
            ->where('order.return_block.warnings', fn ($w) => ! str_contains($w->implode(' '), 'RAW-')
                && ! str_contains($w->implode(' '), 'internal')));
    }

    /**
     * Tombol pengajuan pengembalian hanya boleh muncul di status Sampai. Setelah
     * admin mencatat returnya, pelanggan tidak lagi ditawari mengajukan hal yang
     * sama dua kali.
     */
    public function test_return_request_not_offered_once_order_is_in_return(): void
    {
        $order = $this->makeOrder([
            'order_number' => 'RA-RC-4',
            'order_status' => 'return_in_process',
        ]);
        $this->deliveredRecord($order, 5);

        $this->post('/order/status', [
            'order_number' => 'RA-RC-4',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.return_block.eligible', false));
    }

    /**
     * Badge pelanggan membaca vm.primaryStatus.key. Kunci `refunded` membuat retur
     * yang sudah selesai tampil sebagai "Dikembalikan", jadi kuncinya dikunci ke
     * `return_completed` di sini.
     */
    public function test_return_completed_primary_key_is_return_completed(): void
    {
        $order = $this->makeOrder([
            'order_number' => 'RA-RC-5',
            'order_status' => 'return_completed',
        ]);

        $vm = new \App\Support\OrderTrackingViewModel($order, null);

        $this->assertSame('return_completed', $vm->primaryStatus()['key']);
        $this->assertSame('Retur selesai', $vm->primaryStatus()['label']);
    }

    /**
     * Alur retur menggantikan stepper pengiriman 4 tahap: tahap "Selesai" tidak
     * pernah tercapai pada pesanan yang diretur, jadi menampilkannya menyesatkan.
     */
    public function test_return_order_shows_return_flow_instead_of_shipping_steps(): void
    {
        $order = $this->makeOrder([
            'order_number' => 'RA-RC-6',
            'order_status' => 'return_in_process',
        ]);

        $vm = new \App\Support\OrderTrackingViewModel($order, null);
        $keys = array_column($vm->summary()['steps'], 'key');

        $this->assertSame(['return_recorded', 'return_handling', 'return_finished'], $keys);
        $this->assertNotNull($vm->returnFlow());
        $this->assertSame('return_recorded', $vm->returnFlow()['steps'][0]['key']);
    }

    public function test_normal_delivered_order_keeps_four_macro_steps_and_no_return_flow(): void
    {
        $order = $this->makeOrder(['order_number' => 'RA-RC-7']);
        $this->deliveredRecord($order, 5);

        $vm = new \App\Support\OrderTrackingViewModel($order, $order->shippingRecords->first());
        $keys = array_column($vm->summary()['steps'], 'key');

        $this->assertSame(['confirmation', 'fulfillment', 'shipping', 'completion'], $keys);
        $this->assertNull($vm->returnFlow());
    }

    public function test_primary_status_payload_present_for_all_states(): void
    {
        // Phase E: StatusNotice (headline+message+tone) harus tersedia utk setiap
        // status agar hierarchy/a11y kontrak A2 terpenuhi.
        foreach (['awaiting_confirmation', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'issue', 'return_in_process', 'return_completed'] as $state) {
            $order = $this->makeOrder([
                'order_number' => 'RA-RC-'.strtoupper(str_replace('_', '', $state)),
                'order_status' => $state,
            ]);

            $vm = new \App\Support\OrderTrackingViewModel($order, $order->shippingRecords->first());
            $primary = $vm->primaryStatus();

            $this->assertNotSame('', $primary['headline'], "headline kosong utk {$state}");
            $this->assertNotSame('', $primary['message'], "message kosong utk {$state}");
            $this->assertContains($primary['tone'], ['success', 'danger', 'warning', 'neutral', 'info'], "tone tak dikenal utk {$state}");
        }
    }

    public function test_completed_order_has_no_return_block_and_copy_says_finished(): void
    {
        $order = $this->makeOrder([
            'order_number' => 'RA-RC-2',
            'order_status' => 'completed',
            'shipping_status' => 'delivered',
        ]);
        $this->deliveredRecord($order, 100);

        $this->post('/order/status', [
            'order_number' => 'RA-RC-2',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.order_status', 'completed')
            ->where('order.return_block.eligible', false)
            // Copy Phase A2: selesai, tidak ada retur baru.
            ->where('order.vm.primaryStatus.key', 'completed')
            ->where('order.vm.primaryStatus.message', fn ($m) => is_string($m) && str_contains($m, 'Retur baru tidak tersedia')));
    }

    public function test_tracking_public_never_leaks_raw_provider_text(): void
    {
        $order = $this->makeOrder([
            'order_number' => 'RA-RC-3',
            'order_status' => 'processing',
        ]);
        // Pastikan order ini memang bukan delivered agar tidak terpengaruh kartu retur.
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-RC-3',
            'status' => 'in_transit',
            'status_raw' => 'RAW-PROVIDER-CODE-XYZ',
            'last_status_at' => now()->subHour(),
        ]);

        $this->post('/order/status', [
            'order_number' => 'RA-RC-3',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.order_number', 'RA-RC-3'));

        // via API: tracking_public timeline bebas raw
        $res = $this->getJson('/api/orders/RA-RC-3/status?customer_phone=08123456789')->assertOk()->json();
        foreach (($res['tracking_public']['timeline'] ?? []) as $entry) {
            $this->assertStringNotContainsString('RAW-PROVIDER-CODE-XYZ', $entry['message'] ?? '');
        }
    }
}