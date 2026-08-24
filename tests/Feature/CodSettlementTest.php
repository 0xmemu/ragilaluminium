<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Services\PaymentService;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * P0 Task 3 — COD Settlement Contract.
 *
 * Kontrak final: COD lunas saat order COMPLETED (PaymentService::
 * completeCodAtCompletion). Jalur legacy paid-saat-delivered dihapus dari
 * ShippingService cascade.
 */
class CodSettlementTest extends TestCase
{
    use RefreshDatabase;

    protected function makeCodOrder(string $number, string $orderStatus = 'delivered'): Order
    {
        return Order::create([
            'order_number' => $number,
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_district' => 'Menteng',
            'shipping_postal_code' => '10310',
            'order_status' => $orderStatus,
            'payment_status' => 'pending',
            'shipping_status' => 'delivered',
            'payment_method' => 'cod',
            'cod_flag' => true,
            'subtotal_amount' => 100000,
            'total_amount' => 110000,
        ]);
    }

    public function test_cod_remains_pending_when_order_reaches_delivered(): void
    {
        $order = $this->makeCodOrder('RA-COD-1', 'shipped');
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-COD-1',
            'status' => 'delivered',
            'last_status_at' => now(),
        ])
        ;

        // CASCADE carrier (mis. webhook J&T / refresh) -> delivered.
        app(ShippingService::class)->applyCarrierUpdate($record, 'delivered', null, null, null, null, 'webhook');

        $fresh = $order->fresh();
        $this->assertSame('delivered', $fresh->order_status);
        // KOntrak final: COD TIDAK lunas saat delivered (payment tetap pending).
        $this->assertSame('pending', $fresh->payment_status);
    }

    public function test_cod_is_paid_at_completion_not_delivery(): void
    {
        $order = $this->makeCodOrder('RA-COD-2', 'completed');

        $payment = app(PaymentService::class)->completeCodAtCompletion($order);

        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame('completed', $payment->fresh()->status);
        $this->assertSame('cod', $payment->payment_method);
        $this->assertNotNull($payment->paid_at);
    }

    public function test_complete_cod_rejects_non_completed_order(): void
    {
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('COD hanya dapat diselesaikan saat pesanan completed.');

        $order = $this->makeCodOrder('RA-COD-3', 'delivered');
        app(PaymentService::class)->completeCodAtCompletion($order);
    }
}