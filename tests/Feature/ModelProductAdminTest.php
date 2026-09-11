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
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        Product::create([
            'parent_sku' => 'WIN-MOD-2',
            'name' => 'Jendela Sliding 2',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'ORNAMEN',
            'status' => 'archived',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.model-products.sync'))
            ->assertRedirect(route('admin.model-products.index'));

        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
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

        // Kontrak owner 2026-09-10: wadah kosong (0 produk aktif) tidak tampil
        // di storefront. Model dengan produk tetap tampil.
        CmsModelProduct::create([
            'name' => 'Jendela Aluminium Kaca Mati',
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'status' => 'active',
            'sort_order' => 9,
        ]);

        $pairOf = fn (array $card) => strtoupper((string) $card['category']).'|'.strtoupper((string) $card['model']);

        $cards = app(\App\Services\ModelProductService::class)->storefrontCards();
        $this->assertContains('JENDELA|SLIDING', array_map($pairOf, $cards));
        $this->assertNotContains('JENDELA|KACA_MATI', array_map($pairOf, $cards));

        // Auto-arsip: sinkronisasi mematikan pasangan CMS yang tidak punya
        // produk aktif lagi (kontrak owner: wadah = produk yang bisa dibeli).
        // Pasangan yang masih punya produk aktif tidak disentuh.
        Product::create([
            'parent_sku' => 'WIN-OLD-1',
            'name' => 'Jendela Swing Lama',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'status' => 'archived',
        ]);
        CmsModelProduct::create([
            'name' => 'Jendela Aluminium Swing',
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'status' => 'active',
            'sort_order' => 10,
        ]);

        $result = app(\App\Services\ModelProductService::class)->syncFromCatalog($admin->id);
        $this->assertSame(0, $result['created']);
        $this->assertSame(2, $result['archived']);
        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'status' => 'draft',
        ]);
        // Pasangan yang masih punya produk arsip tidak diarsipkan.
        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'status' => 'active',
        ]);

        // Setelah diarsip otomatis, baris harus diaktifkan admin (satu klik)
        // untuk tampil lagi, agar model yang disembunyikan admin sengaja
        // tidak bangkit sendiri. Setelah diaktifkan + wadah terisi, tampil.
        $cardsStillHidden = app(\App\Services\ModelProductService::class)->storefrontCards();
        $this->assertNotContains('JENDELA|KACA_MATI', array_map($pairOf, $cardsStillHidden));

        Product::create([
            'parent_sku' => 'WIN-MOD-3',
            'name' => 'Jendela Kaca Mati 1',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        CmsModelProduct::query()
            ->where('product_category', 'JENDELA')
            ->where('product_model', 'KACA_MATI')
            ->update(['status' => 'active']);

        $cardsAfter = app(\App\Services\ModelProductService::class)->storefrontCards();
        $this->assertContains('JENDELA|KACA_MATI', array_map($pairOf, $cardsAfter));

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
            'product_category' => 'JENDELA',
            'product_model' => 'JENDELA_JUNGKIT_UNGGULAN',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.model-products.store'), [
                'name' => 'Jendela Jungkit Unggulan',
                'product_category' => 'JENDELA',
                'image_url' => 'https://cdn.example.com/jungkit.jpg',
                'description' => 'Deskripsi jungkit dari admin untuk halaman detail model.',
                'type' => 'polos',
                'status' => 'active',
                'sort_order' => 0,
            ])
            ->assertRedirect(route('admin.model-products.index'));

        $this->assertDatabaseHas('cms_model_products', [
            'product_model' => 'JENDELA_JUNGKIT_UNGGULAN',
            'description' => 'Deskripsi jungkit dari admin untuk halaman detail model.',
        ]);

        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Home')
                ->where('modelCards.0.title', 'Jendela Jungkit Unggulan')
                ->where('modelCards.0.model', 'JENDELA_JUNGKIT_UNGGULAN')
                ->where('modelCards.0.desc', 'Deskripsi jungkit dari admin untuk halaman detail model.')
                ->where('modelCards.0.subtitle', null));

        $this->get(route('catalog.model', ['category' => 'jendela', 'model' => 'jendela-jungkit-unggulan']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/ModelDetail')
                ->where('model.desc', 'Deskripsi jungkit dari admin untuk halaman detail model.')
                ->where('model.subtitle', null));
    }
}
