<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderEditPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_pending_confirmation_orders_are_editable(): void
    {
        $service = app(OrderService::class);
        $pending = $this->makeOrder('pending_payment', 'RA-EDIT-001');
        $processing = $this->makeOrder('processing', 'RA-EDIT-002');
        $delivered = $this->makeOrder('delivered', 'RA-EDIT-003');

        $this->assertTrue($service->editPolicy($pending)['allowed']);
        $this->assertFalse($service->editPolicy($processing)['allowed']);
        $this->assertFalse($service->editPolicy($delivered)['allowed']);
        $this->assertSame('Pesanan hanya dapat diedit saat Menunggu Konfirmasi.', $service->editPolicy($processing)['reason']);
    }

    private function makeOrder(string $status, string $number): Order
    {
        return Order::create([
            'order_number' => $number, 'customer_name' => 'Pembeli Uji', 'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Uji', 'shipping_city' => 'Kudus', 'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '59311', 'order_status' => $status,
            'payment_status' => $status === 'pending_payment' ? 'pending' : 'paid',
            'shipping_status' => $status === 'delivered' ? 'delivered' : 'pending_pickup',
            'subtotal_amount' => 100000, 'shipping_amount' => 0, 'discount_amount' => 0, 'total_amount' => 100000,
            'payment_method' => 'transfer', 'cod_flag' => false,
        ]);
    }
}
