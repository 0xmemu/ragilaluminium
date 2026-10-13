<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\ShippingTrackingEvent;
use App\Support\OrderTrackingPresenter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fase 8 - Aturan 5 & 7.
 *
 * 7: status tracking + status order disatukan dalam satu timeline.
 * 5: tracking tetap tampil walau resi (waybill) belum diinput admin.
 */
class OrderTrackingTimelineTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'ORD-TIMELINE-'.uniqid(),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji No. 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40132',
            'order_status' => 'shipped',
            'payment_status' => 'paid',
            'shipping_status' => 'in_transit',
            'subtotal_amount' => 100000,
            'shipping_amount' => 19000,
            'discount_amount' => 0,
            'total_amount' => 119000,
            'payment_method' => 'transfer',
        ], $overrides));
    }

    public function test_order_status_and_carrier_tracking_are_unified_in_one_timeline(): void
    {
        $order = $this->makeOrder();
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-TL-1',
            'shipping_cost' => 19000,
            'status' => 'in_transit',
        ]);

        // Event pesanan (order status diproses -> dikirim).
        EventLog::create([
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => ['order_status' => 'shipped'],
            'created_at' => '2026-08-16 08:00:00',
        ]);

        // Event tracking kurir (scan gudang/transit) - terjadi belakangan.
        ShippingTrackingEvent::create([
            'shipping_record_id' => $record->id,
            'order_id' => $order->id,
            'event_hash' => 'evt-tl-'.uniqid(),
            'provider' => 'jnt',
            'waybill_number' => $record->waybill_number,
            'provider_status' => 'Paket dalam perjalanan',
            'normalized_status' => 'in_transit',
            'source' => 'webhook',
            'description' => 'Paket dalam perjalanan',
            'occurred_at' => '2026-08-17 10:00:00',
        ]);

        $tracking = OrderTrackingPresenter::forOrder($order->fresh(), $record->fresh());

        $sourceSet = collect($tracking['timeline'])->pluck('source')->values()->all();
        $this->assertContains('order_status_changed', $sourceSet, 'timeline harus memuat event status order');
        $this->assertContains('tracking:webhook', $sourceSet, 'timeline harus memuat event tracking kurir');

        // Satu timeline, terurut menurun oleh waktu: scan terbaru di atas.
        $this->assertSame('tracking:webhook', $tracking['timeline'][0]['source']);
        $this->assertSame('Paket dalam perjalanan', $tracking['timeline'][0]['message']);
        $this->assertSame('order_status_changed', $tracking['timeline'][1]['source']);
        $this->assertSame('Pesanan sedang dikirim oleh ekspedisi.', $tracking['timeline'][1]['message']);
    }

    public function test_tracking_timeline_still_present_when_no_waybill_input_yet(): void
    {
        // Pesanan baru yang masih diproses; belum ada resi / shipping record.
        $order = $this->makeOrder([
            'order_status' => 'processing',
            'shipping_status' => 'pending_pickup',
        ]);

        $tracking = OrderTrackingPresenter::forOrder($order->fresh());

        $this->assertNull($tracking['waybill_number']);
        $this->assertNotEmpty($tracking['timeline'], 'timeline tetap tampil walau resi belum diinput');

        $messages = collect($tracking['timeline'])->pluck('message')->values()->all();
        $this->assertContains('Pesanan sedang diproses oleh admin gudang.', $messages);
    }

    public function test_milestones_share_single_timeline_payload_consumed_by_tracking_page(): void
    {
        $order = $this->makeOrder();

        EventLog::create([
            'event_type' => 'shipping.created',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => ['waybill' => 'JT-TL-2', 'source' => 'manual'],
            'created_at' => '2026-08-16 09:00:00',
        ]);

        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-TL-2',
            'shipping_cost' => 19000,
            'status' => 'in_transit',
        ]);

        $tracking = OrderTrackingPresenter::forOrder($order->fresh(), $record->fresh());
        $timeline = $tracking['timeline'];

        $this->assertSame('JT-TL-2', $tracking['waybill_number']);
        $this->assertStringContainsString('shipping.created', implode(',', collect($timeline)->pluck('source')->all()));

        // latest_message diambil dari entri timeline paling atas.
        $this->assertSame($timeline[0]['message'], $tracking['latest_message']);
    }
}
