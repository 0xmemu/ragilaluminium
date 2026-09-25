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

    public function test_webhook_applies_signed_update_when_jnt_disabled(): void
    {
        config([
            'jnt.enabled' => false,
            'jnt.webhook.private_key' => 'webhook-secret',
        ]);
        $order = $this->makeOrder();
        ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'J&T Cargo', 'waybill_number' => 'JT200',
            'shipping_cost' => 0, 'status' => 'pending_pickup',
        ]);

        $bizContent = json_encode([
            'billCode' => 'JT200',
            'details' => [
                ['scanType' => '10', 'scanTypeCode' => '100', 'desc' => 'Paket diterima', 'scanTime' => '2026-01-01 10:00:00'],
            ],
        ]);
        $digest = base64_encode(md5($bizContent.'webhook-secret', true));

        $this->withHeader('digest', $digest)
            ->post('/webhook/shipping/jnt', ['bizContent' => $bizContent])
            ->assertOk()
            ->assertJsonPath('code', config('jnt.ack.code'));

        $this->assertEquals('delivered', $order->fresh()->order_status);
    }

    public function test_webhook_rejects_request_when_signing_key_is_missing(): void
    {
        config(['jnt.webhook.private_key' => null]);

        // Middleware verify.jnt.signature: tanpa signature -> 401 (sebelumnya ack 200).
        $this->post('/webhook/shipping/jnt', ['bizContent' => '{}'])
            ->assertStatus(401);
    }

    public function test_duplicate_returned_update_is_idempotent_and_creates_single_return_case(): void
    {
        $order = $this->makeOrder();
        $record = ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'J&T Cargo', 'waybill_number' => 'JT124-DUP',
            'shipping_cost' => 0, 'status' => 'in_transit',
        ]);
        $service = app(ShippingService::class);
        $service->applyCarrierUpdate($record, 'returned', 'Retur 1');
        $service->applyCarrierUpdate($record, 'returned', 'Retur 2');

        $this->assertEquals('returned', $record->fresh()->status);
        $this->assertEquals('return_in_process', $order->fresh()->order_status);
        $this->assertEquals(1, \App\Models\OrderReturnCase::where('order_id', $order->id)->count());
    }

    public function test_carrier_update_cannot_reopen_return_completed_order(): void
    {
        $order = $this->makeOrder();
        $order->update(['order_status' => 'return_completed']);
        $record = ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'J&T Cargo', 'waybill_number' => 'JT124-TERM',
            'shipping_cost' => 0, 'status' => 'in_transit',
        ]);
        app(ShippingService::class)->applyCarrierUpdate($record, 'returned', 'Retur terlambat');

        $this->assertEquals('return_completed', $order->fresh()->order_status);
    }

    public function test_carrier_update_delivered_after_returned_is_ignored_as_regression(): void
    {
        $order = $this->makeOrder();
        $record = ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'J&T Cargo', 'waybill_number' => 'JT124-REG',
            'shipping_cost' => 0, 'status' => 'returned', 'last_status_at' => now()->subMinute(),
        ]);
        app(ShippingService::class)->applyCarrierUpdate($record, 'delivered', 'Salah urutan scan', null, now());

        $this->assertEquals('returned', $record->fresh()->status);
    }
}
