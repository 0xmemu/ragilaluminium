<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\SequenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderNumberTest extends TestCase
{
    use RefreshDatabase;

    protected function arrangeCheckout(): void
    {
        $product = Product::create([
            'parent_sku' => 'RAXXORD000-1',
            'name' => 'Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RAXXORD000-1-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'RAXXORD000-1-V1' => [
                'line_id' => 'RAXXORD000-1-V1',
                'parent_sku' => 'RAXXORD000-1',
                'variant_sku' => 'RAXXORD000-1-V1',
                'name' => 'Window',
                'unit_price' => 1000000,
                'quantity' => 1,
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
    }

    public function test_checkout_order_number_uses_ord_yymm_sequence_without_dash(): void
    {
        $this->arrangeCheckout();

        $this->post('/checkout/place-order', ['payment_method' => 'transfer'])
            ->assertRedirectContains('/order/ORD');

        $order = Order::latest()->first();
        $this->assertNotNull($order);
        $number = $order->order_number;

        $this->assertSame(11, strlen($number), 'ORD + YYMM + 4-digit seq must be 11 chars');
        $this->assertStringStartsWith('ORD', $number);
        $this->assertStringNotContainsString('-', $number);
        $this->assertMatchesRegularExpression('/^ORD\d{8}$/', $number);
    }

    public function test_order_number_is_expressed_via_monthly_sequence_key(): void
    {
        $sequence = app(SequenceService::class);

        // Same monthly key increments atomically without reuse.
        $a = $sequence->next('order-2608');
        $b = $sequence->next('order-2608');

        $this->assertSame(1, $a);
        $this->assertSame(2, $b);

        // A different month starts a fresh sequence (reset per month).
        $this->assertSame(1, $sequence->next('order-2609'));
        $this->assertSame(1, $sequence->current('order-2609'));
    }
}
