<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OrderConfirmationTest extends TestCase
{
    use RefreshDatabase;

    public function test_transfer_confirmation_shows_payment_instructions_and_whatsapp(): void
    {
        [$order] = $this->makeOrder('transfer', 'RA-CONF-TF-1', 1050000);

        $this->withSession(['confirmed_orders' => [$order->order_number]])
            ->get(route('order.confirmation', $order->order_number))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/OrderConfirmation')
                ->where('order.payment_method', 'transfer')
                ->where('order.total_amount', fn ($v) => (float) $v === 1050000.0)
                ->where('payment_instructions.bank_name', 'BCA')
                ->where('payment_instructions.account_number', '1234567890')
                ->where('whatsapp_url', fn ($url) => is_string($url) && str_contains($url, 'wa.me/')));
    }

    public function test_cod_confirmation_has_no_bank_block(): void
    {
        [$order] = $this->makeOrder('cod', 'RA-CONF-COD-1', 500000);

        $this->withSession(['confirmed_orders' => [$order->order_number]])
            ->get(route('order.confirmation', $order->order_number))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/OrderConfirmation')
                ->where('order.payment_method', 'cod')
                ->where('payment_instructions', null));
    }

    public function test_dashboard_status_chips_use_order_status_query(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Order::create([
            'order_number' => 'RA-DASH-1',
            'customer_name' => 'A',
            'customer_phone' => '0812',
            'shipping_address_line1' => 'Jl',
            'shipping_city' => 'Kota',
            'shipping_province' => 'Prov',
            'shipping_postal_code' => '1',
            'subtotal_amount' => 1,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1,
            'payment_method' => 'transfer',
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending',
            'updated_at' => now()->subDays(2),
            'created_at' => now()->subDays(2),
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                ->where('statusOrder.0.href', fn ($href) => is_string($href) && str_contains($href, 'order_status='))
                ->where('attention.0.href', fn ($href) => is_string($href) && str_contains($href, 'order_status=pending_payment')));
    }

    /** @return array{0: Order, 1: Product} */
    private function makeOrder(string $paymentMethod, string $orderNumber, float $total): array
    {
        $product = Product::create([
            'parent_sku' => 'WIN-CONF-1',
            'name' => 'Jendela Test',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-CONF-1-V1',
            'price' => $total,
            'stock' => 5,
            'status' => 'active',
        ]);

        $order = Order::create([
            'order_number' => $orderNumber,
            'customer_name' => 'Budi',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_postal_code' => '12345',
            'subtotal_amount' => $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $total,
            'payment_method' => $paymentMethod,
            'cod_flag' => $paymentMethod === 'cod',
            'order_status' => $paymentMethod === 'cod' ? 'pending' : 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => $product->parent_sku,
            'variant_sku' => $variant->variant_sku,
            'name' => $product->name,
            'unit_price' => $total,
            'quantity' => 1,
            'line_subtotal' => $total,
            'line_discount' => 0,
            'line_total' => $total,
        ]);

        return [$order, $product];
    }
}
