<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\AttributeTemplateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Produk tanpa sub model (design_variant kosong).
 *
 * Perilaku yang berlaku saat ini: boleh. Form admin menyediakan opsi
 * "Tanpa sub model" dan validasi design_variant memakai `nullable`, sehingga
 * produk bisa hidup tanpa klasifikasi sub model.
 *
 * Test ini mengunci perilaku itu apa adanya supaya tidak berubah tanpa sengaja,
 * sekaligus mendokumentasikan konsekuensinya.
 */
class ProductWithoutSubModelTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_produk_bisa_dibuat_tanpa_sub_model(): void
    {
        $this->actingAs($this->admin())->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Produk tanpa sub model',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => '',
            'status' => 'archived',
            'homepage_popular' => false,
        ])->assertRedirect();

        $product = Product::where('name', 'Produk tanpa sub model')->firstOrFail();

        $this->assertNull($product->design_variant);
    }

    public function test_produk_bisa_dibuat_tanpa_mengirim_field_sub_model_sama_sekali(): void
    {
        $this->actingAs($this->admin())->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Produk tanpa field sub model',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'status' => 'archived',
            'homepage_popular' => false,
        ])->assertRedirect();

        $product = Product::where('name', 'Produk tanpa field sub model')->firstOrFail();

        $this->assertNull($product->design_variant);
    }

    public function test_sub_model_yang_tidak_cocok_dengan_model_tetap_ditolak(): void
    {
        // Kode sub model yang tidak terdaftar untuk model mana pun harus ditolak.
        $this->actingAs($this->admin())->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Produk salah sub model',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SWING',
            'design_variant' => 'KODE_TIDAK_TERDAFTAR',
            'status' => 'archived',
            'homepage_popular' => false,
        ])->assertSessionHasErrors('design_variant');

        $this->assertNull(Product::where('name', 'Produk salah sub model')->first());
    }

    public function test_produk_tanpa_sub_model_tetap_dapat_dibuka_di_katalog(): void
    {
        $product = Product::create([
            'parent_sku' => 'RATANPASUB01',
            'name' => 'Tanpa Sub Model',
            'short_name' => 'Tanpa Sub',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => null,
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RATANPASUB01-A',
            'price' => 900000,
            'stock' => 3,
            'status' => 'active',
        ]);

        $this->get('/product/RATANPASUB01')->assertOk();
    }

    public function test_atribut_produk_tanpa_sub_model_memakai_template_default_model(): void
    {
        $product = Product::create([
            'parent_sku' => 'RATANPASUB02',
            'name' => 'Tanpa Sub Model Atribut',
            'short_name' => 'Tanpa Sub',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => null,
            'status' => 'archived',
        ]);

        // ADR-019: tanpa sub model, atribut jatuh ke template default model.
        \App\Models\SubModelAttributeTemplate::create([
            'sub_model_id' => null,
            'product_model' => 'SLIDING',
            'attribute_name' => 'Bahan',
            'attribute_value' => 'Aluminium',
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $applied = app(AttributeTemplateService::class)->applyToProduct($product);

        $this->assertSame(1, $applied, 'Template default model tetap terpakai walau tanpa sub model.');
        $this->assertSame('Aluminium', $product->attributes()->first()->attribute_value);
    }

    public function test_produk_tanpa_sub_model_tidak_masuk_daftar_sub_model_mana_pun(): void
    {
        Product::create([
            'parent_sku' => 'RATANPASUB03',
            'name' => 'Tanpa Sub Model Hitung',
            'short_name' => 'Tanpa Sub',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => null,
            'status' => 'active',
        ]);

        // Relasi sub model memakai design_variant = sub_models.code, jadi produk
        // tanpa sub model tidak terhitung di sub model mana pun. Ini yang membuat
        // produk semacam itu "tak terlihat" di navigasi berbasis sub model.
        $terhitung = \Illuminate\Support\Facades\DB::table('products')
            ->join('sub_models', function ($join) {
                $join->on('sub_models.code', '=', 'products.design_variant')
                    ->on('sub_models.product_model', '=', 'products.product_model');
            })
            ->where('products.parent_sku', 'RATANPASUB03')
            ->count();

        $this->assertSame(0, $terhitung);
    }
}
