<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StoreVoucher;
use App\Services\OrderService;
use App\Services\PriceService;
use App\Services\VoucherService;
use App\Support\CodSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CommerceWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(string $sku, string $variantSku, float $price, int $stock = 5): ProductVariant
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$sku,
            'short_name' => $sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        return ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $variantSku,
            'price' => $price,
            'stock' => $stock,
            'status' => 'active',
        ]);
    }

    private function cartItems(array $items): array
    {
        $out = [];
        foreach ($items as $it) {
            $variantSku = $it['variant_sku'];
            $out[$variantSku] = [
                'line_id' => $variantSku,
                'parent_sku' => $it['parent_sku'],
                'variant_sku' => $variantSku,
                'name' => 'Produk '.$it['parent_sku'],
                'unit_price' => $it['price'],
                'quantity' => $it['quantity'],
                'note' => $it['note'] ?? null,
            ];
        }

        return $out;
    }

    private function customer(): array
    {
        return [
            'name' => 'Budi',
            'phone' => '081234567890',
            'email' => 'budi@example.com',
            'notes' => null,
        ];
    }

    private function shipping(): array
    {
        return [
            'address_line1' => 'Jl. Contoh 1',
            'address_line2' => null,
            'city' => 'Semarang',
            'province' => 'Jawa Tengah',
            'district' => 'Candisari',
            'village' => 'Jatingaleh',
            'postal_code' => '50254',
            'country' => 'Indonesia',
        ];
    }

    private function place(
        array $cart,
        string $paymentMethod = 'transfer',
        ?array $customer = null,
        ?array $shipping = null,
        ?float $shippingCost = 100000,
        float $shippingSubsidy = 0,
        ?array $voucher = null,
        ?string $idempotencyKey = null,
    ): Order {
        $this->withSession(['ragil_cart' => $cart]);

        return app(OrderService::class)->createFromCart(
            customer: $customer ?? $this->customer(),
            shipping: $shipping ?? $this->shipping(),
            paymentMethod: $paymentMethod,
            shippingCost: $shippingCost,
            voucher: $voucher,
            shippingSubsidy: $shippingSubsidy,
            idempotencyKey: $idempotencyKey ?? (string) Str::uuid(),
        );
    }

    public function test_selection_off_with_no_selection_checks_out_all_cart_lines(): void
    {
        $this->makeProduct('P-A', 'P-A-V1', 500000);
        $this->makeProduct('P-B', 'P-B-V1', 700000);

        $order = $this->place($this->cartItems([
            ['parent_sku' => 'P-A', 'variant_sku' => 'P-A-V1', 'price' => 500000, 'quantity' => 1],
            ['parent_sku' => 'P-B', 'variant_sku' => 'P-B-V1', 'price' => 700000, 'quantity' => 2],
        ]));

        $this->assertCount(2, $order->items);
        $this->assertEquals(1900000.0, (float) $order->subtotal_amount);
        $this->assertDatabaseHas('order_items', ['order_id' => $order->id, 'variant_sku' => 'P-A-V1']);
        $this->assertDatabaseHas('order_items', ['order_id' => $order->id, 'variant_sku' => 'P-B-V1']);
    }

    public function test_selection_mode_limits_order_to_checked_lines_only(): void
    {
        $this->makeProduct('P-A', 'P-A-V1', 500000);
        $this->makeProduct('P-B', 'P-B-V1', 700000);

        $this->withSession(['ragil_cart' => $this->cartItems([
            ['parent_sku' => 'P-A', 'variant_sku' => 'P-A-V1', 'price' => 500000, 'quantity' => 1],
            ['parent_sku' => 'P-B', 'variant_sku' => 'P-B-V1', 'price' => 700000, 'quantity' => 1],
        ])]);

        app(\App\Services\CartService::class)->selectLines(['P-A-V1']);

        $order = $this->place($this->cartItems([
            ['parent_sku' => 'P-A', 'variant_sku' => 'P-A-V1', 'price' => 500000, 'quantity' => 1],
            ['parent_sku' => 'P-B', 'variant_sku' => 'P-B-V1', 'price' => 700000, 'quantity' => 1],
        ]));

        $this->assertCount(1, $order->items);
        $this->assertEquals(500000.0, (float) $order->subtotal_amount);
        $this->assertDatabaseHas('order_items', ['order_id' => $order->id, 'variant_sku' => 'P-A-V1']);
        $this->assertDatabaseMissing('order_items', ['order_id' => $order->id, 'variant_sku' => 'P-B-V1']);
    }

    public function test_checkout_does_not_require_or_depend_on_email(): void
    {
        $this->makeProduct('P-A', 'P-A-V1', 500000);

        $order = $this->place(
            $this->cartItems([['parent_sku' => 'P-A', 'variant_sku' => 'P-A-V1', 'price' => 500000, 'quantity' => 1]]),
            customer: ['name' => 'Budi', 'phone' => '081234567890', 'notes' => null],
        );

        $this->assertNotNull($order);
        $this->assertNull($order->customer_email);
    }

    public function test_consolidated_breakdown_keeps_totals_consistent_with_voucher_subsidy_and_cod(): void
    {
        CodSettings::update([
            'enabled' => true,
            'fee_type' => 'percent',
            'fee_value' => 10,
            'max_order_amount' => null,
        ]);

        $this->makeProduct('P-A', 'P-A-V1', 1000000);

        StoreVoucher::create([
            'name' => 'Potong 20%',
            'code' => 'HEMAT20',
            'discount_type' => 'percent',
            'discount_value' => 20,
            'min_purchase' => 0,
            'published' => true,
        ]);

        $subtotal = 1000000.0;
        $voucher = app(VoucherService::class)->applyCodes(['HEMAT20'], $subtotal);
        $this->assertEquals(200000.0, (float) $voucher['discount']);

        $order = $this->place(
            $this->cartItems([['parent_sku' => 'P-A', 'variant_sku' => 'P-A-V1', 'price' => 1000000, 'quantity' => 1]]),
            paymentMethod: 'cod',
            shippingCost: 100000,
            shippingSubsidy: 30000,
            voucher: $voucher,
        );

        $this->assertEquals(1000000.0, (float) $order->subtotal_amount);
        $this->assertEquals(200000.0, (float) $order->voucher_discount_amount);
        $this->assertEquals(100000.0, (float) $order->shipping_amount);
        $this->assertEquals(30000.0, (float) $order->shipping_subsidy_amount);
        $this->assertEquals(80000.0, (float) $order->cod_fee_amount);
        $this->assertTrue((bool) $order->cod_flag);

        $expected = 1000000 + 100000 - 200000 + 80000;
        $this->assertEquals($expected, (float) $order->total_amount);
        $this->assertEquals(
            (float) $order->subtotal_amount
                + (float) $order->shipping_amount
                - (float) $order->voucher_discount_amount
                + (float) $order->cod_fee_amount,
            (float) $order->total_amount
        );
    }

    public function test_item_note_is_stored_per_product_on_order_item(): void
    {
        $this->makeProduct('P-A', 'P-A-V1', 500000);

        $order = $this->place($this->cartItems([
            ['parent_sku' => 'P-A', 'variant_sku' => 'P-A-V1', 'price' => 500000, 'quantity' => 1, 'note' => 'Hubungi sebelum kirim'],
        ]));

        $item = OrderItem::query()->where('order_id', $order->id)->first();
        $this->assertSame('Hubungi sebelum kirim', $item->note);
        $this->assertNull($order->notes);
    }

    public function test_variant_price_is_manual_and_never_auto_overridden(): void
    {
        $variant = $this->makeProduct('P-MANUAL', 'P-MANUAL-V1', 1234567);

        $priced = app(PriceService::class)->forVariant($variant, $variant->product);
        $this->assertEquals(1234567.0, (float) $priced['bandrol']);
        $this->assertEquals(1234567.0, (float) $priced['sale']);
        $this->assertNull($priced['compare']);

        $order = $this->place($this->cartItems([
            ['parent_sku' => 'P-MANUAL', 'variant_sku' => 'P-MANUAL-V1', 'price' => 1234567, 'quantity' => 1],
        ]));

        $item = OrderItem::query()->where('order_id', $order->id)->first();
        $this->assertEquals(1234567.0, (float) $item->unit_price);
        $this->assertEquals(1234567.0, (float) $variant->fresh()->price);
    }
}
