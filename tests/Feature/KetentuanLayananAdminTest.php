<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use App\Support\CmsDocumentSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class KetentuanLayananAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_edit_ketentuan_layanan_and_public_terms_renders_body(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.ketentuan-layanan.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/CmsDocument/Edit')
                ->where('document.slug', 'ketentuan-layanan'));

        $this->actingAs($admin)
            ->put(route('admin.ketentuan-layanan.update'), [
                'title' => 'Ketentuan Layanan',
                'heading' => 'Syarat & Ketentuan',
                'body' => '<p>Pesanan diproses setelah konfirmasi.</p>',
                'published' => true,
            ])
            ->assertRedirect(route('admin.ketentuan-layanan.edit'));

        $page = CmsPage::query()->where('slug', CmsDocumentSettings::KEY_KETENTUAN)->first();
        $this->assertNotNull($page);
        $this->assertSame('Syarat & Ketentuan', $page->content['heading']);

        $this->get(route('terms'))
            ->assertOk()
            ->assertInertia(fn (Assert $assert) => $assert
                ->component('Public/CmsPage')
                ->where('page.heading', 'Syarat & Ketentuan')
                ->where('page.slug', 'ketentuan-layanan')
                ->where('page.body', '<p>Pesanan diproses setelah konfirmasi.</p>')
                ->has('page.updated_at_label'));
    }
}
