<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Shipping\JntCargoClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutPrefillTest extends TestCase
{
    use RefreshDatabase;

    private function seedProduct(): void
    {
        $product = Product::create([
            'parent_sku' => 'PRE-1', 'name' => 'Window', 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS', 'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id, 'variant_sku' => 'PRE-1-V1',
            'price' => 1000000, 'stock' => 5, 'status' => 'active',
        ]);
    }

    private function validDetails(): array
    {
        return [
            'name' => 'Budi', 'phone' => '081234567890',
            'address_line1' => 'Jl A No 1', 'address_line2' => 'RT 02',
            'province' => 'JAWA BARAT', 'city' => 'KOTA BANDUNG', 'district' => 'COBLONG', 'village' => 'LEBAK GEDE',
            'province_id' => '32', 'city_id' => '3273', 'district_id' => '3273010', 'village_id' => '3273010001',
            'postal_code' => '40132',
        ];
    }

    private function makeOrder(string $phone, string $orderNumber, array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => $orderNumber,
            'customer_name' => 'Budi',
            'customer_phone' => $phone,
            'shipping_address_line1' => 'Jl A No 1',
            'shipping_city' => 'KOTA BANDUNG',
            'shipping_province' => 'JAWA BARAT',
            'shipping_district' => 'COBLONG',
            'shipping_village' => 'LEBAK GEDE',
            'shipping_postal_code' => '40132',
            'shipping_province_id' => '32',
            'shipping_city_id' => '3273',
            'shipping_district_id' => '3273010',
            'shipping_village_id' => '3273010001',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
        ], $overrides));
    }

    public function test_last_details_returns_most_recent_order_by_normalized_phone(): void
    {
        // Order lama (nomor beda) + order terbaru dengan HP yang dicari.
        $this->makeOrder('628999999999', 'RA-PRE-OLD');
        $this->makeOrder('6281234567890', 'RA-PRE-NEW');

        $this->postJson('/checkout/last-details', ['phone' => '081234567890'])
            ->assertOk()
            ->assertJsonPath('found', true)
            ->assertJsonPath('details.name', 'Budi')
            ->assertJsonPath('details.province', 'JAWA BARAT')
            ->assertJsonPath('details.city_id', '3273')
            ->assertJsonPath('details.village_id', '3273010001')
            ->assertJsonPath('details.postal_code', '40132')
            ->assertJsonPath('details.address_line1', 'Jl A No 1');
    }

    public function test_last_details_unknown_or_empty_phone_returns_not_found(): void
    {
        $this->postJson('/checkout/last-details', ['phone' => '081299999999'])
            ->assertOk()
            ->assertJsonPath('found', false);

        $this->postJson('/checkout/last-details', ['phone' => ''])
            ->assertOk()
            ->assertJsonPath('found', false);
    }

    public function test_place_order_keeps_details_and_stores_wilayah_ids(): void
    {
        // J&T nonaktif di test agar alur offline (tanpa network).
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(false);
        });

        $this->seedProduct();
        $this->withSession(['ragil_cart' => [
            'PRE-1-V1' => [
                'line_id' => 'PRE-1-V1', 'parent_sku' => 'PRE-1', 'variant_sku' => 'PRE-1-V1',
                'name' => 'Window', 'unit_price' => 1000000, 'quantity' => 1,
            ],
        ]]);

        $this->post('/checkout/validate', $this->validDetails())->assertRedirect();
        $this->post('/checkout/place-order', ['payment_method' => 'transfer'])->assertRedirect();

        // Detail tetap di session untuk checkout berikutnya (tidak di-forget).
        $this->assertNotNull(session('checkout_details'));
        $this->assertSame('KOTA BANDUNG', session('checkout_details.city'));
        $this->assertSame('32', session('checkout_details.province_id'));

        // Order menyimpan ID wilayah agar prefill lintas sesi lengkap.
        $order = Order::query()->orderByDesc('id')->first();
        $this->assertNotNull($order);
        $this->assertSame('32', $order->shipping_province_id);
        $this->assertSame('3273', $order->shipping_city_id);
        $this->assertSame('3273010', $order->shipping_district_id);
        $this->assertSame('3273010001', $order->shipping_village_id);
        $this->assertSame('6281234567890', $order->customer_phone);
    }
}
