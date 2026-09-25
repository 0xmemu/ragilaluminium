<?php

namespace Tests\Feature;

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
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-ACTIVE-001',
            'status' => 'in_transit',
            'last_status_at' => now()->subHours(2),
        ]);
        \Illuminate\Support\Facades\DB::table('shipping_records')
            ->where('id', $record->id)
            ->update(['updated_at' => now()->subHours(2)]);

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
            'updated_at' => now()->subHours(2),
        ]);

        // 2. Order completed
        $orderCompleted = $this->makeOrder('completed');
        ShippingRecord::create([
            'order_id' => $orderCompleted->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-COMP-001',
            'status' => 'delivered',
            'updated_at' => now()->subHours(2),
        ]);

        // 3. Order cancelled
        $orderCancelled = $this->makeOrder('cancelled');
        ShippingRecord::create([
            'order_id' => $orderCancelled->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-CANC-001',
            'status' => 'cancelled',
            'updated_at' => now()->subHours(2),
        ]);

        $this->artisan('shipping:poll-jnt', ['--dry-run' => true])
            ->expectsOutput('Tidak ada resi aktif yang perlu diperiksa.')
            ->assertSuccessful();
    }

    public function test_command_skips_recently_checked_shipments_within_throttle_window(): void
    {
        $order = $this->makeOrder('shipped');
        // Baru saja di-update 5 menit yang lalu (di bawah throttle 30 menit)
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-THROTTLE-001',
            'status' => 'in_transit',
            'last_status_at' => now()->subMinutes(5),
            'updated_at' => now()->subMinutes(5),
        ]);

        $this->artisan('shipping:poll-jnt', ['--throttle' => 30, '--dry-run' => true])
            ->expectsOutput('Tidak ada resi aktif yang perlu diperiksa.')
            ->assertSuccessful();
    }

    public function test_command_executes_refresh_safely_when_client_enabled(): void
    {
        $order = $this->makeOrder('shipped');
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-CALL-001',
            'status' => 'in_transit',
            'last_status_at' => now()->subHours(1),
        ]);
        \Illuminate\Support\Facades\DB::table('shipping_records')
            ->where('id', $record->id)
            ->update(['updated_at' => now()->subHours(1)]);

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
    }

    public function test_command_warns_and_exits_cleanly_when_client_disabled(): void
    {
        $order = $this->makeOrder('shipped');
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-DIS-001',
            'status' => 'in_transit',
        ]);
        \Illuminate\Support\Facades\DB::table('shipping_records')
            ->where('id', $record->id)
            ->update(['updated_at' => now()->subHours(1)]);

        $mockClient = \Mockery::mock(JntCargoClient::class);
        $mockClient->shouldReceive('isEnabled')->andReturn(false);
        $this->app->instance(JntCargoClient::class, $mockClient);

        $this->artisan('shipping:poll-jnt')
            ->expectsOutputToContain('Integrasi J&T Cargo tidak aktif')
            ->assertSuccessful();
    }
}
