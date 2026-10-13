<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\ShippingRecord;
use App\Services\PaymentService;
use App\Services\ReturnService;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Task 3 REVISI (2026-08-25) — COD Settlement Contract.
 *
 * PRIMARY: COD lunas saat shipping DELIVERED via
 * ReturnService::markDeliveredAndSettleCod (dipanggil dari
 * ShippingService::cascadeOrderStatus). Path 1 (completeCodAtCompletion)
 * = fallback legacy utk order completed yang belum tercatat.
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
            'shipping_status' => $orderStatus === 'delivered' ? 'delivered' : 'in_transit',
            'payment_method' => 'cod',
            'cod_flag' => true,
            'subtotal_amount' => 100000,
            'total_amount' => 110000,
        ]);
    }

    public function test_cod_is_paid_when_carrier_reaches_delivered(): void
    {
        $order = $this->makeCodOrder('RA-COD-R1', 'shipped');
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-COD-R1',
            'status' => 'delivered',
            'last_status_at' => '2026-08-24 10:00:00',
        ]);

        app(ShippingService::class)->applyCarrierUpdate($record, 'delivered', null, null, '2026-08-24 10:00:00', null, 'webhook');

        $fresh = $order->fresh();
        $this->assertSame('delivered', $fresh->order_status);
        // Path 2 aktif: lunas saat delivered, bukan menunggu completed.
        $this->assertSame('paid', $fresh->payment_status);

        $payment = Payment::where('order_id', $order->id)->first();
        $this->assertNotNull($payment, 'payment record harus dibuat');
        $this->assertSame('completed', $payment->status);
        $this->assertSame(110000.0, (float) $payment->amount);
        $this->assertSame('2026-08-24 10:00:00', $payment->paid_at?->format('Y-m-d H:i:s'));
    }

    public function test_cod_settlement_is_idempotent_double_call_single_record(): void
    {
        $order = $this->makeCodOrder('RA-COD-R2');
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-COD-R2',
            'status' => 'delivered',
            'last_status_at' => now(),
        ]);

        $svc = app(ReturnService::class);
        $this->assertTrue($svc->markDeliveredAndSettleCod($order->fresh()));
        $this->assertSame('paid', $order->fresh()->payment_status);

        // Panggilan kedua: idempotent, tidak ada record kedua.
        $this->assertFalse($svc->markDeliveredAndSettleCod($order->fresh()));
        $this->assertSame(1, Payment::where('order_id', $order->id)->count());
    }

    public function test_complete_cod_at_completion_skips_when_already_paid(): void
    {
        $order = $this->makeCodOrder('RA-COD-R3', 'completed');
        Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cod',
            'amount' => 110000,
            'status' => 'completed',
            'paid_at' => now()->subDay(),
        ]);

        $payment = app(PaymentService::class)->completeCodAtCompletion($order);

        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame(1, Payment::where('order_id', $order->id)->count(), 'tidak double-count');
        $this->assertSame('completed', $payment->status);
    }

    public function test_complete_cod_at_completion_still_falls_back_for_completed_pending(): void
    {
        // Order completed lama yang belum tercatat (pre-revisi): fallback melunasi.
        $order = $this->makeCodOrder('RA-COD-R4', 'completed');

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

        $order = $this->makeCodOrder('RA-COD-R5', 'delivered');
        app(PaymentService::class)->completeCodAtCompletion($order);
    }
}