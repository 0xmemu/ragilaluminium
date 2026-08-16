<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class CheckoutTelemetryTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_checkout_emits_correlated_safe_outcome(): void
    {
        Log::spy();

        $product = Product::create([
            'parent_sku' => 'WIN-TELEM-1', 'name' => 'Window', 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS', 'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id, 'variant_sku' => 'WIN-TELEM-1-V1',
            'price' => 1000000, 'stock' => 5, 'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'WIN-TELEM-1-V1' => [
                'line_id' => 'WIN-TELEM-1-V1', 'parent_sku' => 'WIN-TELEM-1', 'variant_sku' => 'WIN-TELEM-1-V1',
                'name' => 'Window', 'unit_price' => 1000000, 'quantity' => 1,
            ],
        ]]);

        $this->post('/checkout/validate', [
            'name' => 'Budi', 'phone' => '0812', 'address_line1' => 'Jl A No 1',
            'province' => 'JAWA BARAT', 'city' => 'KOTA BANDUNG', 'district' => 'COBLONG',
            'village' => 'LEBAK GEDE', 'province_id' => '32', 'city_id' => '3273',
            'district_id' => '3273010', 'village_id' => '3273010001', 'postal_code' => '40132',
        ])->assertRedirect();

        $response = $this->post('/checkout/place-order', ['payment_method' => 'transfer']);
        $requestId = (string) $response->headers->get('X-Request-ID');

        $response->assertRedirectContains('/order/ORD');
        Log::shouldHaveReceived('info')
            ->withArgs(function ($message, $context) use ($requestId): bool {
                return $message === 'checkout_outcome'
                    && $context['schema_version'] === 1
                    && $context['request_id'] === $requestId
                    && $context['outcome'] === 'order_created'
                    && $context['payment_method'] === 'transfer'
                    && $context['idempotency_replay'] === false
                    && array_diff(array_keys($context), [
                        'schema_version', 'request_id', 'outcome', 'payment_method', 'idempotency_replay',
                    ]) === [];
            })
            ->once();
    }
}
