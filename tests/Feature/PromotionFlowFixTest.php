<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Models\Promotion;
use App\Models\User;
use App\Services\CampaignService;
use App\Services\PriceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PromotionFlowFixTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    protected function product(): Product
    {
        return Product::create([
            'parent_sku' => 'RGL-PROMO-'.uniqid(),
            'name' => 'Produk Promo Test',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    public function test_auto_end_mengakhiri_kampanye_kedaluwarsa(): void
    {
        $this->actingAs($this->admin());
        $campaign = Promotion::create([
            'name' => 'Flash Kedaluwarsa',
            'type' => Promotion::TYPE_FLASH_SALE,
            'status' => Promotion::STATUS_ACTIVE,
            'discount_percent' => 15,
            'starts_at' => now()->subDays(10),
            'ends_at' => now()->subDay(),
        ]);

        $this->get(route('admin.promotions.index', ['type' => 'flash_sale']));

        $this->assertSame(Promotion::STATUS_FINISHED, $campaign->fresh()->status);
    }

    public function test_harga_promo_varian_tersimpan_ke_atribut(): void
    {
        $admin = $this->admin();
        $product = $this->product();

        $this->actingAs($admin)->post(route('admin.products.variants.bulk', $product), [
            'wizard_step' => 'variants',
            'variants' => [[
                'variation_1_name' => 'Warna',
                'variation_1_option' => 'Hitam',
                'price' => '1000000',
                'promo_price' => '1200000',
                'stock' => 5,
                'weight_kg' => '10',
                'width_cm' => '100',
                'height_cm' => '200',
                'depth_cm' => '5',
                'status' => 'active',
            ]],
        ])->assertRedirect();

        $variant = $product->variants()->firstOrFail();
        $attr = ProductAttribute::where('product_variant_id', $variant->id)
            ->where('attribute_name', 'promo_compare_price')->first();
        $this->assertNotNull($attr);
        $this->assertSame('1200000', $attr->attribute_value);

        // PriceService membaca manual compare
        $pricing = app(PriceService::class)->forVariant($variant);
        $this->assertSame(1200000.0, $pricing['compare']);
        $this->assertSame(1000000.0, $pricing['sale']);
        $this->assertSame('manual', $pricing['source']);
    }

    public function test_harga_promo_kosong_menghapus_atribut(): void
    {
        $admin = $this->admin();
        $product = $this->product();
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'V-OLD',
            'price' => 1000000,
            'stock' => 1,
            'status' => 'active',
        ]);
        ProductAttribute::create([
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'attribute_name' => 'promo_compare_price',
            'attribute_value' => '1300000',
            'source' => 'internal',
        ]);

        $this->actingAs($admin)->put(route('admin.variants.update', $variant), [
            'price' => '1000000',
            'promo_price' => '',
            'stock' => 1,
            'status' => 'active',
        ])->assertRedirect();

        $this->assertNull(ProductAttribute::where('product_variant_id', $variant->id)
            ->where('attribute_name', 'promo_compare_price')->first());
    }

    public function test_activate_draft_with_future_date_schedules_it(): void
    {
        $admin = $this->admin();
        $product = $this->product();
        $campaign = Promotion::create([
            'name' => 'Flash Future',
            'type' => Promotion::TYPE_FLASH_SALE,
            'status' => Promotion::STATUS_DRAFT,
            'discount_percent' => 20,
            'starts_at' => now()->addDays(2),
            'ends_at' => now()->addDays(5),
        ]);
        $campaign->items()->create([
            'target_type' => 'product',
            'target_id' => (string) $product->id,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.promotions.activate', $campaign))
            ->assertRedirect();

        $fresh = $campaign->fresh();
        $this->assertSame(Promotion::STATUS_SCHEDULED, $fresh->status);
    }

    public function test_activate_scheduled_campaign_advances_start_time_and_activates_now(): void
    {
        $admin = $this->admin();
        $product = $this->product();
        $campaign = Promotion::create([
            'name' => 'Flash Scheduled to Active',
            'type' => Promotion::TYPE_FLASH_SALE,
            'status' => Promotion::STATUS_SCHEDULED,
            'discount_percent' => 25,
            'starts_at' => now()->addDays(2),
            'ends_at' => now()->addDays(5),
        ]);
        $campaign->items()->create([
            'target_type' => 'product',
            'target_id' => (string) $product->id,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.promotions.activate', $campaign), ['start_now' => true])
            ->assertRedirect();

        $fresh = $campaign->fresh();
        $this->assertSame(Promotion::STATUS_ACTIVE, $fresh->status);
        $this->assertTrue($fresh->starts_at->isPast() || $fresh->starts_at->isCurrentSecond());
    }
}
