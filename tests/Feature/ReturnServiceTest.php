<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Services\ReturnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ReturnServiceTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RT-'.uniqid(),
            'payment_method' => 'cod',
            'cod_flag' => true,
            'payment_status' => 'pending',
            'order_status' => 'delivered',
            'shipping_status' => 'delivered',
            'total_amount' => 100000,
            'subtotal_amount' => 100000,
            'customer_name' => 'Test',
            'customer_phone' => '0812000000',
            'shipping_name' => 'Test Penerima',
            'shipping_phone' => '0812000000',
            'shipping_address_line1' => 'Jl. Contoh No. 1',
            'shipping_province' => 'DKI Jakarta',
            'shipping_city' => 'Kota Jakarta Barat',
            'shipping_district' => 'Kebon Jeruk',
            'shipping_village' => 'Kebon Jeruk',
            'shipping_postal_code' => '11530',
        ], $overrides));
    }

    private function deliveredRecord(Order $order, ?string $lastStatusAt = null): ShippingRecord
    {
        return ShippingRecord::create([
            'order_id' => $order->id,
            'status' => 'delivered',
            'waybill_number' => 'JTD-'.uniqid(),
            'carrier_name' => 'J&T',
            'last_status_at' => $lastStatusAt ?? now()->subHour()->toDateTimeString(),
        ]);
    }

    public function test_mark_delivered_settles_pending_cod(): void
    {
        $order = $this->makeOrder();
        $svc = app(ReturnService::class);

        $changed = $svc->markDeliveredAndSettleCod($order);

        $this->assertTrue($changed);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_mark_delivered_idempotent_when_already_paid(): void
    {
        $order = $this->makeOrder(['payment_status' => 'paid']);
        $svc = app(ReturnService::class);

        $changed = $svc->markDeliveredAndSettleCod($order);

        $this->assertFalse($changed);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_mark_delivered_does_not_touch_non_cod(): void
    {
        $order = $this->makeOrder([
            'payment_method' => 'transfer',
            'cod_flag' => false,
            'payment_status' => 'pending',
        ]);
        $svc = app(ReturnService::class);

        $changed = $svc->markDeliveredAndSettleCod($order);

        $this->assertFalse($changed);
        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_mark_delivered_does_not_settle_when_not_delivered(): void
    {
        $order = $this->makeOrder(['order_status' => 'shipped', 'shipping_status' => 'in_transit']);
        $svc = app(ReturnService::class);

        $changed = $svc->markDeliveredAndSettleCod($order);

        $this->assertFalse($changed);
        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_can_create_return_within_48h(): void
    {
        $order = $this->makeOrder(['payment_status' => 'paid']);
        $record = $this->deliveredRecord($order, now()->subHour()->toDateTimeString());
        $svc = app(ReturnService::class);

        $result = $svc->canCreateReturn($order, $record, Carbon::now());

        $this->assertTrue($result['allowed']);
        $this->assertArrayHasKey('deadline', $result);
    }

    public function test_can_create_return_blocked_after_48h(): void
    {
        $order = $this->makeOrder();
        $record = $this->deliveredRecord($order, now()->subHours(49)->toDateTimeString());
        $svc = app(ReturnService::class);

        $result = $svc->canCreateReturn($order, $record, Carbon::now());

        $this->assertFalse($result['allowed']);
        $this->assertStringContainsString('48 jam', $result['reason']);
    }

    public function test_can_create_return_blocked_when_not_delivered(): void
    {
        $order = $this->makeOrder(['order_status' => 'completed']);
        $svc = app(ReturnService::class);

        $result = $svc->canCreateReturn($order, null, Carbon::now());

        $this->assertFalse($result['allowed']);
    }

    public function test_can_create_return_blocked_when_not_paid(): void
    {
        $order = $this->makeOrder(['payment_status' => 'pending']);
        $record = $this->deliveredRecord($order, now()->subHour()->toDateTimeString());
        $svc = app(ReturnService::class);

        $result = $svc->canCreateReturn($order, $record, Carbon::now());

        $this->assertFalse($result['allowed']);
        $this->assertStringContainsString('lunas', $result['reason']);
    }

    public function test_validate_reason_requires_detail_for_lainnya(): void
    {
        $svc = app(ReturnService::class);

        $this->assertFalse($svc->validateReason('lainnya', '  ')['valid']);
        $this->assertTrue($svc->validateReason('lainnya', 'warna tidak sesuai')['valid']);
        $this->assertTrue($svc->validateReason('rusak', null)['valid']);
    }

    public function test_default_fault_party_maps_store_reasons(): void
    {
        $svc = app(ReturnService::class);

        $this->assertSame('store', $svc->defaultFaultParty('rusak'));
        $this->assertSame('store', $svc->defaultFaultParty('pecah'));
        $this->assertSame('store', $svc->defaultFaultParty('salah_ukuran'));
        $this->assertSame('store', $svc->defaultFaultParty('salah_produk'));
        $this->assertSame('store', $svc->defaultFaultParty('kurang'));
        $this->assertSame('other', $svc->defaultFaultParty('lainnya'));
    }

    public function test_validate_refund_amount_bounds(): void
    {
        $svc = app(ReturnService::class);

        $this->assertTrue($svc->validateRefundAmount(0, 100000)['valid']);
        $this->assertTrue($svc->validateRefundAmount(100000, 100000)['valid']);
        $this->assertFalse($svc->validateRefundAmount(100001, 100000)['valid']);
        $this->assertFalse($svc->validateRefundAmount(-1, 100000)['valid']);
        $this->assertFalse($svc->validateRefundAmount('abc', 100000)['valid']);
    }

    public function test_validate_replacement_items_requires_product_and_quantity(): void
    {
        $svc = app(ReturnService::class);

        $this->assertTrue($svc->validateReplacementItems([
            ['replacement_product_id' => 5, 'replacement_variant_id' => 9, 'replacement_quantity' => 1],
        ])['valid']);

        $this->assertFalse($svc->validateReplacementItems([
            ['replacement_product_id' => null, 'replacement_quantity' => 1],
        ])['valid']);

        $this->assertFalse($svc->validateReplacementItems([
            ['replacement_product_id' => 5, 'replacement_quantity' => 0],
        ])['valid']);
    }
}