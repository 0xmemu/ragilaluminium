<?php

namespace Tests\Feature;

use App\Events\PaymentConfirmed;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TransactionIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-TXN-'.uniqid(),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji No. 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ], $overrides));
    }

    public function test_zero_payment_cannot_mark_order_paid(): void
    {
        $order = $this->makeOrder();

        $this->actingAs($this->admin())
            ->post(route('admin.payments.store', $order), [
                'payment_method' => 'transfer',
                'amount' => 0,
                'status' => 'completed',
            ])
            ->assertSessionHasErrors('amount');

        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_partial_payments_only_mark_order_paid_after_full_settlement(): void
    {
        Event::fake([PaymentConfirmed::class]);
        $admin = $this->admin();
        $order = $this->makeOrder();

        $this->actingAs($admin)
            ->post(route('admin.payments.store', $order), [
                'payment_method' => 'transfer',
                'amount' => 40000,
                'status' => 'completed',
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertSame('pending_payment', $order->fresh()->order_status);
        Event::assertNotDispatched(PaymentConfirmed::class);

        $this->actingAs($admin)
            ->post(route('admin.payments.store', $order), [
                'payment_method' => 'transfer',
                'amount' => 60000,
                'status' => 'completed',
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame('processing', $order->fresh()->order_status);
        Event::assertDispatchedTimes(PaymentConfirmed::class, 1);
    }

    public function test_refunded_payment_is_reconciled_to_order(): void
    {
        Event::fake([PaymentConfirmed::class]);
        $admin = $this->admin();
        $order = $this->makeOrder();

        $this->actingAs($admin)
            ->post(route('admin.payments.store', $order), [
                'payment_method' => 'transfer',
                'amount' => 100000,
                'status' => 'completed',
            ])
            ->assertRedirect();

        $payment = Payment::where('order_id', $order->id)->sole();

        $this->actingAs($admin)
            ->put(route('admin.payments.update', $payment), [
                'status' => 'refunded',
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertSame('refunded', $order->fresh()->payment_status);
        $this->assertSame('processing', $order->fresh()->order_status);
    }

    public function test_cancellation_restores_variant_stock_exactly_once(): void
    {
        $admin = $this->admin();
        $product = Product::create([
            'parent_sku' => 'WIN-CANCEL-1',
            'name' => 'Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-CANCEL-1-V1',
            'price' => 50000,
            'stock' => 3,
            'status' => 'active',
        ]);
        $order = $this->makeOrder(['order_status' => 'processing']);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => $product->parent_sku,
            'variant_sku' => $variant->variant_sku,
            'name' => $product->name,
            'unit_price' => 50000,
            'quantity' => 2,
            'line_subtotal' => 100000,
            'line_discount' => 0,
            'line_total' => 100000,
        ]);

        $this->actingAs($admin)
            ->put(route('admin.orders.status', $order), [
                'order_status' => 'cancelled',
                'cancel_reason' => 'Permintaan pelanggan',
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertSame('cancelled', $order->fresh()->order_status);
        $this->assertSame(5, $variant->fresh()->stock);

        $this->actingAs($admin)
            ->put(route('admin.orders.status', $order), [
                'order_status' => 'cancelled',
                'cancel_reason' => 'Retry request',
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertSame(5, $variant->fresh()->stock);
    }
}
