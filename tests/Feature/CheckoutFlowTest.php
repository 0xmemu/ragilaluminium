<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;

class CheckoutFlowTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_checkout_creates_order_items_and_payment(): void
    {
        $product = Product::create([
            'parent_sku' => 'WIN-ORD-1', 'name' => 'Window', 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS', 'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id, 'variant_sku' => 'WIN-ORD-1-V1',
            'price' => 1000000, 'stock' => 5, 'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'WIN-ORD-1-V1' => [
                'line_id' => 'WIN-ORD-1-V1', 'parent_sku' => 'WIN-ORD-1', 'variant_sku' => 'WIN-ORD-1-V1',
                'name' => 'Window', 'unit_price' => 1000000, 'quantity' => 2,
            ],
        ]]);

        $this->post('/checkout/validate', [
            'name' => 'Budi',
            'phone' => '0812',
            'address_line1' => 'Jl A No 1',
            'province' => 'DKI JAKARTA',
            'city' => 'KOTA JAKARTA SELATAN',
            'district' => 'KEBAYORAN BARU',
            'village' => 'SENAYAN',
            'province_id' => '31',
            'city_id' => '3174',
            'district_id' => '3174010',
            'village_id' => '3174010001',
            'postal_code' => '12190',
        ])->assertRedirect();

        $this->post('/checkout/place-order', ['payment_method' => 'transfer'])
            ->assertRedirectContains('/order/RA-');

        $order = Order::latest()->first();
        $this->assertNotNull($order);
        $this->assertEquals('pending_payment', $order->order_status);
        $this->assertEquals('pending', $order->payment_status);
        $this->assertEquals('KEBAYORAN BARU', $order->shipping_district);
        $this->assertEquals('SENAYAN', $order->shipping_village);
        // Subtotal otoritatif dari harga DB (2 x 1.000.000).
        $this->assertEquals(2000000, (float) $order->subtotal_amount);
        // Total = subtotal + ongkir (dihitung otomatis saat checkout).
        $this->assertEquals(
            (float) $order->subtotal_amount + (float) $order->shipping_amount,
            (float) $order->total_amount
        );
        // Stok berkurang setelah order dibuat.
        $this->assertEquals(3, $variant->fresh()->stock);
        $this->assertDatabaseHas('order_items', ['order_id' => $order->id, 'variant_sku' => 'WIN-ORD-1-V1', 'quantity' => 2]);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'status' => 'pending']);
    }

    public function test_checkout_validate_requires_wilayah_fields(): void
    {
        $this->withSession(['ragil_cart' => [
            'WIN-ORD-1-V1' => [
                'line_id' => 'WIN-ORD-1-V1', 'parent_sku' => 'WIN-ORD-1', 'variant_sku' => 'WIN-ORD-1-V1',
                'name' => 'Window', 'unit_price' => 1000000, 'quantity' => 1,
            ],
        ]]);

        $this->from('/checkout')
            ->post('/checkout/validate', [
                'name' => 'Budi',
                'phone' => '0812',
                'address_line1' => 'Jl A',
                'postal_code' => '12345',
            ])
            ->assertRedirect('/checkout')
            ->assertSessionHasErrors(['province', 'city', 'district', 'village', 'province_id', 'city_id', 'district_id', 'village_id']);
    }

    public function test_checkout_validate_stores_wilayah_names_in_session(): void
    {
        $this->withSession(['ragil_cart' => [
            'WIN-ORD-1-V1' => [
                'line_id' => 'WIN-ORD-1-V1', 'parent_sku' => 'WIN-ORD-1', 'variant_sku' => 'WIN-ORD-1-V1',
                'name' => 'Window', 'unit_price' => 1000000, 'quantity' => 1,
            ],
        ]]);

        $this->post('/checkout/validate', [
            'name' => 'Budi',
            'phone' => '0812',
            'address_line1' => 'Jl A No 1',
            'province' => 'JAWA BARAT',
            'city' => 'KOTA BANDUNG',
            'district' => 'COBLONG',
            'village' => 'LEBAK GEDE',
            'province_id' => '32',
            'city_id' => '3273',
            'district_id' => '3273010',
            'village_id' => '3273010001',
            'postal_code' => '40132',
        ])->assertRedirect();

        $this->assertEquals('JAWA BARAT', session('checkout_details.province'));
        $this->assertEquals('KOTA BANDUNG', session('checkout_details.city'));
        $this->assertEquals('COBLONG', session('checkout_details.district'));
        $this->assertEquals('LEBAK GEDE', session('checkout_details.village'));
    }
}
