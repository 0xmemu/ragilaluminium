<?php

namespace TestsFeature;

use App\Models\Category;
use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Models\SubModel;
use App\Models\User;
use App\Support\CatalogLabels;
use App\Support\CategoryUrl;
use App\Support\InstallationGallery;
use App\Services\ModelProductService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DynamicTaxonomyFlowTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    public function test_alur_lengkap_taksonomi_dinamis(): void
    {
        $admin = $this->admin();

        // 1. Buat Kategori Baru (misal: PARTISI)
        $resCat = $this->actingAs($admin)->post('/admin/kelola/kategori', [
            'name' => 'Partisi Ruangan',
            'code' => 'PARTISI',
            'slug' => 'partisi',
            'is_active' => true,
        ]);
        $resCat->assertRedirect('/admin/kelola/kategori');
        $this->assertDatabaseHas('categories', ['code' => 'PARTISI', 'slug' => 'partisi']);

        // Pastikan CategoryUrl dan CatalogLabels mengenali kategori baru
        CategoryUrl::forgetCache();
        $this->assertContains('PARTISI', CatalogLabels::categoryCodes());

        // 2. Buat Model Produk Baru di bawah Partisi (misal: PARTISI_GESER)
        $resModel = $this->actingAs($admin)->post('/admin/kelola/model-produk', [
            'name' => 'Partisi Geser Lipat',
            'product_model' => 'PARTISI_GESER',
            'product_category' => 'PARTISI',
            'status' => 'active',
            'description' => 'Partisi geser lipat modern.',
        ]);
        $resModel->assertRedirect('/admin/kelola/model-produk');
        $this->assertDatabaseHas('cms_model_products', [
            'product_model' => 'PARTISI_GESER',
            'product_category' => 'PARTISI',
            'status' => 'active',
        ]);

        // Pastikan CatalogLabels::modelCodes() memuat model baru
        \Illuminate\Support\Facades\Cache::forget('catalog.model_codes.v3.all');
        $this->assertContains('PARTISI_GESER', CatalogLabels::modelCodes());
        $this->assertSame('Partisi Geser Lipat', CatalogLabels::model('PARTISI_GESER'));

        // 3. Buat Sub Model di bawah model baru tersebut
        $resSub = $this->actingAs($admin)->post('/admin/kelola/sub-model', [
            'product_model' => 'PARTISI_GESER',
            'code' => 'KISI_KISI',
            'name' => 'Desain Kisi-kisi',
        ]);
        $resSub->assertRedirect();
        $this->assertDatabaseHas('sub_models', [
            'product_model' => 'PARTISI_GESER',
            'code' => 'KISI_KISI',
            'name' => 'Desain Kisi-kisi',
        ]);

        // 4. Buat Produk menggunakan Kategori, Model, dan Sub Model baru
        $resProd = $this->actingAs($admin)->post('/admin/kelola/produk', [
            'name' => 'Partisi Ruangan Geser 4 Daun',
            'product_category' => 'PARTISI',
            'product_model' => 'PARTISI_GESER',
            'design_variant' => 'KISI_KISI',
            'status' => 'archived',
            'description' => 'Deskripsi partisi ruangan geser 4 daun berkualitas tinggi.',
            'create_initial_variant' => true,
            'initial_price' => 1500000,
            'initial_stock' => 10,
            'weight_kg' => 25.0,
            'width_cm' => 200,
            'height_cm' => 240,
            'depth_cm' => 8,
        ]);
        $resProd->assertSessionHasNoErrors();

        $product = Product::where('product_model', 'PARTISI_GESER')->first();
        $this->assertNotNull($product);
        $product->update(['status' => 'active']);
        $product->variants()->update(['status' => 'active']);
        CmsModelProduct::where('product_model', 'PARTISI_GESER')->update(['status' => 'active']);

        $resStorefront = $this->get('/products/partisi/partisi-geser');
        $resStorefront->assertOk();
    }
}
