<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Kontrak Opsi B (2026-09-24): relasi kategori aktif berbasis product_category.
 *
 * Sumber kebenaran kategori adalah products.product_category yang dicocokkan ke
 * categories.code. Kolom products.category_id adalah kolom warisan ID kategori
 * Shopee (keputusan owner 2026-09-03) dan tidak lagi dipakai relasi apa pun.
 */
class CategoryProductRelationTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    /** Kategori baru dibuat lewat form admin, jadi kodenya otomatis dari nama. */
    protected function createCategory(string $name): Category
    {
        $this->actingAs($this->admin())->post(route('admin.categories.store'), [
            'name' => $name,
            'is_active' => true,
        ]);

        $category = Category::where('name', $name)->first();
        $this->assertNotNull($category, 'Kategori gagal dibuat.');

        return $category;
    }

    protected function createProduct(string $productCategory, array $overrides = []): Product
    {
        return Product::create(array_merge([
            'parent_sku' => 'KAT-' . strtoupper(uniqid()),
            'name' => 'Produk Kategori ' . $productCategory,
            'product_category' => $productCategory,
            'product_model' => 'JUNGKIT',
            'status' => 'active',
        ], $overrides));
    }

    public function test_products_relation_matches_by_category_code(): void
    {
        $category = $this->createCategory('Kusen Aluminium');
        $this->createProduct($category->code);
        $this->createProduct($category->code);

        $this->assertSame(2, $category->products()->count());
        $this->assertSame(2, Category::withCount('products')->find($category->id)->products_count);
    }

    public function test_new_category_without_hardcoded_list_is_counted(): void
    {
        // Kategori di luar tiga kategori lama (Jendela/Pintu/Boven) tetap ikut
        // terhitung: relasi memakai kode dari tabel, bukan daftar tetap.
        $category = $this->createCategory('Kusen Kaca Panel');
        $this->createProduct($category->code);

        $this->assertSame(1, $category->products()->count());
    }

    public function test_destroy_blocks_category_that_still_has_products(): void
    {
        $category = $this->createCategory('Kusen Terpakai');
        $product = $this->createProduct($category->code);

        $response = $this->actingAs($this->admin())
            ->delete(route('admin.categories.destroy', $category));

        $response->assertRedirect();
        $response->assertSessionHas('error');
        $this->assertDatabaseHas('categories', ['id' => $category->id]);
        $this->assertDatabaseHas('products', ['id' => $product->id]);
    }

    public function test_destroy_allows_category_without_products(): void
    {
        $category = $this->createCategory('Kusen Kosong');

        $response = $this->actingAs($this->admin())
            ->delete(route('admin.categories.destroy', $category));

        $response->assertRedirect(route('admin.categories.index'));
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    }

    public function test_update_blocks_code_change_when_category_in_use(): void
    {
        $category = $this->createCategory('Kusen Terkunci');
        $this->createProduct($category->code);

        $response = $this->actingAs($this->admin())
            ->put(route('admin.categories.update', $category), [
                'name' => $category->name,
                'code' => 'KODE_BARU',
            ]);

        $response->assertSessionHasErrors('code');
        $this->assertDatabaseHas('categories', ['id' => $category->id, 'code' => $category->code]);
    }

    public function test_update_allows_code_change_when_category_unused(): void
    {
        $category = $this->createCategory('Kusen Bebas');

        $response = $this->actingAs($this->admin())
            ->put(route('admin.categories.update', $category), [
                'name' => $category->name,
                'code' => 'KUSEN_BEBAS_BARU',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('categories', ['id' => $category->id, 'code' => 'KUSEN_BEBAS_BARU']);
    }

    public function test_update_keeps_code_when_admin_only_renames(): void
    {
        $category = $this->createCategory('Kusen Ganti Nama');
        $this->createProduct($category->code);

        // Ubah nama saja tanpa mengisi kode: kode harus tetap, bukan dibuat ulang
        // dari nama, supaya pencocokan produk tidak patah.
        $response = $this->actingAs($this->admin())
            ->put(route('admin.categories.update', $category), [
                'name' => 'Kusen Nama Baru',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('categories', ['id' => $category->id, 'code' => $category->code]);
    }

    public function test_product_write_rejects_legacy_category_codes(): void
    {
        Event::fake();

        $admin = $this->admin();

        foreach (['WINDOW', 'DOOR', 'BOUVEN'] as $legacy) {
            $response = $this->actingAs($admin)->post(route('admin.products.store'), [
                'workflow' => 'wizard',
                'name' => 'Produk kode warisan ' . $legacy,
                'product_category' => $legacy,
                'product_model' => 'JUNGKIT',
                'status' => 'archived',
            ]);

            $response->assertSessionHasErrors('product_category');
            $this->assertDatabaseMissing('products', ['product_category' => $legacy]);
        }
    }

    public function test_category_id_is_not_written_by_product_form(): void
    {
        Event::fake();

        $category = $this->createCategory('Kusen Tanpa Kolom Warisan');

        $this->actingAs($this->admin())->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Produk tanpa kolom warisan',
            'category_id' => $category->id,
            'product_category' => $category->code,
            'product_model' => 'JUNGKIT',
            'status' => 'archived',
        ]);

        // Jalur tulis tidak pernah mengisi category_id: relasi aktif memakai kode.
        $this->assertDatabaseHas('products', [
            'product_category' => $category->code,
            'category_id' => null,
        ]);
    }
}
