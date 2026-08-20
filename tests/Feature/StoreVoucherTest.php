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

    public function test_admin_can_create_and_publish_multiple_vouchers(): void
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
            'published' => true,
        ]);
    }

    public function test_multiple_vouchers_stack_only_when_each_voucher_allows_it(): void
    {
        StoreVoucher::create([
            'name' => 'Stack sepuluh',
            'code' => 'STACK10',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'stackable' => true,
            'published' => true,
        ]);
        StoreVoucher::create([
            'name' => 'Stack lima',
            'code' => 'STACK5',
            'discount_type' => 'percent',
            'discount_value' => 5,
            'stackable' => true,
            'published' => true,
        ]);
        StoreVoucher::create([
            'name' => 'Tidak stack',
            'code' => 'NOSTACK',
            'discount_type' => 'fixed',
            'discount_value' => 10000,
            'stackable' => false,
            'published' => true,
        ]);

        $applied = app(VoucherService::class)->applyCodes(['STACK10', 'STACK5'], 1000000);

        $this->assertSame(['STACK10', 'STACK5'], $applied['codes']);
        $this->assertSame(145000.0, (float) $applied['discount']);
        $this->assertCount(2, $applied['vouchers']);

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('tidak dapat digabung');
        app(VoucherService::class)->applyCodes(['STACK10', 'NOSTACK'], 1000000);
    }

    public function test_voucher_uses_effective_price_after_product_promotion(): void
    {
        StoreVoucher::create([
            'name' => 'Harga efektif',
            'code' => 'EFFECTIVE10',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'published' => true,
        ]);

        $applied = app(VoucherService::class)->applyCodes(['EFFECTIVE10'], 800000);

        $this->assertSame(80000.0, (float) $applied['discount']);
    }

    public function test_admin_can_duplicate_and_end_voucher(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $voucher = StoreVoucher::create([
            'name' => 'Voucher Asli',
            'code' => 'ASLI10',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'min_purchase' => 500000,
            'stackable' => true,
            'published' => true,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.vouchers.duplicate', $voucher))
            ->assertRedirect();

        $copy = StoreVoucher::query()->where('code', 'ASLI10_COPY')->first();
        $this->assertNotNull($copy);
        $this->assertFalse((bool) $copy->published);
        $this->assertTrue((bool) $copy->stackable);
        $this->assertSame(500000.0, (float) $copy->min_purchase);

        $this->actingAs($admin)
            ->post(route('admin.vouchers.end', $voucher))
            ->assertRedirect();

        $voucher->refresh();
        $this->assertFalse((bool) $voucher->published);
        $this->assertNotNull($voucher->ends_at);
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

    /** Voucher bertarget model: potongan hanya atas baris model tsb. */
    public function test_voucher_targeted_to_model_applies_only_to_matching_model_lines(): void
    {
        StoreVoucher::create([
            'name' => 'Model Sliding',
            'code' => 'SLID10',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'target_type' => 'model',
            'target_model' => 'SLIDING',
            'published' => true,
        ]);

        $applied = app(VoucherService::class)->applyCodesToLines(['SLID10'], [
            ['product_id' => 1, 'product_model' => 'SLIDING', 'amount' => 500000],
            ['product_id' => 2, 'product_model' => 'JUNGKIT', 'amount' => 300000],
        ]);

        $this->assertSame(50000.0, (float) $applied['discount']);
    }

    /** Voucher bertarget produk: potongan hanya atas baris produk tsb. */
    public function test_voucher_targeted_to_product_applies_only_to_matching_product_lines(): void
    {
        $target = Product::create([
            'parent_sku' => 'WIN-PRD-1',
            'name' => 'Produk Target',
            'short_name' => 'Target',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        StoreVoucher::create([
            'name' => 'Produk Khusus',
            'code' => 'PRODX20',
            'discount_type' => 'fixed',
            'discount_value' => 20000,
            'target_type' => 'product',
            'target_product_id' => $target->id,
            'published' => true,
        ]);

        $applied = app(VoucherService::class)->applyCodesToLines(['PRODX20'], [
            ['product_id' => $target->id, 'product_model' => 'SLIDING', 'amount' => 100000],
            ['product_id' => $target->id + 100, 'product_model' => 'SLIDING', 'amount' => 100000],
        ]);

        $this->assertSame(20000.0, (float) $applied['discount']);
    }

    /** Voucher bertarget menolak ketika keranjang tidak punya produk yang memenuhi. */
    public function test_targeted_voucher_rejects_when_cart_has_no_matching_lines(): void
    {
        StoreVoucher::create([
            'name' => 'Model Sliding',
            'code' => 'SLID10',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'target_type' => 'model',
            'target_model' => 'SLIDING',
            'published' => true,
        ]);

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('hanya berlaku untuk');
        app(VoucherService::class)->applyCodesToLines(['SLID10'], [
            ['product_id' => 3, 'product_model' => 'JUNGKIT', 'amount' => 300000],
        ]);
    }

    /** Minimum pembelian voucher bertarget dihitung dari subtotal produk target (keputusan owner). */
    public function test_targeted_voucher_min_purchase_uses_eligible_subtotal_only(): void
    {
        StoreVoucher::create([
            'name' => 'Min Model',
            'code' => 'SLIDMIN',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'min_purchase' => 400000,
            'target_type' => 'model',
            'target_model' => 'SLIDING',
            'published' => true,
        ]);

        // Belanja SLIDING 300rb (total keranjang 800rb) tetap ditolak: minimum dari eligible.
        try {
            app(VoucherService::class)->applyCodesToLines(['SLIDMIN'], [
                ['product_id' => 1, 'product_model' => 'SLIDING', 'amount' => 300000],
                ['product_id' => 2, 'product_model' => 'JUNGKIT', 'amount' => 500000],
            ]);
            $this->fail('Voucher bertarget seharusnya ditolak karena eligible subtotal di bawah minimum.');
        } catch (\DomainException $e) {
            $this->assertStringContainsString('Minimum belanja', $e->getMessage());
        }

        // Belanja SLIDING 450rb memenuhi minimum; diskon dari 450rb.
        $applied = app(VoucherService::class)->applyCodesToLines(['SLIDMIN'], [
            ['product_id' => 1, 'product_model' => 'SLIDING', 'amount' => 450000],
            ['product_id' => 2, 'product_model' => 'JUNGKIT', 'amount' => 500000],
        ]);
        $this->assertSame(45000.0, (float) $applied['discount']);
    }

    /** Stacking general + bertarget: berurutan, base voucher bertarget = sisa eligible. */
    public function test_general_and_targeted_vouchers_stack_sequentially_on_remaining_eligible_base(): void
    {
        StoreVoucher::create([
            'name' => 'General 10',
            'code' => 'GEN10',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'stackable' => true,
            'published' => true,
        ]);
        StoreVoucher::create([
            'name' => 'Sliding 20',
            'code' => 'SLID20',
            'discount_type' => 'percent',
            'discount_value' => 20,
            'stackable' => true,
            'target_type' => 'model',
            'target_model' => 'SLIDING',
            'published' => true,
        ]);

        $applied = app(VoucherService::class)->applyCodesToLines(['GEN10', 'SLID20'], [
            ['product_id' => 1, 'product_model' => 'SLIDING', 'amount' => 100000],
            ['product_id' => 2, 'product_model' => 'JUNGKIT', 'amount' => 200000],
        ]);

        // GEN10 = 10% x 300rb = 30rb; sisa SLIDING 90rb -> SLID20 = 20% x 90rb = 18rb.
        $this->assertSame(48000.0, (float) $applied['discount']);
        $this->assertCount(2, $applied['vouchers']);
        $this->assertSame('Model Sliding', $applied['vouchers'][1]['target_label']);
    }

    /** Admin dapat membuat voucher bertarget; validasi menolak target tanpa isian. */
    public function test_admin_can_create_targeted_voucher_with_validation(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.vouchers.store'), [
                'name' => 'Khusus Model',
                'code' => 'TARGET-MODEL',
                'discount_type' => 'percent',
                'discount_value' => 15,
                'min_purchase' => 0,
                'target_type' => 'model',
                'target_model' => 'SLIDING',
            ])
            ->assertRedirect(route('admin.vouchers.index'));

        $this->assertDatabaseHas('store_vouchers', [
            'code' => 'TARGET-MODEL',
            'target_type' => 'model',
            'target_model' => 'SLIDING',
            'target_product_id' => null,
        ]);

        // Model target tanpa pilihan model -> validasi gagal.
        $this->actingAs($admin)
            ->post(route('admin.vouchers.store'), [
                'name' => 'Model Kosong',
                'code' => 'TARGET-EMPTY',
                'discount_type' => 'percent',
                'discount_value' => 15,
                'target_type' => 'model',
            ])
            ->assertSessionHasErrors('target_model');

        // Produk target tanpa id produk -> validasi gagal.
        $this->actingAs($admin)
            ->post(route('admin.vouchers.store'), [
                'name' => 'Produk Kosong',
                'code' => 'TARGET-EMPTY2',
                'discount_type' => 'percent',
                'discount_value' => 15,
                'target_type' => 'product',
            ])
            ->assertSessionHasErrors('target_product_id');
    }

    /** Voucher bertarget lewat alur checkout penuh: potongan hanya dari produk eligible. */
    public function test_checkout_targeted_voucher_discounts_only_eligible_product(): void
    {
        $sliding = Product::create([
            'parent_sku' => 'WIN-SLD-1',
            'name' => 'Jendela Sliding',
            'short_name' => 'Sliding',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $sliding->id,
            'variant_sku' => 'WIN-SLD-1-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $jungkit = Product::create([
            'parent_sku' => 'WIN-JKT-1',
            'name' => 'Jendela Jungkit',
            'short_name' => 'Jungkit',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $jungkit->id,
            'variant_sku' => 'WIN-JKT-1-100',
            'price' => 2000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        StoreVoucher::create([
            'name' => 'Sliding 10%',
            'code' => 'SLID10',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'target_type' => 'model',
            'target_model' => 'SLIDING',
            'published' => true,
        ]);

        $this->post(route('cart.add'), [
            'parent_sku' => 'WIN-SLD-1',
            'variant_sku' => 'WIN-SLD-1-100',
            'quantity' => 1,
        ])->assertRedirect();
        $this->post(route('cart.add'), [
            'parent_sku' => 'WIN-JKT-1',
            'variant_sku' => 'WIN-JKT-1-100',
            'quantity' => 1,
        ])->assertRedirect();

        $this->post(route('checkout.voucher.apply'), ['code' => 'SLID10'])
            ->assertRedirect(route('checkout.index'));

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
        // Subtotal penuh 3jt; voucher hanya memotong 10% dari produk SLIDING (1jt).
        $this->assertEquals(3000000.0, (float) $order->subtotal_amount);
        $this->assertEquals(100000.0, (float) $order->voucher_discount_amount);
        $this->assertEquals('SLID10', $order->voucher_code);
    }
}
