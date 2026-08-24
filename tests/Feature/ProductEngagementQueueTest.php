<?php

namespace Tests\Feature;

use App\Events\ProductEngagementRecorded;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * P1 Task 5 — Product engagement throttle 30/min + queue async.
 */
class ProductEngagementQueueTest extends TestCase
{
    use RefreshDatabase;

    protected function makeProduct(): Product
    {
        $p = Product::create([
            'parent_sku' => 'WIN-ENG-1', 'name' => 'Window', 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $p->id, 'variant_sku' => 'WIN-ENG-1-V1',
            'price' => 1000000, 'stock' => 5, 'status' => 'active',
        ]);

        return $p;
    }

    public function test_engage_dispatches_async_event_and_returns_ok(): void
    {
        Event::fake([ProductEngagementRecorded::class]);

        $product = $this->makeProduct();

        $this->postJson(route('product.engage', $product), ['action' => 'click'])
            ->assertOk()
            ->assertJson(['ok' => true]);

        Event::assertDispatched(ProductEngagementRecorded::class, fn ($event) =>
            $event->productId === $product->id && $event->action === 'click');
    }

    public function test_engage_throttles_at_30_per_minute(): void
    {
        $product = $this->makeProduct();

        for ($i = 0; $i < 30; $i++) {
            $resp = $this->postJson(route('product.engage', $product), ['action' => 'click']);
            $this->assertNotSame(429, $resp->status(), 'request ke-'.($i + 1));
        }

        $this->postJson(route('product.engage', $product), ['action' => 'click'])
            ->assertStatus(429);
    }

    public function test_engage_accepts_only_click_action(): void
    {
        $product = $this->makeProduct();

        $this->postJson(route('product.engage', $product), ['action' => 'view'])
            ->assertStatus(422);
    }
}