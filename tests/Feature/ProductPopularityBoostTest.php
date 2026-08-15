<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductPopularityBoost;
use App\Models\User;
use App\Services\ProductPopularityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductPopularityBoostTest extends TestCase
{
    use RefreshDatabase;

    public function test_enable_snapshots_valid_source_sales_without_copying_order_history(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $source = $this->product('BOOST-A', 'MODEL-A');
        $target = $this->product('BOOST-B', 'MODEL-B');

        $this->orderItem($source, 'completed', 7);
        $this->orderItem($source, 'pending_payment', 99);
        $this->orderItem($target, 'completed', 2);

        $result = app(ProductPopularityService::class)->enable($source->id, $target->id, null, $admin->id);

        $target->refresh();
        $this->assertSame(7, (int) $result['seed']);
        $this->assertSame(7, (int) $target->popularity_seed);
        $this->assertSame($source->id, (int) $target->popularity_seed_source_product_id);
        $this->assertSame(2, Order::query()->whereHas('items', fn ($q) => $q->where('product_id', $source->id))->count());
        $this->assertDatabaseHas('product_popularity_boosts', [
            'source_product_id' => $source->id,
            'target_product_id' => $target->id,
            'seed_sold_count' => 7,
            'enabled' => 1,
        ]);
        $this->assertDatabaseHas('event_logs', [
            'event_type' => ProductPopularityService::EVENT_ENABLED,
            'entity_type' => 'product_popularity_boost',
        ]);
    }

    public function test_disable_clears_effective_seed_and_creates_audit_notification(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $source = $this->product('BOOST-C', 'MODEL-C');
        $target = $this->product('BOOST-D', 'MODEL-D');
        $this->orderItem($source, 'completed', 4);

        $service = app(ProductPopularityService::class);
        $result = $service->enable($source->id, $target->id, null, $admin->id);
        $service->disable($result['boost'], 'Model sumber tidak lagi relevan', $admin->id);

        $target->refresh();
        $boost = ProductPopularityBoost::query()->firstOrFail();

        $this->assertFalse((bool) $boost->enabled);
        $this->assertSame(0, (int) $target->popularity_seed);
        $this->assertDatabaseHas('event_logs', ['event_type' => ProductPopularityService::EVENT_DISABLED]);
        $this->assertDatabaseHas('admin_notifications', [
            'type' => 'product_popularity_boost_disabled',
            'related_id' => $boost->id,
        ]);
    }

    public function test_popularity_sort_uses_seed_plus_target_sales(): void
    {
        $source = $this->product('BOOST-SOURCE', 'MODEL-S');
        $target = $this->product('BOOST-TARGET', 'MODEL-T');
        $competitor = $this->product('BOOST-COMP', 'MODEL-C');
        $this->orderItem($source, 'completed', 8);
        $this->orderItem($target, 'completed', 1);
        $this->orderItem($competitor, 'completed', 6);

        app(ProductPopularityService::class)->enable($source->id, $target->id, null, null);

        $ordered = Product::query()
            ->whereIn('id', [$target->id, $competitor->id])
            ->orderByPopularity()
            ->get();

        $this->assertSame($target->id, $ordered->first()->id);
        $this->assertSame(9, (int) $ordered->first()->popularity_seed + (int) $ordered->first()->sold_count);
    }

    public function test_source_reviews_are_inherited_without_exposing_source_product_on_target_pdp(): void
    {
        $source = $this->product('BOOST-E', 'MODEL-E');
        $target = $this->product('BOOST-F', 'MODEL-F');
        $page = CmsPage::create(['slug' => 'testimonials', 'title' => 'Ulasan', 'published' => true]);
        $review = CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $source->id,
            'customer_name' => 'Rina',
            'message' => 'Bagus',
            'rating' => 5,
            'source' => 'website',
            'published' => true,
        ]);

        app(ProductPopularityService::class)->enable($source->id, $target->id, null, null);

        $inherited = app(ProductPopularityService::class)->inheritedTestimonials($target);
        $payload = $inherited->firstOrFail()->toPublicArray(false);

        $this->assertSame($review->id, $inherited->first()->id);
        $this->assertNull($payload['product']);
        $this->assertSame($source->id, (int) $inherited->first()->product_id);
    }

    public function test_threshold_is_notified_once_when_current_source_sales_reach_it(): void
    {
        $source = $this->product('BOOST-G', 'MODEL-G');
        $target = $this->product('BOOST-H', 'MODEL-H');
        $this->orderItem($source, 'completed', 5);

        $result = app(ProductPopularityService::class)->enable($source->id, $target->id, 5, null);

        $this->assertDatabaseHas('admin_notifications', ['type' => 'product_popularity_boost_threshold']);
        $this->assertDatabaseHas('event_logs', ['event_type' => ProductPopularityService::EVENT_THRESHOLD]);
        $this->assertNotNull($result['boost']->fresh()->threshold_notified_at);
    }

    private function product(string $sku, string $model): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => $model,
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    private function orderItem(Product $product, string $status, int $quantity): OrderItem
    {
        $order = Order::create([
            'order_number' => 'RA-BOOST-'.uniqid(),
            'customer_name' => 'Customer Boost',
            'customer_phone' => '08123456789',
            'shipping_address_line1' => 'Jl. Boost 1',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '12190',
            'order_status' => $status,
            'payment_status' => $status === 'pending_payment' ? 'pending' : 'paid',
            'shipping_status' => 'pending_pickup',
            'payment_method' => 'transfer',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
        ]);

        return OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'variant_sku' => $product->parent_sku.'-V1',
            'name' => $product->name,
            'unit_price' => 100000,
            'quantity' => $quantity,
            'line_subtotal' => 100000 * $quantity,
            'line_discount' => 0,
            'line_total' => 100000 * $quantity,
        ]);
    }
}
