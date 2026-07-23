<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StoreVoucher;
use App\Models\User;
use App\Services\VoucherService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StoreVoucherTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_and_exclusively_publish_voucher(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $first = StoreVoucher::create([
            'name' => 'Voucher Lama',
            'code' => 'LAMA10',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'min_purchase' => 0,
            'published' => true,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.vouchers.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Vouchers/Index'));

        $this->actingAs($admin)
            ->post(route('admin.vouchers.store'), [
                'name' => 'Diskon Tengah Tahun',
                'code' => 'RAGIL20',
                'discount_type' => 'percent',
                'discount_value' => 20,
                'min_purchase' => 500000,
                'starts_at' => now()->subDay()->toDateTimeString(),
                'ends_at' => now()->addWeek()->toDateTimeString(),
                'publish_now' => true,
            ])
            ->assertRedirect(route('admin.vouchers.index'));

        $this->assertDatabaseHas('store_vouchers', [
            'code' => 'RAGIL20',
            'published' => true,
        ]);
        $this->assertDatabaseHas('store_vouchers', [
            'id' => $first->id,
            'published' => false,
        ]);
    }

    public function test_checkout_can_apply_voucher_and_reduce_order_total(): void
    {
        $product = Product::create([
            'parent_sku' => 'WIN-VCH-1',
            'name' => 'Jendela Voucher',
            'short_name' => 'Voucher',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-VCH-1-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        StoreVoucher::create([
            'name' => 'Potong 10%',
            'code' => 'HEMAT10',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'min_purchase' => 0,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'published' => true,
        ]);

        $this->post(route('cart.add'), [
            'parent_sku' => 'WIN-VCH-1',
            'variant_sku' => 'WIN-VCH-1-100',
            'quantity' => 1,
        ])->assertRedirect();

        $this->post(route('checkout.voucher.apply'), ['code' => 'HEMAT10'])
            ->assertRedirect(route('checkout.index'));

        $this->assertEquals('HEMAT10', session(VoucherService::SESSION_KEY)['code']);

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

        $order = \App\Models\Order::query()->latest('id')->first();
        $this->assertNotNull($order);
        $this->assertEquals('HEMAT10', $order->voucher_code);
        $this->assertEquals(100000.0, (float) $order->voucher_discount_amount);
        $this->assertEquals(1000000.0, (float) $order->subtotal_amount);
        $this->assertEquals(
            (float) $order->subtotal_amount + (float) $order->shipping_amount - (float) $order->voucher_discount_amount,
            (float) $order->total_amount
        );
    }
}
