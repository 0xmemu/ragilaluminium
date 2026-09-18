<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\AttributeTemplateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Produk tanpa sub model (design_variant kosong) dan sub model bebas.
 *
 * Kontrak owner 2026-09-18: sub model OPSIONAL dan sistem tidak ketat soal
 * daftar sub model. Dua hal yang dikunci test ini:
 *  1. Produk boleh hidup tanpa klasifikasi sub model (contoh nyata: Boven
 *     Zigzag, tiga produk aktif dengan design_variant NULL).
 *  2. Kode sub model baru boleh dipakai walau belum terdaftar di sub_models,
 *     mis. ZIGZAG dengan ORNAMEN. Owner verbatim: "tidak masalah jika mungkin
 *     ada zigzag ornamen, walaupun tidak ada secara nyata, artinya sistem
 *     berlaku dengan benar".
 *
 * Kode desain dinormalisasi ke huruf kapital supaya cocok dengan filter
 * katalog (CatalogLabels::normalizeDesign dipakai di sisi storefront).
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

    public function test_kode_sub_model_baru_diterima_walau_belum_terdaftar(): void
    {
        // Kontrak 2026-09-18: sistem tidak ketat. ZIGZAG + ORNAMEN boleh dipakai
        // walau sub model ORNAMEN belum terdaftar untuk ZIGZAG.
        $this->actingAs($this->admin())->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Zigzag Ornamen Baru',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'ZIGZAG',
            'design_variant' => 'ORNAMEN',
            'status' => 'archived',
            'homepage_popular' => false,
        ])->assertSessionHasNoErrors();

        $product = Product::where('name', 'Zigzag Ornamen Baru')->firstOrFail();

        $this->assertSame('ORNAMEN', $product->design_variant);
    }

    public function test_kode_sub_model_kode_asing_tetap_disimpan_apa_adanya(): void
    {
        // Kode yang sama sekali baru (tidak ada di sub_models) pun diterima.
        $this->actingAs($this->admin())->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Produk sub model baru',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SWING',
            'design_variant' => 'KODE_TIDAK_TERDAFTAR',
            'status' => 'archived',
            'homepage_popular' => false,
        ])->assertSessionHasNoErrors();

        $product = Product::where('name', 'Produk sub model baru')->firstOrFail();

        $this->assertSame('KODE_TIDAK_TERDAFTAR', $product->design_variant);
    }

    public function test_kode_sub_model_huruf_kecil_dinormalkan_ke_kapital(): void
    {
        // Filter katalog memakai kode kapital, jadi input huruf kecil pun
        // disimpan kapital supaya produknya tidak hilang dari filter desain.
        $this->actingAs($this->admin())->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Produk sub model huruf kecil',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'ZIGZAG',
            'design_variant' => 'ornamen',
            'status' => 'archived',
            'homepage_popular' => false,
        ])->assertSessionHasNoErrors();

        $product = Product::where('name', 'Produk sub model huruf kecil')->firstOrFail();

        $this->assertSame('ORNAMEN', $product->design_variant);
    }

    public function test_kode_sub_model_bebas_tetap_dinormalkan_saat_edit(): void
    {
        $product = Product::create([
            'parent_sku' => 'RATANPASUB04',
            'name' => 'Sub Model Bebas Edit',
            'short_name' => 'Sub Bebas',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'ZIGZAG',
            'design_variant' => null,
            'status' => 'archived',
        ]);

        $this->actingAs($this->admin())->put(route('admin.products.update', $product), [
            'name' => 'Sub Model Bebas Edit',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'ZIGZAG',
            'design_variant' => 'seri baru',
            'status' => 'archived',
        ])->assertSessionHasNoErrors();

        $this->assertSame('SERI_BARU', $product->fresh()->design_variant);
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
