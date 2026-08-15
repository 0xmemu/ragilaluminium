<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\ShippingTrackingEvent;
use App\Services\ShippingService;
use App\Support\OrderTrackingPresenter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShippingTrackingEventsTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-TRACK-'.uniqid(),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji No. 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => 'processing',
            'payment_status' => 'pending',
            'shipping_status' => 'in_transit',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ], $overrides));
    }

    private function makeRecord(Order $order, string $status = 'in_transit'): ShippingRecord
    {
        return ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'TRACK-'.uniqid(),
            'shipping_cost' => 0,
            'status' => $status,
        ]);
    }

    public function test_tracking_scan_is_stored_once_with_source_and_normalized_status(): void
    {
        $order = $this->makeOrder();
        $record = $this->makeRecord($order);
        $occurredAt = '2026-08-15 10:00:00';

        app(ShippingService::class)->applyCarrierUpdate(
            $record,
            'delivered',
            'Paket diterima',
            null,
            $occurredAt,
            '100',
            'webhook',
        );
        app(ShippingService::class)->applyCarrierUpdate(
            $record,
            'delivered',
            'Paket diterima',
            null,
            $occurredAt,
            '100',
            'webhook',
        );

        $this->assertSame(1, ShippingTrackingEvent::where('shipping_record_id', $record->id)->count());
        $this->assertDatabaseHas('shipping_tracking_events', [
            'shipping_record_id' => $record->id,
            'order_id' => $order->id,
            'source' => 'webhook',
            'provider_status' => 'Paket diterima',
            'normalized_status' => 'delivered',
        ]);
    }

    public function test_unknown_and_stale_scans_are_preserved_without_reopening_shipping_state(): void
    {
        $order = $this->makeOrder();
        $record = $this->makeRecord($order);
        $service = app(ShippingService::class);

        $service->applyCarrierUpdate($record, 'delivered', 'Paket diterima', null, '2026-08-15 10:00:00', '100', 'poll');
        $service->applyCarrierUpdate($record, '3', 'Scan terlambat', null, '2026-08-15 09:00:00', '200', 'poll');
        $service->applyCarrierUpdate($record, 'UNKNOWN_SCAN', 'Status baru carrier', null, '2026-08-15 11:00:00', null, 'webhook');

        $fresh = $record->fresh();
        $this->assertSame('delivered', $fresh->status);
        $this->assertSame('Status baru carrier', $fresh->status_raw);
        $this->assertSame(3, ShippingTrackingEvent::where('shipping_record_id', $record->id)->count());
        $this->assertDatabaseHas('shipping_tracking_events', [
            'shipping_record_id' => $record->id,
            'provider_status' => 'Scan terlambat',
            'normalized_status' => 'in_transit',
            'source' => 'poll',
        ]);
        $this->assertDatabaseHas('shipping_tracking_events', [
            'shipping_record_id' => $record->id,
            'provider_status' => 'Status baru carrier',
            'normalized_status' => null,
            'source' => 'webhook',
        ]);
    }

    public function test_order_tracking_paid_is_strictly_based_on_payment_status(): void
    {
        $order = $this->makeOrder([
            'order_status' => 'completed',
            'shipping_status' => 'delivered',
            'payment_status' => 'pending',
        ]);
        $record = $this->makeRecord($order, 'delivered');

        $this->assertFalse(OrderTrackingPresenter::forOrder($order, $record)['paid']);

        $order->update(['payment_status' => 'paid']);

        $this->assertTrue(OrderTrackingPresenter::forOrder($order->fresh(), $record)['paid']);
    }
}
