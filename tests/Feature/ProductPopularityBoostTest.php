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
use Illuminate\Support\Facades\Artisan;
use Inertia\Testing\AssertableInertia as Assert;
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
        $this->orderItem($source, 'awaiting_confirmation', 99);
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

    public function test_edit_boost_aktif_menghitung_ulang_seed_dan_membersihkan_target_lama(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $sourceA = $this->product('BOOST-ED-A', 'MODEL-EDA');
        $sourceB = $this->product('BOOST-ED-B', 'MODEL-EDB');
        $targetOld = $this->product('BOOST-ED-T1', 'MODEL-EDT1');
        $targetNew = $this->product('BOOST-ED-T2', 'MODEL-EDT2');

        $this->orderItem($sourceA, 'completed', 3);
        $this->orderItem($sourceB, 'completed', 9);

        $service = app(ProductPopularityService::class);
        $boost = $service->enable($sourceA->id, $targetOld->id, null, $admin->id)['boost'];
        $this->assertSame(3, (int) $targetOld->fresh()->popularity_seed);

        $this->actingAs($admin)
            ->put(route('admin.products.popularity-boosts.update', $boost), [
                'source_product_id' => $sourceB->id,
                'target_product_id' => $targetNew->id,
                'notification_threshold' => 50,
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $fresh = $boost->fresh();
        $this->assertSame($sourceB->id, (int) $fresh->source_product_id);
        $this->assertSame($targetNew->id, (int) $fresh->target_product_id);
        $this->assertSame(9, (int) $fresh->seed_sold_count);
        $this->assertSame(50, (int) $fresh->notification_threshold);

        $this->assertSame(0, (int) $targetOld->fresh()->popularity_seed);
        $this->assertSame(9, (int) $targetNew->fresh()->popularity_seed);
        $this->assertSame($sourceB->id, (int) $targetNew->fresh()->popularity_seed_source_product_id);
        $this->assertDatabaseHas('event_logs', ['event_type' => ProductPopularityService::EVENT_UPDATED]);
    }

    public function test_edit_ke_pasangan_yang_sudah_ada_ditolak(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $a = $this->product('BOOST-ED2-A', 'MODEL-ED2A');
        $b = $this->product('BOOST-ED2-B', 'MODEL-ED2B');
        $c = $this->product('BOOST-ED2-C', 'MODEL-ED2C');

        $service = app(ProductPopularityService::class);
        $boost = $service->enable($a->id, $b->id, null, $admin->id)['boost'];
        $service->enable($b->id, $c->id, null, $admin->id);

        $this->actingAs($admin)
            ->put(route('admin.products.popularity-boosts.update', $boost), [
                'source_product_id' => $b->id,
                'target_product_id' => $c->id,
            ])
            ->assertSessionHasErrors('target_product_id');

        $this->assertSame($a->id, (int) $boost->fresh()->source_product_id);
    }

    public function test_hapus_boost_aktif_mengosongkan_seed_dan_menghapus_baris(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $source = $this->product('BOOST-DEL-S2', 'MODEL-DELS2');
        $target = $this->product('BOOST-DEL-T2', 'MODEL-DELT2');
        $this->orderItem($source, 'completed', 6);
        $this->orderItem($target, 'completed', 2);

        $service = app(ProductPopularityService::class);
        $boost = $service->enable($source->id, $target->id, null, $admin->id)['boost'];

        $this->assertSame(6, (int) $target->fresh()->popularity_seed);

        $this->actingAs($admin)
            ->delete(route('admin.products.popularity-boosts.destroy', $boost))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('product_popularity_boosts', ['id' => $boost->id]);
        $this->assertDatabaseHas('event_logs', ['event_type' => ProductPopularityService::EVENT_DELETED]);

        $target->refresh();
        $this->assertSame(0, (int) $target->popularity_seed);
        $this->assertNull($target->popularity_seed_source_product_id);
    }

    public function test_index_menampilkan_metrik_ulasan_sumber_yang_diwaris(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $source = $this->product('BOOST-REV-S', 'MODEL-REVS');
        $target = $this->product('BOOST-REV-T', 'MODEL-REVT');
        $page = CmsPage::create(['slug' => 'testimonials-rev', 'title' => 'Ulasan', 'published' => true]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id, 'product_id' => $source->id, 'customer_name' => 'Rina',
            'message' => 'Bagus', 'rating' => 5, 'source' => 'website', 'published' => true,
        ]);
        CmsTestimonial::create([
            'cms_page_id' => $page->id, 'product_id' => $source->id, 'customer_name' => 'Dodi',
            'message' => 'Mantap', 'rating' => 4, 'source' => 'website', 'published' => true,
        ]);
        CmsTestimonial::create([
            'cms_page_id' => $page->id, 'product_id' => $source->id, 'customer_name' => 'Eka',
            'message' => 'Draft', 'rating' => 1, 'source' => 'website', 'published' => false,
        ]);

        app(ProductPopularityService::class)->enable($source->id, $target->id, null, $admin->id);

        $this->actingAs($admin)
            ->get(route('admin.products.popularity-boosts.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('boosts.0.source_review_count', 2)
                ->where('boosts.0.source_avg_rating', 4.5));
    }

    public function test_index_tidak_menghasilkan_notifikasi_ambang(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $source = $this->product('BOOST-IDX-S', 'MODEL-IDXS');
        $target = $this->product('BOOST-IDX-T', 'MODEL-IDXT');

        // Ambang belum tercapai saat enable, lalu penjualan sumber bertambah.
        app(ProductPopularityService::class)->enable($source->id, $target->id, 3, $admin->id);
        $this->orderItem($source, 'completed', 3);
        $this->assertDatabaseMissing('admin_notifications', ['type' => 'product_popularity_boost_threshold']);

        $this->actingAs($admin)
            ->get(route('admin.products.popularity-boosts.index'))
            ->assertOk();

        $this->assertDatabaseMissing('admin_notifications', ['type' => 'product_popularity_boost_threshold']);

        Artisan::call('popularity:evaluate-thresholds');

        $this->assertDatabaseHas('admin_notifications', ['type' => 'product_popularity_boost_threshold']);
    }

    public function test_evaluate_threshold_hanya_mengirim_sekali_meski_dipanggil_ulang(): void
    {
        $source = $this->product('BOOST-RACE-S', 'MODEL-RACES');
        $target = $this->product('BOOST-RACE-T', 'MODEL-RACET');
        $this->orderItem($source, 'completed', 4);

        $service = app(ProductPopularityService::class);
        $this->orderItem($source, 'completed', 4);

        $boost = $service->enable($source->id, $target->id, 4, null)['boost']->fresh();
        // Ambang sudah tercapai, tapi notifikasi belum pernah terkirim
        // (mensimulasikan boost lama sebelum evaluasi ada / job gagal tengah jalan).
        // Bersihkan jejak evaluasi enable() agar mulai dari keadaan belum terkirim.
        $boost->forceFill(['threshold_notified_at' => null])->save();
        \App\Models\AdminNotification::query()->where('type', 'product_popularity_boost_threshold')->delete();
        \App\Models\EventLog::query()->where('event_type', ProductPopularityService::EVENT_THRESHOLD)->delete();

        $this->assertTrue($service->evaluateThreshold($boost->fresh()));
        // Panggilan kedua harus no-op: klaim atomik mencegah notifikasi ganda.
        $this->assertFalse($service->evaluateThreshold($boost->fresh()));
        $this->assertSame(1, \App\Models\AdminNotification::query()
            ->where('type', 'product_popularity_boost_threshold')->count());
        $this->assertSame(1, \App\Models\EventLog::query()
            ->where('event_type', ProductPopularityService::EVENT_THRESHOLD)->count());
    }

    public function test_hapus_permanen_produk_terikat_boost_ditolak(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $source = $this->product('BOOST-DEL-S', 'MODEL-DELS');
        $target = $this->product('BOOST-DEL-T', 'MODEL-DELT');
        app(ProductPopularityService::class)->enable($source->id, $target->id, null, $admin->id);

        $source->update(['status' => 'archived']);

        $this->actingAs($admin)
            ->delete(route('admin.products.destroy', $source))
            ->assertRedirect()
            ->assertSessionHas('error', fn ($error) => str_contains((string) $error, 'Teruskan Popularitas'));

        $this->assertDatabaseHas('products', ['id' => $source->id]);
    }

    private function product(string $sku, string $model): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => 'JENDELA',
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
            'payment_status' => $status === 'pending' ? 'pending' : 'paid',
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


    public function test_reviews_do_not_chain_across_boost_A_to_B_and_B_to_C(): void
    {
        $a = $this->product('BOOST-CHAIN-A', 'MODEL-CHA');
        $b = $this->product('BOOST-CHAIN-B', 'MODEL-CHB');
        $c = $this->product('BOOST-CHAIN-C', 'MODEL-CHC');
        $page = CmsPage::create(['slug' => 'testimonials', 'title' => 'Ulasan', 'published' => true]);

        $reviewA = CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $a->id,
            'customer_name' => 'Rina',
            'message' => 'Ulasan produk A',
            'rating' => 5,
            'source' => 'website',
            'published' => true,
        ]);
        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $b->id,
            'customer_name' => 'Dodi',
            'message' => 'Ulasan produk B',
            'rating' => 4,
            'source' => 'website',
            'published' => true,
        ]);

        $service = app(ProductPopularityService::class);
        $service->enable($a->id, $b->id, null, null);
        $service->enable($b->id, $c->id, null, null);

        // B inherits A directly (A -> B).
        $inheritedB = $service->inheritedTestimonials($b);
        $this->assertSame(2, $inheritedB->count());
        $this->assertTrue($inheritedB->contains('product_id', $a->id));

        // C inherits B only; A's review must NOT propagate through B (no A->B->C chain).
        $inheritedC = $service->inheritedTestimonials($c);
        $this->assertSame(1, $inheritedC->count());
        $this->assertTrue($inheritedC->contains('product_id', $b->id));
        $this->assertFalse($inheritedC->contains('product_id', $a->id));
        $this->assertFalse($inheritedC->contains('id', $reviewA->id));
    }

    public function test_disabling_boost_stops_review_inheritance(): void
    {
        $source = $this->product('BOOST-OFF-S', 'MODEL-OFS');
        $target = $this->product('BOOST-OFF-T', 'MODEL-OFT');
        $page = CmsPage::create(['slug' => 'testimonials', 'title' => 'Ulasan', 'published' => true]);
        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $source->id,
            'customer_name' => 'Sinta',
            'message' => 'Dari sumber',
            'rating' => 5,
            'source' => 'website',
            'published' => true,
        ]);

        $service = app(ProductPopularityService::class);
        $result = $service->enable($source->id, $target->id, null, null);
        $this->assertSame(1, $service->inheritedTestimonials($target)->count());

        $service->disable($result['boost'], 'Fitur dimatikan', null);

        $this->assertSame(0, $service->inheritedTestimonials($target)->count());
    }
}