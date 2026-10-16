<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Models\SubModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class TaxonomyDestroyGuardTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            "role" => "admin",
            "status" => "active",
        ]);
    }

    public function test_kategori_tidak_bisa_dihapus_jika_memiliki_model_produk(): void
    {
        $admin = $this->admin();
        $cat = Category::create([
            "name" => "Kategori Uji",
            "code" => "UJI_CAT",
            "slug" => "uji-cat",
            "is_active" => true,
        ]);
        $model = CmsModelProduct::create([
            "name" => "Model Uji",
            "product_model" => "UJI_MOD",
            "product_category" => "UJI_CAT",
            "status" => "active",
        ]);

        $res = $this->actingAs($admin)->delete("/admin/kelola/kategori/" . $cat->id);
        $res->assertSessionHas("error", "Tidak bisa menghapus kategori yang masih memiliki model produk.");
        $this->assertDatabaseHas("categories", ["id" => $cat->id]);

        // Hapus modelnya, baru kategori bisa dihapus
        $model->delete();
        $res2 = $this->actingAs($admin)->delete("/admin/kelola/kategori/" . $cat->id);
        $res2->assertRedirect("/admin/kelola/kategori");
        $this->assertDatabaseMissing("categories", ["id" => $cat->id]);
    }

    public function test_model_produk_tidak_bisa_dihapus_jika_memiliki_sub_model_atau_produk(): void
    {
        $admin = $this->admin();
        $model = CmsModelProduct::create([
            "name" => "Model Test Guard",
            "product_model" => "MOD_GUARD",
            "product_category" => "JENDELA",
            "status" => "active",
        ]);
        $sub = SubModel::create([
            "product_model" => "MOD_GUARD",
            "code" => "SUB_GUARD",
            "name" => "Sub Guard",
            "is_active" => true,
        ]);

        // 1. Ditolak karena masih punya sub model
        $res = $this->actingAs($admin)->delete("/admin/kelola/model-produk/" . $model->id);
        $res->assertSessionHas("error", "Tidak bisa menghapus model produk yang masih memiliki sub model.");
        $this->assertDatabaseHas("cms_model_products", ["id" => $model->id]);

        // 2. Buat produk yang memakai sub model
        $prod = Product::create([
            "name" => "Produk Guard Test",
            "product_category" => "JENDELA",
            "product_model" => "MOD_GUARD",
            "design_variant" => "SUB_GUARD",
            "status" => "active",
            "parent_sku" => "GUARD_TEST_001",
        ]);

        // Sub model ditolak hapus karena dipakai produk
        $resSub = $this->actingAs($admin)->delete("/admin/kelola/sub-model/" . $sub->id);
        $resSub->assertSessionHas("error", "Tidak bisa menghapus sub model yang masih dipakai produk.");
        $this->assertDatabaseHas("sub_models", ["id" => $sub->id]);

        // Hapus produk
        $prod->delete();

        // Sub model kini bisa dihapus
        $resSub2 = $this->actingAs($admin)->delete("/admin/kelola/sub-model/" . $sub->id);
        $resSub2->assertRedirect("/admin/kelola/sub-model?product_model=MOD_GUARD");
        $this->assertDatabaseMissing("sub_models", ["id" => $sub->id]);

        // Model kini bisa dihapus
        $resModel2 = $this->actingAs($admin)->delete("/admin/kelola/model-produk/" . $model->id);
        $resModel2->assertRedirect("/admin/kelola/model-produk");
        $this->assertDatabaseMissing("cms_model_products", ["id" => $model->id]);
    }
}
