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
        // Log::listen() pasif: tidak mengganggu channel kustom 'jnt' (yang
        // dipakai fallback tariff J&T di checkout), hanya menyalin pesan utk
        // verifikasi telemetry.
        $captured = [];
        Log::listen(function ($message) use (&$captured): void {
            if ($message instanceof \Illuminate\Log\Events\MessageLogged) {
                $captured[] = ['level' => $message->level, 'message' => $message->message, 'context' => $message->context];
            }
        });

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

        $match = null;
        foreach ($captured as $entry) {
            if ($entry['message'] !== 'checkout_outcome') {
                continue;
            }
            $ctx = $entry['context'];
            if (($ctx['schema_version'] ?? null) === 1
                && ($ctx['request_id'] ?? null) === $requestId
                && ($ctx['outcome'] ?? null) === 'order_created'
                && ($ctx['payment_method'] ?? null) === 'transfer'
                && ($ctx['idempotency_replay'] ?? null) === false
                && array_diff(array_keys($ctx), [
                    'schema_version', 'request_id', 'outcome', 'payment_method', 'idempotency_replay',
                ]) === []) {
                $match = $entry;
                break;
            }
        }

        $this->assertNotNull($match, 'checkout_outcome telemetry tidak ditemukan dgn payload aman.');
        $this->assertSame('info', $match['level']);
    }
}
