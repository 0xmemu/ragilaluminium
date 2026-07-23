<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\CodSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CodSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_save_cod_settings(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.cod-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/CodSettings/Edit')
                ->where('settings.enabled', true));

        $this->actingAs($admin)
            ->put(route('admin.cod-settings.update'), [
                'enabled' => true,
                'fee_type' => 'percent',
                'fee_value' => 2.5,
                'max_order_amount' => 5000000,
            ])
            ->assertRedirect(route('admin.cod-settings.edit'));

        $settings = CodSettings::get();
        $this->assertTrue($settings['enabled']);
        $this->assertSame('percent', $settings['fee_type']);
        $this->assertEquals(2.5, $settings['fee_value']);
        $this->assertEquals(5000000.0, $settings['max_order_amount']);
    }

    public function test_cod_checkout_adds_handling_fee_to_order_total(): void
    {
        CodSettings::update([
            'enabled' => true,
            'fee_type' => 'percent',
            'fee_value' => 10,
            'max_order_amount' => null,
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-COD-1',
            'name' => 'Jendela COD',
            'short_name' => 'COD',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-COD-1-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'WIN-COD-1-100' => [
                'line_id' => 'WIN-COD-1-100',
                'parent_sku' => 'WIN-COD-1',
                'variant_sku' => 'WIN-COD-1-100',
                'name' => 'Jendela COD',
                'unit_price' => 1000000,
                'quantity' => 1,
            ],
        ]]);

        $this->post(route('checkout.validate'), [
            'name' => 'Budi',
            'phone' => '081234567890',
            'email' => 'budi@example.com',
            'province' => 'Jawa Tengah',
            'city' => 'Semarang',
            'district' => 'Candisari',
            'village' => 'Jatingaleh',
            'province_id' => '33',
            'city_id' => '3374',
            'district_id' => '337401',
            'village_id' => '3374011001',
            'address_line1' => 'Jl. Contoh 1',
            'postal_code' => '50254',
        ])->assertRedirect();

        $this->post(route('checkout.place-order'), [
            'payment_method' => 'cod',
        ])->assertRedirect();

        $order = Order::query()->latest('id')->first();
        $this->assertNotNull($order);
        $this->assertTrue((bool) $order->cod_flag);
        $this->assertEquals(100000.0, (float) $order->cod_fee_amount);
        $this->assertEquals(
            (float) $order->subtotal_amount
                + (float) $order->shipping_amount
                - (float) $order->voucher_discount_amount
                + (float) $order->cod_fee_amount,
            (float) $order->total_amount
        );
    }

    public function test_disabled_cod_cannot_be_selected_at_checkout(): void
    {
        CodSettings::update(['enabled' => false]);

        $product = Product::create([
            'parent_sku' => 'WIN-COD-2',
            'name' => 'Jendela',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-COD-2-100',
            'price' => 500000,
            'stock' => 2,
            'status' => 'active',
        ]);

        $this->withSession([
            'ragil_cart' => [
                'WIN-COD-2-100' => [
                    'line_id' => 'WIN-COD-2-100',
                    'parent_sku' => 'WIN-COD-2',
                    'variant_sku' => 'WIN-COD-2-100',
                    'name' => 'Jendela',
                    'unit_price' => 500000,
                    'quantity' => 1,
                ],
            ],
            'checkout_details' => [
                'name' => 'Budi',
                'phone' => '0812',
                'address_line1' => 'Jl A',
                'province' => 'DKI JAKARTA',
                'city' => 'JAKARTA',
                'district' => 'KEBAYORAN',
                'village' => 'SENAYAN',
                'postal_code' => '12190',
            ],
        ]);

        $this->from(route('checkout.index'))
            ->post(route('checkout.place-order'), ['payment_method' => 'cod'])
            ->assertRedirect(route('checkout.index'))
            ->assertSessionHasErrors('payment_method');
    }
}
