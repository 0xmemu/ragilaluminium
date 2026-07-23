<?php

namespace Tests\Feature;

use App\Events\ShippingStatusUpdated;
use App\Models\Order;
use App\Models\ShippingRecord;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

class ShippingStatusTest extends \Tests\TestCase
{
    use RefreshDatabase;

    protected function makeOrder(): Order
    {
        return Order::create([
            'order_number' => 'RA-TEST-1', 'customer_name' => 'Budi', 'customer_phone' => '628123',
            'shipping_address_line1' => 'Jl A', 'shipping_city' => 'Jakarta', 'shipping_province' => 'DKI',
            'shipping_postal_code' => '12345', 'order_status' => 'processing', 'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup', 'subtotal_amount' => 100000, 'total_amount' => 100000,
            'payment_method' => 'transfer',
        ]);
    }

    public function test_delivered_status_cascades_to_order_and_fires_event(): void
    {
        Event::fake([ShippingStatusUpdated::class]);

        $order = $this->makeOrder();
        $record = ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'J&T Cargo', 'waybill_number' => 'JT123',
            'shipping_cost' => 0, 'status' => 'in_transit',
        ]);

        app(ShippingService::class)->applyCarrierUpdate($record, 'delivered', 'Paket diterima');

        $this->assertEquals('delivered', $record->fresh()->status);
        $this->assertEquals('delivered', $order->fresh()->order_status);
        $this->assertEquals('delivered', $order->fresh()->shipping_status);
        Event::assertDispatched(ShippingStatusUpdated::class);
    }

    public function test_returned_status_is_supported_and_cascades(): void
    {
        $order = $this->makeOrder();
        $record = ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'J&T Cargo', 'waybill_number' => 'JT124',
            'shipping_cost' => 0, 'status' => 'in_transit',
        ]);

        app(ShippingService::class)->applyCarrierUpdate($record, 'returned', 'Retur');

        $this->assertEquals('returned', $record->fresh()->status);
        $this->assertEquals('returned', $order->fresh()->shipping_status);
        $this->assertEquals('return_in_process', $order->fresh()->order_status);
    }

    public function test_unknown_status_does_not_cascade(): void
    {
        $order = $this->makeOrder();
        $record = ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'J&T Cargo', 'waybill_number' => 'JT125',
            'shipping_cost' => 0, 'status' => 'in_transit',
        ]);

        app(ShippingService::class)->applyCarrierUpdate($record, 'SOME_RANDOM_CODE', 'raw');

        $this->assertEquals('in_transit', $record->fresh()->status);
        $this->assertEquals('raw', $record->fresh()->status_raw);
    }

    public function test_webhook_applies_update_when_jnt_disabled(): void
    {
        config(['jnt.enabled' => false]);
        $order = $this->makeOrder();
        ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'J&T Cargo', 'waybill_number' => 'JT200',
            'shipping_cost' => 0, 'status' => 'pending_pickup',
        ]);

        $this->postJson('/webhook/shipping/jnt', [
            'bizContent' => json_encode([
                'billCode' => 'JT200',
                'details' => [
                    ['scanType' => '10', 'scanTypeCode' => '100', 'desc' => 'Paket diterima', 'scanTime' => '2026-01-01 10:00:00'],
                ],
            ]),
        ])->assertOk();

        $this->assertEquals('delivered', $order->fresh()->order_status);
    }
}
