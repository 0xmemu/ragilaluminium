<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Promotion;
use App\Models\PromotionItem;
use App\Models\StoreVoucher;
use App\Models\User;
use App\Services\CampaignService;
use App\Services\OrderService;
use App\Services\PriceService;
use App\Services\VoucherService;
use App\Support\CodSettings;
use App\Support\FlashSalePeriodSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Fase 12 — Promo, voucher, Flash Sale, COD.
 * Mengunci urutan kalkulasi finansial eksplisit + persyaratan turunan.
 */
class PricePromoOrderContractTest extends TestCase
{
    use RefreshDatabase;

    private function product(string $sku): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$sku,
            'short_name' => $sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    private function cart(array $items): array
    {
        $out = [];
        foreach ($items as $it) {
            $out[$it['variant_sku']] = [
                'line_id' => $it['variant_sku'],
                'parent_sku' => $it['parent_sku'],
                'variant_sku' => $it['variant_sku'],
                'name' => 'Produk '.$it['parent_sku'],
                'unit_price' => $it['price'],
                'quantity' => $it['quantity'],
            ];
        }

        return $out;
    }

    private function place(array $cart, string $payment, float $shippingCost, float $shippingSubsidy, ?array $voucher): \App\Models\Order
    {
        $this->withSession(['ragil_cart' => $cart]);

        return app(OrderService::class)->createFromCart(
            customer: ['name' => 'Budi', 'phone' => '081234567890', 'notes' => null],
            shipping: ['address_line1' => 'Jl. Contoh 1', 'city' => 'Semarang', 'province' => 'Jawa Tengah', 'postal_code' => '50254'],
            paymentMethod: $payment,
            shippingCost: $shippingCost,
            voucher: $voucher,
            shippingSubsidy: $shippingSubsidy,
            idempotencyKey: (string) Str::uuid(),
        );
    }

