<?php

namespace Tests\Feature;

use App\Domain\Orders\OrderStateMachine;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingRecord;
use App\Models\User;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderStateMachineTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-STATE-'.uniqid(),
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

    public function test_valid_transition_is_persisted_with_audit_event(): void
    {
        $admin = $this->admin();
        $order = $this->makeOrder(['order_status' => 'processing']);

        $changed = app(OrderStateMachine::class)->transition(
            $order,
            'shipped',
            $admin->id,
            'admin_status',
        );

        $this->assertTrue($changed);
        $this->assertSame('shipped', $order->fresh()->order_status);
        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'created_by_user_id' => $admin->id,
        ]);
        $event = EventLog::where('entity_id', $order->id)->latest('id')->firstOrFail();
        $this->assertSame('processing', $event->payload['from']);
        $this->assertSame('shipped', $event->payload['order_status']);
        $this->assertSame('admin_status', $event->payload['source']);
    }

    public function test_admin_cannot_jump_from_pending_payment_to_completed(): void
    {
        $order = $this->makeOrder();

        $this->actingAs($this->admin())
            ->put(route('admin.orders.status', $order), ['order_status' => 'completed'])
            ->assertSessionHasErrors('order_status');

        $this->assertSame('pending_payment', $order->fresh()->order_status);
    }

    public function test_shipped_order_cannot_be_cancelled_or_restore_stock(): void
    {
        $product = Product::create([
            'parent_sku' => 'STATE-CANCEL-1',
            'name' => 'Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'STATE-CANCEL-1-V1',
            'price' => 50000,
            'stock' => 3,
            'status' => 'active',
        ]);
        $order = $this->makeOrder(['order_status' => 'shipped']);
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

        $this->actingAs($this->admin())
            ->put(route('admin.orders.status', $order), ['order_status' => 'cancelled'])
            ->assertSessionHasErrors('order_status');

        $this->assertSame('shipped', $order->fresh()->order_status);
        $this->assertSame(3, $variant->fresh()->stock);
    }

    public function test_stale_or_regressive_carrier_update_cannot_reopen_delivery(): void
    {
        $order = $this->makeOrder([
            'order_status' => 'delivered',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
        ]);
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'STATE-JT-1',
            'shipping_cost' => 0,
            'status' => 'delivered',
            'last_status_at' => '2026-08-08 12:00:00',
        ]);

        app(ShippingService::class)->applyCarrierUpdate(
            $record,
            'in_transit',
            'stale event',
            null,
            '2026-08-08 11:00:00',
        );

        $this->assertSame('delivered', $record->fresh()->status);
        $this->assertSame('delivered', $order->fresh()->shipping_status);
        $this->assertSame('delivered', $order->fresh()->order_status);
    }

    public function test_completed_orders_can_enter_return_but_cancelled_is_terminal(): void
    {
        $states = app(OrderStateMachine::class);

        $this->assertTrue($states->canTransition('completed', 'return_in_process'));
        $this->assertFalse($states->canTransition('cancelled', 'processing'));
    }
}
