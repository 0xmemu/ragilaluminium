<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\FlashSalePeriodSettings;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FlashSalePeriodTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

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

    public function test_live_period_exposes_daily_countdown_until_end_of_day(): void
    {
        $now = Carbon::parse('2026-07-30 15:00:00', config('app.timezone'));
        Carbon::setTestNow($now);

        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => $now->copy()->subHour()->toIso8601String(),
            'ends_at' => $now->copy()->addWeek()->toIso8601String(),
        ]);

        $state = FlashSalePeriodSettings::publicState($now);

        $this->assertTrue($state['live']);
        $this->assertSame(
            $now->copy()->endOfDay()->getTimestamp() - $now->getTimestamp(),
            $state['daily_seconds_remaining'],
        );
        $this->assertSame(
            $now->copy()->endOfDay()->toIso8601String(),
            $state['daily_ends_at'],
        );
    }

    public function test_daily_countdown_caps_at_campaign_end_when_sooner_than_midnight(): void
    {
        $now = Carbon::parse('2026-07-30 15:00:00', config('app.timezone'));
        Carbon::setTestNow($now);
        $ends = $now->copy()->addHours(2);

        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => $now->copy()->subHour()->toIso8601String(),
            'ends_at' => $ends->toIso8601String(),
        ]);

        $state = FlashSalePeriodSettings::publicState($now);

        $this->assertSame(7200, $state['daily_seconds_remaining']);
        $this->assertSame($ends->toIso8601String(), $state['daily_ends_at']);
    }

    public function test_non_live_period_hides_daily_countdown(): void
    {
        $state = FlashSalePeriodSettings::publicState();

        $this->assertNull($state['daily_seconds_remaining']);
        $this->assertNull($state['daily_ends_at']);
    }

    public function test_flash_sale_accepts_sort_price_and_size_query(): void
    {
        $match = $this->seedFlashProduct();
        ProductVariant::where('product_id', $match->id)->update([
            'variation_1_option' => '60 x 120',
            'height_cm' => 60,
            'width_cm' => 120,
            'price' => 400000,
        ]);

        $other = Product::create([
            'parent_sku' => 'WIN-FLASH-P2',
            'name' => 'Jendela Flash Lain',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $other->id,
            'variant_sku' => 'WIN-FLASH-P2-V1',
            'variation_1_option' => '80 x 100',
            'height_cm' => 80,
            'width_cm' => 100,
            'price' => 900000,
            'stock' => 2,
            'status' => 'active',
        ]);
        ProductAttribute::create([
            'product_id' => $other->id,
            'attribute_name' => 'promo_flash_sale',
            'attribute_value' => 'true',
        ]);

        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subHour()->toIso8601String(),
            'ends_at' => now()->addDay()->toIso8601String(),
        ]);

        $this->get(route('catalog.flash-sale', ['sort' => 'terlaris']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('listingMode', 'flash')
                ->where('activeSort', 'terlaris')
                ->has('products', 2));

        $this->get(route('catalog.flash-sale', ['sort' => 'size_asc']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('products.0.parent_sku', 'WIN-FLASH-P1')
                ->where('products.1.parent_sku', 'WIN-FLASH-P2'));

        $this->get(route('catalog.flash-sale', ['sort' => 'size_desc']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('products.0.parent_sku', 'WIN-FLASH-P2')
                ->where('products.1.parent_sku', 'WIN-FLASH-P1'));

        $this->get(route('catalog.flash-sale', [
            'price_min' => 300000,
            'price_max' => 500000,
        ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 1)
                ->where('products.0.parent_sku', 'WIN-FLASH-P1')
                ->where('priceMin', 300000)
                ->where('priceMax', 500000));

        $this->get(route('catalog.flash-sale', ['q' => '60x120']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('searchQuery', '60x120')
                ->has('products', 1)
                ->where('products.0.parent_sku', 'WIN-FLASH-P1'));
    }
}
