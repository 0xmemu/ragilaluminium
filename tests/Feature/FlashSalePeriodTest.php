<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\FlashSalePeriodSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FlashSalePeriodTest extends TestCase
{
    use RefreshDatabase;

    private function seedFlashProduct(): Product
    {
        $product = Product::create([
            'parent_sku' => 'WIN-FLASH-P1',
            'name' => 'Jendela Flash Period',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-FLASH-P1-V1',
            'price' => 500000,
            'stock' => 3,
            'status' => 'active',
        ]);
        ProductAttribute::create([
            'product_id' => $product->id,
            'attribute_name' => 'promo_flash_sale',
            'attribute_value' => 'true',
        ]);

        return $product;
    }

    public function test_storefront_hides_flash_listing_when_period_disabled(): void
    {
        $this->seedFlashProduct();

        $this->get(route('catalog.flash-sale'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('listingMode', 'flash')
                ->where('flashSalePeriod.status', 'disabled')
                ->has('products', 0));
    }

    public function test_storefront_shows_flash_listing_when_period_live(): void
    {
        $this->seedFlashProduct();
        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subHour()->toIso8601String(),
            'ends_at' => now()->addDay()->toIso8601String(),
        ]);

        $this->get(route('catalog.flash-sale'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('flashSalePeriod.live', true)
                ->where('flashSalePeriod.status', 'live')
                ->has('products', 1)
                ->where('products.0.parent_sku', 'WIN-FLASH-P1'));

        $this->get(route('catalog.promo'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('flashSaleSpotlight', 1));
    }

    public function test_storefront_hides_flash_when_period_scheduled_or_ended(): void
    {
        $this->seedFlashProduct();

        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->addDay()->toIso8601String(),
            'ends_at' => now()->addDays(3)->toIso8601String(),
        ]);

        $this->get(route('catalog.flash-sale'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('flashSalePeriod.status', 'scheduled')
                ->has('products', 0));

        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subDays(3)->toIso8601String(),
            'ends_at' => now()->subHour()->toIso8601String(),
        ]);

        $this->get(route('catalog.flash-sale'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('flashSalePeriod.status', 'ended')
                ->has('products', 0));
    }

    public function test_admin_can_update_flash_sale_period(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->put(route('admin.flash-sale.period'), [
                'enabled' => true,
                'starts_at' => now()->subHour()->format('Y-m-d H:i:s'),
                'ends_at' => now()->addDay()->format('Y-m-d H:i:s'),
            ])
            ->assertRedirect(route('admin.flash-sale.index'));

        $this->assertTrue(FlashSalePeriodSettings::isLive());

        $this->actingAs($admin)
            ->get(route('admin.flash-sale.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/FlashSale/Index')
                ->where('period.live', true)
                ->where('period.status', 'live'));
    }
}
