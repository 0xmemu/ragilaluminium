<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ModelProductAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_sync_list_and_reorder_model_products(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Product::create([
            'parent_sku' => 'WIN-MOD-1',
            'name' => 'Jendela Sliding 1',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        Product::create([
            'parent_sku' => 'WIN-MOD-2',
            'name' => 'Jendela Sliding 2',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'ORNAMEN',
            'status' => 'archived',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.model-products.sync'))
            ->assertRedirect(route('admin.model-products.index'));

        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.model-products.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ModelProducts/Index')
                ->has('rows', 1)
                ->where('rows.0.active_count', 1)
                ->where('rows.0.archived_count', 1)
                ->where('rows.0.sub_model_count', 2));

        $item = CmsModelProduct::query()->first();
        $this->actingAs($admin)
            ->put(route('admin.model-products.reorder'), [
                'rows' => [
                    ['id' => $item->id, 'sort_order' => 5],
                ],
            ])
            ->assertRedirect(route('admin.model-products.index'));

        $this->assertSame(5, (int) $item->fresh()->sort_order);
    }

    public function test_admin_can_create_and_home_uses_cms_model_order(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Product::create([
            'parent_sku' => 'WIN-JUNG-1',
            'name' => 'Jungkit',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.model-products.store'), [
                'name' => 'Jendela Jungkit Unggulan',
                'product_category' => 'WINDOW',
                'product_model' => 'JUNGKIT',
                'image_url' => 'https://cdn.example.com/jungkit.jpg',
                'type' => 'polos',
                'status' => 'active',
                'sort_order' => 0,
            ])
            ->assertRedirect(route('admin.model-products.index'));

        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Home')
                ->where('modelCards.0.title', 'Jendela Jungkit Unggulan')
                ->where('modelCards.0.model', 'JUNGKIT'));
    }
}