    /** Rule 2 — Flash Sale diterapkan PER VARIASI (tiap variasi memakai bandrolnya sendiri). */
    public function test_flash_sale_discount_applies_per_variant_price(): void
    {
        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subHour()->toIso8601String(),
            'ends_at' => now()->addDay()->toIso8601String(),
        ]);

        $p = $this->product('P-FSVAR');
        $v1 = ProductVariant::create(['product_id' => $p->id, 'variant_sku' => 'P-FSVAR-V1', 'price' => 1000000, 'stock' => 5, 'status' => 'active']);
        $v2 = ProductVariant::create(['product_id' => $p->id, 'variant_sku' => 'P-FSVAR-V2', 'price' => 2000000, 'stock' => 5, 'status' => 'active']);

        $flash = Promotion::create([
            'type' => Promotion::TYPE_FLASH_SALE,
            'name' => 'FS Varian 1',
            'status' => Promotion::STATUS_ACTIVE,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'discount_percent' => 20,
        ]);
        PromotionItem::create(['promotion_id' => $flash->id, 'target_type' => 'product', 'target_id' => (string) $p->id]);

        app(CampaignService::class)->flushCache();

        $p1 = app(PriceService::class)->forVariant($v1, $p);
        $this->assertTrue($p1['flash_sale']);
        $this->assertEquals(800000.0, (float) $p1['sale']); // 1.000.000 x 0.8

        $p2 = app(PriceService::class)->forVariant($v2, $p);
        $this->assertTrue($p2['flash_sale']);
        $this->assertEquals(1600000.0, (float) $p2['sale']); // 2.000.000 x 0.8 -> bandrol variasi sendiri

        // Di order, variasi V2 dipotong pakai bandrol variannya sendiri, bukan harga variasi lain.
        $order = $this->place(
            $this->cart([['parent_sku' => 'P-FSVAR', 'variant_sku' => 'P-FSVAR-V2', 'price' => 2000000, 'quantity' => 1]]),
            'transfer', 0, 0, null,
        );
        $this->assertEquals(1600000.0, (float) $order->subtotal_amount);
        $this->assertEquals(1600000.0, (float) $order->items->first()->unit_price);
        $this->assertNotEquals(800000.0, (float) $order->items->first()->unit_price);
    }

    /** Rule 1 — urutan eksplisit: promo produk -> voucher -> subsidi ongkir -> biaya COD. */
    public function test_calculation_order_promo_voucher_subsidy_cod_is_explicit_and_consistent(): void
    {
        CodSettings::update(['enabled' => true, 'fee_type' => 'percent', 'fee_value' => 10, 'max_order_amount' => null]);

        $p = $this->product('P-ORDER');
        $v = ProductVariant::create(['product_id' => $p->id, 'variant_sku' => 'P-ORDER-V1', 'price' => 1000000, 'stock' => 5, 'status' => 'active']);

        $store = Promotion::create([
            'type' => Promotion::TYPE_STORE,
            'name' => 'Promo Toko 10%',
            'status' => Promotion::STATUS_ACTIVE,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'discount_percent' => 10,
        ]);
        PromotionItem::create(['promotion_id' => $store->id, 'target_type' => 'product', 'target_id' => (string) $p->id]);

        StoreVoucher::create([
            'name' => 'HEMAT 10%', 'code' => 'HEMAT10',
            'discount_type' => 'percent', 'discount_value' => 10,
            'min_purchase' => 0, 'published' => true,
        ]);

        app(CampaignService::class)->flushCache();

        // Promo produk 10% -> 1.000.000 -> 900.000 (sale) di subtotal.
        $subtotal = 900000.0;
        // Voucher 10% atas subtotal efektif (post-promo).
        $voucher = app(VoucherService::class)->applyCodes(['HEMAT10'], $subtotal);
        $this->assertEquals(90000.0, (float) $voucher['discount']);

        // Subsidi ongkir sudah diterapkan ke shippingCost (net); COD dihitung atas subtotal setelah voucher.
        $order = $this->place(
            $this->cart([['parent_sku' => 'P-ORDER', 'variant_sku' => 'P-ORDER-V1', 'price' => 1000000, 'quantity' => 1]]),
            'cod', 50000, 20000, $voucher,
        );

        $this->assertEquals(900000.0, (float) $order->subtotal_amount);
        $this->assertEquals(90000.0, (float) $order->voucher_discount_amount);
        $this->assertEquals(50000.0, (float) $order->shipping_amount);
        $this->assertEquals(20000.0, (float) $order->shipping_subsidy_amount);
        // COD = 10% dari (900000 - 90000) = 81000.
        $this->assertEquals(81000.0, (float) $order->cod_fee_amount);
        // total = subtotal + ongkir(net) - voucher + COD.
        $this->assertEquals(941000.0, (float) $order->total_amount);
        $this->assertEquals(
            (float) $order->subtotal_amount + (float) $order->shipping_amount
                - (float) $order->voucher_discount_amount + (float) $order->cod_fee_amount,
            (float) $order->total_amount
        );
    }

    /** Rule 3 — voucher tidak mengubah harga dasar histori. */
    public function test_voucher_keeps_historical_base_price_untouched(): void
    {
        $p = $this->product('P-HIST');
        $v = ProductVariant::create(['product_id' => $p->id, 'variant_sku' => 'P-HIST-V1', 'price' => 1000000, 'stock' => 5, 'status' => 'active']);

        StoreVoucher::create([
            'name' => 'HEMAT 10%', 'code' => 'HIST10',
            'discount_type' => 'percent', 'discount_value' => 10,
            'min_purchase' => 0, 'published' => true,
        ]);

        $voucher = app(VoucherService::class)->applyCodes(['HIST10'], 1000000.0);
        $order = $this->place(
            $this->cart([['parent_sku' => 'P-HIST', 'variant_sku' => 'P-HIST-V1', 'price' => 1000000, 'quantity' => 1]]),
            'transfer', 0, 0, $voucher,
        );

        // Voucher tidak mengubah subtotal (harga dasar histori) maupun harga baris.
        $this->assertEquals(1000000.0, (float) $order->subtotal_amount);
        $this->assertEquals(100000.0, (float) $order->voucher_discount_amount);
        $this->assertEquals(1000000.0, (float) $order->items->first()->unit_price);
        // Harga varian permanen tidak berubah.
        $this->assertEquals(1000000.0, (float) $v->fresh()->price);
        $this->assertEquals('HIST10', $order->voucher_code);
    }

    /** Rule 4 — perubahan finansial voucher dicatat (audit log). */
    public function test_voucher_financial_changes_are_audited(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.vouchers.store'), [
                'name' => 'Audit', 'code' => 'AUDIT10', 'discount_type' => 'percent',
                'discount_value' => 10, 'min_purchase' => 0, 'publish_now' => true,
            ])
            ->assertRedirect(route('admin.vouchers.index'));

        $voucher = StoreVoucher::query()->where('code', 'AUDIT10')->firstOrFail();
        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'product.voucher.created',
            'entity_type' => 'voucher',
            'entity_id' => $voucher->id,
        ]);
        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'product.voucher.published',
            'entity_type' => 'voucher',
            'entity_id' => $voucher->id,
        ]);
    }

    /** Rule 5 — UI admin menampilkan alasan voucher tidak dapat digunakan. */
    public function test_admin_index_exposes_voucher_unusable_reason(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        StoreVoucher::create([
            'name' => 'Masih Aktif', 'code' => 'RUN0', 'discount_type' => 'percent', 'discount_value' => 5,
            'published' => true, 'starts_at' => now()->subHour(), 'ends_at' => now()->addDay(),
        ]);
        StoreVoucher::create([
            'name' => 'Sudah Habis', 'code' => 'END0', 'discount_type' => 'percent', 'discount_value' => 5,
            'published' => true, 'ends_at' => now()->subDay(),
        ]);

        // Pastikan urutan deterministik: 'Sudah Habis' (baru) didahulukan via updated_at terbaru.
        \Illuminate\Support\Facades\DB::table('store_vouchers')->where('code', 'RUN0')
            ->update(['updated_at' => now()->subDay()]);

        app(CampaignService::class)->flushCache();

        $response = $this->actingAs($admin)->get(route('admin.vouchers.index'));
        $response->assertOk();
        $response->assertInertia(function ($page) {
            return $page->component('Admin/Vouchers/Index')
                ->where('vouchers.0.reason', fn (string $reason) => str_contains($reason, 'sudah berakhir'))
                ->where('vouchers.0.runnable', false)
                ->where('vouchers.1.reason', null)
                ->where('vouchers.1.runnable', true);
        });
    }
}
