<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PromotionProductPickerTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    protected function product(string $sku, string $category, string $model): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => $category,
            'product_model' => $model,
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    public function test_guest_tidak_bisa_akses_picker(): void
    {
        $this->get(route('admin.promotions.products'))
            ->assertRedirect(route('login'));
    }

    public function test_picker_search_dan_filter_kategori_model(): void
    {
        $this->actingAs($this->admin());
        $this->product('PKR-1', 'JENDELA', 'JUNGKIT');
        $this->product('PKR-2', 'JENDELA', 'SLIDING');
        $this->product('PKR-3', 'PINTU', 'JUNGKIT');

        // search nama
        $res = $this->getJson(route('admin.promotions.products', ['q' => 'PKR-1']));
        $res->assertOk()->assertJsonCount(1, 'data');

        // filter kategori + model
        $res = $this->getJson(route('admin.promotions.products', ['category' => 'JENDELA', 'model' => 'SLIDING']));
        $res->assertOk()->assertJsonCount(1, 'data');
        $res->assertJsonPath('data.0.parent_sku', 'PKR-2');

        // data lengkap untuk picker
        $res = $this->getJson(route('admin.promotions.products'));
        $res->assertOk()->assertJsonStructure(['data' => [['id', 'parent_sku', 'name', 'category', 'model', 'price']]]);
    }

    public function test_picker_mengabaikan_produk_arsip(): void
    {
        $this->actingAs($this->admin());
        $this->product('PKR-A1', 'JENDELA', 'JUNGKIT')->update(['status' => 'archived']);
        $this->product('PKR-A2', 'JENDELA', 'JUNGKIT');

        $res = $this->getJson(route('admin.promotions.products'));
        $res->assertOk();
        $skus = collect($res->json('data'))->pluck('parent_sku')->all();
        $this->assertNotContains('PKR-A1', $skus);
        $this->assertContains('PKR-A2', $skus);
    }
}