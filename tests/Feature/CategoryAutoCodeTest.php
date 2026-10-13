<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CategoryAutoCodeTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    /**
     * Kontrak 2026-09-23: tambah kategori memakai halaman penuh, bukan popup di
     * halaman index. GET create harus merender komponen Admin/Categories/Form
     * dengan category null, sama seperti edit.
     */
    public function test_create_page_renders_full_page_form_with_null_category(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->get(route('admin.categories.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Categories/Form')
                ->where('category', null)
                ->where('title', 'Tambah Kategori')
                ->where('backUrl', route('admin.categories.index'))
                ->where('submitUrl', route('admin.categories.store')));
    }

    /**
     * Halaman index tidak lagi memuat alur popup tambah: tidak ada storeUrl dan
     * tombol Tambah mengarah ke halaman create.
     */
    public function test_index_points_add_button_to_create_page(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->get(route('admin.categories.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Categories/Index')
                ->where('createUrl', route('admin.categories.create'))
                ->missing('storeUrl'));
    }

    public function test_category_store_auto_derives_code_and_slug_from_name_without_manual_code(): void
    {
        $admin = $this->admin();

        $response = $this->actingAs($admin)->post(route('admin.categories.store'), [
            'name' => 'Pintu Garasi Aluminium',
            'is_active' => true,
        ]);

        $response->assertRedirect(route('admin.categories.index'));

        $category = Category::where('name', 'Pintu Garasi Aluminium')->first();
        $this->assertNotNull($category);
        $this->assertSame('PINTU_GARASI_ALUMINIUM', $category->code);
        $this->assertSame('pintu-garasi-aluminium', $category->slug);
    }

    public function test_category_code_and_slug_collision_resolution(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->post(route('admin.categories.store'), [
            'name' => 'Kategori Uji',
        ]);
        $this->actingAs($admin)->post(route('admin.categories.store'), [
            'name' => 'Kategori Uji',
        ]);

        $cats = Category::where('name', 'Kategori Uji')->get();
        $this->assertCount(2, $cats);
        $this->assertSame('KATEGORI_UJI', $cats[0]->code);
        $this->assertSame('kategori-uji', $cats[0]->slug);
        $this->assertSame('KATEGORI_UJI_2', $cats[1]->code);
        $this->assertSame('kategori-uji-2', $cats[1]->slug);
    }
}
