<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
use App\Models\Order;
use App\Models\ShippingRecord;
use App\Services\Shipping\JntCargoClient;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class PollJntTrackingCommandTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(string $orderStatus = 'shipped'): Order
    {
        return Order::create([
            'order_number' => 'POLL-'.strtoupper(uniqid()),
            'customer_name' => 'Budi Polling',
            'customer_phone' => '628111222333',
            'shipping_address_line1' => 'Jl. Anggrek',
            'shipping_city' => 'Surabaya',
            'shipping_province' => 'Jawa Timur',
            'shipping_postal_code' => '60111',
            'order_status' => $orderStatus,
            'payment_status' => 'paid',
            'shipping_status' => 'in_transit',
            'subtotal_amount' => 100000,
            'shipping_amount' => 10000,
            'discount_amount' => 0,
            'total_amount' => 110000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    public function test_command_detects_active_shipments_needing_refresh(): void
    {
        $order = $this->makeOrder('shipped');
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-ACTIVE-001',
            'status' => 'in_transit',
            'next_poll_at' => now()->subMinutes(10),
        ]);

        $this->artisan('shipping:poll-jnt', ['--dry-run' => true])
            ->expectsOutputToContain('Menemukan 1 resi aktif untuk diperiksa')
            ->assertSuccessful();
    }

    public function test_command_excludes_delivered_completed_and_cancelled_orders(): void
    {
        // 1. Order delivered
        $orderDelivered = $this->makeOrder('delivered');
        ShippingRecord::create([
            'order_id' => $orderDelivered->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-DEL-001',
            'status' => 'delivered',
            'next_poll_at' => now()->subMinutes(10),
        ]);

        // 2. Order completed
        $orderCompleted = $this->makeOrder('completed');
        ShippingRecord::create([
            'order_id' => $orderCompleted->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-COMP-001',
            'status' => 'delivered',
            'next_poll_at' => now()->subMinutes(10),
        ]);

        // 3. Order cancelled
        $orderCancelled = $this->makeOrder('cancelled');
        ShippingRecord::create([
            'order_id' => $orderCancelled->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-CANC-001',
            'status' => 'cancelled',
            'next_poll_at' => now()->subMinutes(10),
        ]);

        $this->artisan('shipping:poll-jnt', ['--dry-run' => true])
            ->expectsOutput('Tidak ada resi aktif yang perlu diperiksa.')
            ->assertSuccessful();
    }

    public function test_command_skips_shipments_whose_next_poll_is_in_the_future(): void
    {
        $order = $this->makeOrder('shipped');
        // Dijadwalkan baru di-poll 20 menit ke depan
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-FUTURE-001',
            'status' => 'in_transit',
            'next_poll_at' => now()->addMinutes(20),
        ]);

        $this->artisan('shipping:poll-jnt', ['--dry-run' => true])
            ->expectsOutput('Tidak ada resi aktif yang perlu diperiksa.')
            ->assertSuccessful();
    }

    public function test_command_executes_refresh_safely_and_reschedules(): void
    {
        $order = $this->makeOrder('shipped');
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-CALL-001',
            'status' => 'in_transit',
            'next_poll_at' => now()->subMinutes(5),
            'poll_attempts' => 2,
        ]);

        $mockClient = Mockery::mock(JntCargoClient::class);
        $mockClient->shouldReceive('isEnabled')->andReturn(true);
        $this->app->instance(JntCargoClient::class, $mockClient);

        $mockShipping = Mockery::mock(ShippingService::class);
        $mockShipping->shouldReceive('refreshStatus')
            ->once()
            ->with(Mockery::on(fn ($r) => $r->id === $record->id));
        $this->app->instance(ShippingService::class, $mockShipping);

        $this->artisan('shipping:poll-jnt')
            ->expectsOutputToContain('Menemukan 1 resi aktif')
            ->expectsOutputToContain('Sukses diperiksa: 1')
            ->assertSuccessful();

        $record->refresh();
        $this->assertSame(0, $record->poll_attempts, 'poll_attempts direset ke 0');
        $this->assertNotNull($record->last_polled_at);
        $this->assertNotNull($record->next_poll_at);
        $this->assertTrue($record->next_poll_at->isFuture(), 'next_poll_at dijadwalkan di masa depan');
    }

    public function test_command_handles_api_failure_with_backoff_and_admin_notification(): void
    {
        $order = $this->makeOrder('shipped');
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-FAIL-001',
            'status' => 'in_transit',
            'next_poll_at' => now()->subMinutes(5),
            'poll_attempts' => 4, // Percobaan ke-4, kegagalan ini akan menjadi ke-5 -> trigger alert
        ]);

        $mockClient = Mockery::mock(JntCargoClient::class);
        $mockClient->shouldReceive('isEnabled')->andReturn(true);
        $this->app->instance(JntCargoClient::class, $mockClient);

        $mockShipping = Mockery::mock(ShippingService::class);
        $mockShipping->shouldReceive('refreshStatus')
            ->once()
            ->andThrow(new \RuntimeException('Connection timed out to J&T gateway'));
        $this->app->instance(ShippingService::class, $mockShipping);

        $this->artisan('shipping:poll-jnt')
            ->expectsOutputToContain('Gagal: 1')
            ->assertSuccessful();

        $record->refresh();
        $order->refresh();

        // 1. Status order & shipping TIDAK boleh berubah saat API error
        $this->assertSame('shipped', $order->order_status);
        $this->assertSame('in_transit', $record->status);

        // 2. Metadata polling mencatat kegagalan & backoff
        $this->assertSame(5, $record->poll_attempts);
        $this->assertStringContainsString('Connection timed out', (string) $record->last_poll_error);
        $this->assertTrue($record->next_poll_at->isFuture());

        // 3. Notifikasi admin dibuat tepat 1 kali
        $notifs = AdminNotification::where('type', 'shipping_poll_failed')
            ->where('related_id', $record->id)
            ->get();
        $this->assertCount(1, $notifs);
        $this->assertStringContainsString($record->waybill_number, $notifs->first()->title);
    }
}
