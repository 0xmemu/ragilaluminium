<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\InstallationProject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InstallationProjectAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    public function test_admin_can_view_installation_projects_index(): void
    {
        $admin = $this->admin();

        InstallationProject::create([
            'title' => 'Kaca Mati Polos',
            'slug' => 'kaca-mati-polos',
            'category_label' => 'Jendela & Kaca',
            'status' => 'active',
            'sort_order' => 1,
            'main_image_url' => 'https://example.com/foto1.jpg',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Index')
                ->has('projects.data', 1)
                ->where('projects.data.0.title', 'Kaca Mati Polos')
                ->has('tabs', 4)
                ->where('activeStatus', 'all')
            );
    }

    public function test_admin_can_filter_by_status_and_search(): void
    {
        $admin = $this->admin();

        InstallationProject::create([
            'title' => 'Pintu Sliding Hitam',
            'slug' => 'pintu-sliding-hitam',
            'status' => 'active',
            'sort_order' => 1,
            'main_image_url' => 'https://example.com/sliding.jpg',
        ]);

        InstallationProject::create([
            'title' => 'Kusen Minimalis Silver',
            'slug' => 'kusen-minimalis-silver',
            'status' => 'inactive',
            'sort_order' => 2,
            'main_image_url' => 'https://example.com/kusen.jpg',
        ]);

        // Filter status inactive
        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index', ['status' => 'inactive']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Index')
                ->has('projects.data', 1)
                ->where('projects.data.0.title', 'Kusen Minimalis Silver')
            );

        // Search q=Sliding
        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index', ['q' => 'Sliding']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Index')
                ->has('projects.data', 1)
                ->where('projects.data.0.title', 'Pintu Sliding Hitam')
            );
    }

    public function test_admin_can_view_create_form(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Form')
                ->where('project', null)
                ->has('modelProducts')
            );
    }

    public function test_admin_can_store_new_installation_project(): void
    {
        $admin = $this->admin();

        $modelProduct = CmsModelProduct::create([
            'name' => 'Kaca Mati Standard',
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'status' => 'active',
            'sort_order' => 1,
        ]);

        $payload = [
            'title' => 'Kaca Mati Minimalis Living Room',
            'category_label' => 'Timeless & Minimalis',
            'status' => 'active',
            'description' => 'Pemasangan kaca mati di area living room dengan pencahayaan maksimal.',
            'model_product_id' => $modelProduct->id,
            'main_image_url' => 'https://example.com/main.jpg',
            'main_video_url' => 'https://example.com/video.mp4',
            'gallery_images' => [
                ['url' => 'https://example.com/gallery1.jpg', 'caption' => 'Tampak depan'],
            ],
            'specifications' => [
                ['name' => 'Tipe Kaca', 'value' => 'Tempered 8mm'],
                ['name' => 'Framer', 'value' => 'Aluminium 4"'],
            ],

        ];

        $this->actingAs($admin)
            ->post(route('admin.hasil-pemasangan.store'), $payload)
            ->assertRedirect(route('admin.hasil-pemasangan.index'))
            ->assertSessionHas('success');

        $this->assertDatabaseHas('installation_projects', [
            'title' => 'Kaca Mati Minimalis Living Room',
            'category_label' => 'Timeless & Minimalis',
            'status' => 'active',
            'model_product_id' => $modelProduct->id,
        ]);

        $project = InstallationProject::where('title', 'Kaca Mati Minimalis Living Room')->first();
        $this->assertNotNull($project);
        $this->assertCount(1, $project->gallery_images);
        $this->assertCount(2, $project->specifications);

    }

    public function test_admin_can_view_installation_project_detail(): void
    {
        $admin = $this->admin();

        $project = InstallationProject::create([
            'title' => 'Proyek Jendela Casement',
            'slug' => 'proyek-jendela-casement',
            'status' => 'active',
            'sort_order' => 1,
            'main_image_url' => 'https://example.com/casement.jpg',
            'specifications' => [['name' => 'Warna', 'value' => 'Hitam Matt']],

        ]);

        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.show', $project->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Show')
                ->where('project.title', 'Proyek Jendela Casement')
                ->where('project.specifications.0.value', 'Hitam Matt')
            );
    }

    public function test_admin_can_update_installation_project(): void
    {
        $admin = $this->admin();

        $project = InstallationProject::create([
            'title' => 'Judul Lama',
            'slug' => 'judul-lama',
            'status' => 'active',
            'sort_order' => 1,
            'main_image_url' => 'https://example.com/lama.jpg',
        ]);

        $this->actingAs($admin)
            ->put(route('admin.hasil-pemasangan.update', $project->id), [
                'title' => 'Judul Baru Diperbarui',
                'category_label' => 'Kategori Baru',
                'status' => 'inactive',
                'description' => 'Deskripsi baru',
                'main_image_url' => 'https://example.com/baru.jpg',
                'specifications' => [['name' => 'Lokasi', 'value' => 'Lantai 2']],

            ])
            ->assertRedirect(route('admin.hasil-pemasangan.index'))
            ->assertSessionHas('success');

        $this->assertDatabaseHas('installation_projects', [
            'id' => $project->id,
            'title' => 'Judul Baru Diperbarui',
            'status' => 'inactive',
            'category_label' => 'Kategori Baru',
        ]);
    }

    public function test_admin_can_toggle_status(): void
    {
        $admin = $this->admin();

        $project = InstallationProject::create([
            'title' => 'Toggle Project',
            'slug' => 'toggle-project',
            'status' => 'active',
            'sort_order' => 1,
            'main_image_url' => 'https://example.com/img.jpg',
        ]);

        $this->actingAs($admin)
            ->patch(route('admin.hasil-pemasangan.toggle-status', $project->id))
            ->assertRedirect();

        $this->assertSame('inactive', $project->fresh()->status);

        $this->actingAs($admin)
            ->patch(route('admin.hasil-pemasangan.toggle-status', $project->id))
            ->assertRedirect();

        $this->assertSame('active', $project->fresh()->status);
    }

    public function test_admin_can_archive_installation_project(): void
    {
        $admin = $this->admin();

        $project = InstallationProject::create([
            'title' => 'Archive Project',
            'slug' => 'archive-project',
            'status' => 'active',
            'sort_order' => 1,
            'main_image_url' => 'https://example.com/img.jpg',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.hasil-pemasangan.archive', $project->id))
            ->assertRedirect();

        $this->assertSame('archived', $project->fresh()->status);
    }

    public function test_admin_can_reorder_installation_projects(): void
    {
        $admin = $this->admin();

        $p1 = InstallationProject::create([
            'title' => 'Proyek 1',
            'slug' => 'proyek-1',
            'status' => 'active',
            'sort_order' => 1,
            'main_image_url' => 'https://example.com/1.jpg',
        ]);

        $p2 = InstallationProject::create([
            'title' => 'Proyek 2',
            'slug' => 'proyek-2',
            'status' => 'active',
            'sort_order' => 2,
            'main_image_url' => 'https://example.com/2.jpg',
        ]);

        $this->actingAs($admin)
            ->put(route('admin.hasil-pemasangan.reorder'), [
                'rows' => [
                    ['id' => $p1->id, 'sort_order' => 10],
                    ['id' => $p2->id, 'sort_order' => 5],
                ],
            ])
            ->assertRedirect();

        $this->assertSame(10, $p1->fresh()->sort_order);
        $this->assertSame(5, $p2->fresh()->sort_order);
    }

    public function test_admin_can_destroy_installation_project(): void
    {
        $admin = $this->admin();

        $project = InstallationProject::create([
            'title' => 'Hapus Saya',
            'slug' => 'hapus-saya',
            'status' => 'active',
            'sort_order' => 1,
            'main_image_url' => 'https://example.com/del.jpg',
        ]);

        $this->actingAs($admin)
            ->delete(route('admin.hasil-pemasangan.destroy', $project->id))
            ->assertRedirect(route('admin.hasil-pemasangan.index'));

        $this->assertDatabaseMissing('installation_projects', [
            'id' => $project->id,
        ]);
    }
}
