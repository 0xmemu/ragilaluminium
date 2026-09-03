<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\SubModel;
use App\Models\SubModelAttributeTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttributeTemplateTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_store_applies_template_by_sub_model(): void
    {
        $admin = $this->admin();
        $subModel = SubModel::create(['product_model' => 'SWING', 'code' => 'T_ORNAMEN', 'name' => 'Ornamen Test', 'is_active' => true]);
        SubModelAttributeTemplate::create([
            'sub_model_id' => $subModel->id, 'product_model' => 'SWING',
            'attribute_name' => 'Material', 'attribute_value' => 'Aluminium', 'sort_order' => 0,
        ]);
        SubModelAttributeTemplate::create([
            'sub_model_id' => $subModel->id, 'product_model' => 'SWING',
            'attribute_name' => 'Jumlah Daun', 'attribute_value' => '2', 'sort_order' => 10,
        ]);

        $this->actingAs($admin)->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Jendela Swing Ornamen Test',
            'short_name' => 'Swing Ornamen',
            'description' => 'Deskripsi wajib untuk uji template.',
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'design_variant' => 'T_ORNAMEN',
            'status' => 'archived',
            'homepage_popular' => false,
            'homepage_popular_sort' => 0,
        ])->assertRedirect();

        $product = Product::where('name', 'Jendela Swing Ornamen Test')->firstOrFail();
        $attributes = $product->attributes()->pluck('attribute_value', 'attribute_name')->all();

        $this->assertSame('Aluminium', $attributes['Material']);
        $this->assertSame('2', $attributes['Jumlah Daun']);
    }

    public function test_fallback_to_model_default_template(): void
    {
        $admin = $this->admin();
        // Template default model (bukan per sub model)
        SubModelAttributeTemplate::create([
            'sub_model_id' => null, 'product_model' => 'SWING',
            'attribute_name' => 'Material', 'attribute_value' => 'Aluminium', 'sort_order' => 0,
        ]);

        $this->actingAs($admin)->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Jendela Swing Tanpa Submodel',
            'description' => 'Deskripsi wajib untuk uji fallback.',
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'status' => 'archived',
            'homepage_popular' => false,
            'homepage_popular_sort' => 0,
        ])->assertRedirect();

        $product = Product::where('name', 'Jendela Swing Tanpa Submodel')->firstOrFail();
        $this->assertSame('Aluminium', $product->attributes()->first()->attribute_value);
    }

    public function test_existing_attributes_are_not_overwritten(): void
    {
        $admin = $this->admin();
        $subModel = SubModel::create(['product_model' => 'SWING', 'code' => 'T_ORNAMEN', 'name' => 'Ornamen Test', 'is_active' => true]);
        SubModelAttributeTemplate::create([
            'sub_model_id' => $subModel->id, 'product_model' => 'SWING',
            'attribute_name' => 'Material', 'attribute_value' => 'Aluminium', 'sort_order' => 0,
        ]);

        $this->actingAs($admin)->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Jendela Swing Punya Atribut',
            'description' => 'Deskripsi wajib uji tidak menimpa.',
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'design_variant' => 'T_ORNAMEN',
            'status' => 'archived',
            'homepage_popular' => false,
            'homepage_popular_sort' => 0,
        ])->assertRedirect();

        $product = Product::where('name', 'Jendela Swing Punya Atribut')->firstOrFail();
        // Pembuatan kedua tidak boleh menimpa: applyToProduct kembali 0 dan nilai tetap.
        $this->assertSame(0, app(\App\Services\AttributeTemplateService::class)->applyToProduct($product->fresh()));
        $this->assertSame('Aluminium', $product->attributes()->where('attribute_name', 'Material')->first()->attribute_value);
    }

    public function test_sub_model_update_sync_templates(): void
    {
        $admin = $this->admin();
        $subModel = SubModel::create(['product_model' => 'SWING', 'code' => 'T_ORNAMEN', 'name' => 'Ornamen Test', 'is_active' => true]);
        SubModelAttributeTemplate::create([
            'sub_model_id' => $subModel->id, 'product_model' => 'SWING',
            'attribute_name' => 'Lama', 'attribute_value' => 'Nilai', 'sort_order' => 0,
        ]);

        $this->actingAs($admin)->put(route('admin.sub-models.update', $subModel), [
            'name' => 'Ornamen',
            'description' => null,
            'image_url' => null,
            'is_active' => 1,
            'templates' => [
                ['attribute_name' => 'Material', 'attribute_value' => 'Aluminium'],
                ['attribute_name' => 'Jumlah Daun', 'attribute_value' => '2'],
            ],
        ])->assertRedirect();

        $templates = $subModel->attributeTemplates()->orderBy('sort_order')->get();
        $this->assertCount(2, $templates);
        $this->assertSame('Aluminium', $templates[0]->attribute_value);
        $this->assertSame('2', $templates[1]->attribute_value);
    }
}
