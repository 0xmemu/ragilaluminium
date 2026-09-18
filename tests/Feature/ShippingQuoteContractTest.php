<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Shipping\JntCargoClient;
use App\Services\Shipping\JntResponse;
use App\Services\ShippingService;
use App\Support\ShippingQuoteManualReviewNotifier;
use App\Support\CodSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShippingQuoteContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_quote_endpoint_returns_local_fallback_when_jnt_is_not_ready(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(false);
            $mock->shouldNotReceive('tariff');
        });

        $response = $this->postJson('/api/shipping/quote', [
            'weight_kg' => 2,
            'destination_city' => 'KOTA BANDUNG',
            'destination_province' => 'JAWA BARAT',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.state', 'fallback')
            ->assertJsonPath('data.is_final', false)
            ->assertJsonPath('data.manual_review', false)
            ->assertJsonPath('data.net', 19000);
    }

    public function test_quote_endpoint_keeps_local_estimate_when_postal_is_unmapped(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(false);
            $mock->shouldNotReceive('tariff');
        });

        $this->postJson('/api/shipping/quote', [
            'weight_kg' => 2,
            'destination_city' => 'KABUPATEN BANJARNEGARA',
            'destination_province' => 'JAWA TENGAH',
            'destination_area' => 'MANDIRAJA',
            'village_name' => 'MANDIRAJA KULON',
            'postal_code' => '53473',
        ])->assertOk()
            ->assertJsonPath('data.state', 'fallback')
            ->assertJsonPath('data.is_final', false)
            ->assertJsonPath('data.net', 19000);
    }

    public function test_provider_failure_returns_local_provisional_quote_without_provider_error(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andThrow(new \RuntimeException('provider secret must not reach customer'));
        });

        $quote = app(ShippingService::class)->quote(3.5, 'KOTA BANDUNG', 'JAWA BARAT');

        $this->assertSame('manual_review', $quote['state']);
        $this->assertFalse($quote['is_final']);
        $this->assertTrue($quote['manual_review']);
        $this->assertSame(22000.0, $quote['net']);
        $this->assertStringNotContainsString('provider secret', $quote['message']);
    }

    public function test_live_jnt_quote_is_final_when_tariff_is_available(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andReturn(new JntResponse(
                ok: true,
                httpStatus: 200,
                data: ['data' => ['estimateSumFreight' => 42000]],
                requestId: 'quote-1',
                elapsedMs: 120,
            ));
        });

        $quote = app(ShippingService::class)->quote(2, 'KOTA BANDUNG', 'JAWA BARAT');

        $this->assertSame('ready', $quote['state']);
        $this->assertTrue($quote['is_final']);
        $this->assertFalse($quote['manual_review']);
        $this->assertSame(42000.0, $quote['net']);
    }

    public function test_checkout_creates_cod_order_when_quote_requires_manual_review(): void
    {
        CodSettings::update(['enabled' => true, 'fee_type' => 'percent', 'fee_value' => 0]);
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andThrow(new \RuntimeException('provider unavailable'));
        });

        $product = Product::create([
            'parent_sku' => 'QUOTE-COD-1',
            'name' => 'Window COD',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'QUOTE-COD-1-V1',
            'price' => 100000,
            'stock' => 2,
            'status' => 'active',
        ]);

        $this->withSession([
            'ragil_cart' => [
                $variant->variant_sku => [
                    'line_id' => $variant->variant_sku,
                    'parent_sku' => $product->parent_sku,
                    'variant_sku' => $variant->variant_sku,
                    'name' => $product->name,
                    'unit_price' => 100000,
                    'quantity' => 1,
                ],
            ],
            'checkout_details' => [
                'name' => 'Budi',
                'phone' => '0812',
                'province' => 'JAWA TENGAH',
                'city' => 'KABUPATEN BANJARNEGARA',
                'district' => 'MANDIRAJA',
                'village' => 'MANDIRAJA KULON',
                'address_line1' => 'Jl A',
                'postal_code' => '53473',
            ],
        ]);

        $this->post('/checkout/place-order', ['payment_method' => 'cod'])
            ->assertRedirectContains('/order/ORD');

        $order = Order::latest('id')->firstOrFail();
        $this->assertTrue((bool) $order->cod_flag);
        $this->assertDatabaseHas('admin_notifications', [
            'type' => 'shipping_quote_manual_review',
            'related_type' => Order::class,
            'related_id' => $order->id,
        ]);
    }

    public function test_manual_review_notification_is_deduplicated_per_order(): void
    {
        $order = Order::create([
            'order_number' => 'RA-QUOTE-'.uniqid(),
            'customer_name' => 'Budi',
            'customer_phone' => '628123',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'KOTA BANDUNG',
            'shipping_province' => 'JAWA BARAT',
            'shipping_postal_code' => '40132',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'total_amount' => 119000,
            'payment_method' => 'transfer',
        ]);

        $quote = ['rough_estimate' => 22000];
        ShippingQuoteManualReviewNotifier::notify($order, $quote);
        ShippingQuoteManualReviewNotifier::notify($order, $quote);

        $this->assertSame(1, AdminNotification::where('type', 'shipping_quote_manual_review')
            ->where('related_id', $order->id)
            ->whereNull('read_at')
            ->count());
    }

    public function test_checkout_creates_manual_review_notification_for_provisional_quote(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andThrow(new \RuntimeException('provider unavailable'));
        });

        $product = Product::create([
            'parent_sku' => 'QUOTE-TEST-1',
            'name' => 'Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'QUOTE-TEST-1-V1',
            'price' => 100000,
            'stock' => 2,
            'status' => 'active',
        ]);

        $this->withSession([
            'ragil_cart' => [
                $variant->variant_sku => [
                    'line_id' => $variant->variant_sku,
                    'parent_sku' => $product->parent_sku,
                    'variant_sku' => $variant->variant_sku,
                    'name' => $product->name,
                    'unit_price' => 100000,
                    'quantity' => 1,
                ],
            ],
            'checkout_details' => [
                'name' => 'Budi',
                'phone' => '0812',
                'province' => 'JAWA BARAT',
                'city' => 'KOTA BANDUNG',
                'district' => 'COBLONG',
                'village' => 'LEBAK GEDE',
                'address_line1' => 'Jl A',
                'postal_code' => '40132',
            ],
        ]);

        $this->post('/checkout/place-order', ['payment_method' => 'transfer'])
            ->assertRedirectContains('/order/ORD');

        $order = Order::latest('id')->firstOrFail();
        $this->assertDatabaseHas('admin_notifications', [
            'type' => 'shipping_quote_manual_review',
            'related_type' => Order::class,
            'related_id' => $order->id,
        ]);
        $this->assertSame(1, AdminNotification::where('type', 'shipping_quote_manual_review')
            ->where('related_id', $order->id)
            ->count());
    }

    /**
     * Biaya asuransi harus angka J&T apa adanya. Angka uji sengaja dibuat
     * tidak wajar (7.777) supaya rumus lokal mana pun akan gagal di sini:
     * 0,2% dari nilai 1.000.000 = 2.000, dan floor Rp 5.000 = 5.000.
     */
    public function test_biaya_asuransi_diambil_apa_adanya_dari_jnt(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andReturn(new JntResponse(
                ok: true,
                httpStatus: 200,
                data: ['data' => [
                    'estimateCustomerCost' => 40000,
                    'estimateInsuranceCost' => 7777,
                    'estimateSumFreight' => 47777,
                ]],
                requestId: 'insurance-exact-1',
                elapsedMs: 100,
            ));
        });

        $dipilih = app(ShippingService::class)->quote(20, 'KOTA BANDUNG', 'JAWA BARAT', null, null, true, 1000000.0);

        $this->assertSame(7777.0, $dipilih['insurance'], 'biaya asuransi harus sama persis dengan angka J&T');
        $this->assertSame(40000.0, $dipilih['freight'], 'ongkir dari estimateCustomerCost J&T');
        $this->assertTrue($dipilih['insurance_selected']);
        $this->assertSame(7777.0, $dipilih['insurance_charged']);
        $this->assertSame(
            $dipilih['net_ongkir'] + $dipilih['insurance_charged'],
            $dipilih['net'],
            'total = ongkir net + asuransi ditagihkan',
        );

        $tidakDipilih = app(ShippingService::class)->quote(20, 'KOTA BANDUNG', 'JAWA BARAT', null, null, false, 1000000.0);

        $this->assertSame(7777.0, $tidakDipilih['insurance'], 'biaya tetap angka J&T meski tidak dipilih');
        $this->assertFalse($tidakDipilih['insurance_selected']);
        $this->assertSame(0.0, $tidakDipilih['insurance_charged'], 'tidak dipilih berarti tidak ditagihkan');
    }

    public function test_asuransi_tidak_dihitung_saat_jnt_tidak_memberi_biaya(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andReturn(new JntResponse(
                ok: true,
                httpStatus: 200,
                data: ['data' => ['estimateCustomerCost' => 40000]],
                requestId: 'insurance-exact-2',
                elapsedMs: 100,
            ));
        });

        $quote = app(ShippingService::class)->quote(20, 'KOTA BANDUNG', 'JAWA BARAT', null, null, true, 1000000.0);

        $this->assertEquals(0, $quote['insurance'], 'tanpa angka J&T, asuransi 0 dan bukan hasil hitungan lokal');
        $this->assertFalse($quote['insurance_available']);
        $this->assertFalse($quote['insurance_selected']);
        $this->assertEquals(0, $quote['insurance_charged']);
        $this->assertSame($quote['freight'], $quote['net'], 'tanpa asuransi, tagihan = tarif J&T');
    }
}
