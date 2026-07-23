<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\ShippingSubsidySettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ShippingSubsidyTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_save_shipping_subsidy_settings(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.shipping-subsidy.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ShippingSubsidy/Edit')
                ->where('settings.enabled', false));

        $this->actingAs($admin)
            ->put(route('admin.shipping-subsidy.update'), [
                'enabled' => true,
                'subsidy_type' => 'percent',
                'subsidy_value' => 50,
                'jnt_enabled' => true,
            ])
            ->assertRedirect(route('admin.shipping-subsidy.edit'));

        $settings = ShippingSubsidySettings::get();
        $this->assertTrue($settings['enabled']);
        $this->assertSame('percent', $settings['subsidy_type']);
        $this->assertEquals(50.0, $settings['subsidy_value']);
        $this->assertTrue($settings['carriers']['jnt']);
    }

    public function test_checkout_applies_percent_subsidy_to_shipping(): void
    {
        ShippingSubsidySettings::update([
            'enabled' => true,
            'subsidy_type' => 'percent',
            'subsidy_value' => 50,
            'jnt_enabled' => true,
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-SUB-1',
            'name' => 'Jendela Subsidi',
            'short_name' => 'SUB',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-SUB-1-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'WIN-SUB-1-100' => [
                'line_id' => 'WIN-SUB-1-100',
                'parent_sku' => 'WIN-SUB-1',
                'variant_sku' => 'WIN-SUB-1-100',
                'name' => 'Jendela Subsidi',
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
            'payment_method' => 'transfer',
        ])->assertRedirect();

        $order = Order::query()->latest('id')->first();
        $this->assertNotNull($order);

        $gross = (float) $order->shipping_amount + (float) $order->shipping_subsidy_amount;
        $this->assertGreaterThan(0, $gross);
        $this->assertEquals(
            round($gross * 0.5, 2),
            (float) $order->shipping_subsidy_amount
        );
        $this->assertEquals(
            round($gross - (float) $order->shipping_subsidy_amount, 2),
            (float) $order->shipping_amount
        );
        $this->assertEquals(
            (float) $order->subtotal_amount
                + (float) $order->shipping_amount
                - (float) $order->voucher_discount_amount
                + (float) $order->cod_fee_amount,
            (float) $order->total_amount
        );
    }

    public function test_disabled_jnt_carrier_skips_subsidy(): void
    {
        ShippingSubsidySettings::update([
            'enabled' => true,
            'subsidy_type' => 'fixed',
            'subsidy_value' => 25000,
            'jnt_enabled' => false,
        ]);

        $applied = ShippingSubsidySettings::apply(50000, 'jnt');
        $this->assertFalse($applied['applied']);
        $this->assertEquals(0.0, $applied['subsidy']);
        $this->assertEquals(50000.0, $applied['net']);
    }
}
