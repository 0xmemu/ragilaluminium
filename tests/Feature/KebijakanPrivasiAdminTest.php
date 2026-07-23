<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use App\Support\CmsDocumentSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class KebijakanPrivasiAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_edit_kebijakan_privasi_and_public_privacy_renders_body(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.kebijakan-privasi.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/CmsDocument/Edit')
                ->where('document.slug', 'kebijakan-privasi'));

        $this->actingAs($admin)
            ->put(route('admin.kebijakan-privasi.update'), [
                'title' => 'Kebijakan Privasi',
                'heading' => 'Privasi Pelanggan',
                'body' => '<p>Data hanya dipakai untuk memproses pesanan.</p>',
                'published' => true,
            ])
            ->assertRedirect(route('admin.kebijakan-privasi.edit'));

        $page = CmsPage::query()->where('slug', CmsDocumentSettings::KEY_PRIVASI)->first();
        $this->assertNotNull($page);
        $this->assertSame('Privasi Pelanggan', $page->content['heading']);

        $this->get(route('privacy'))
            ->assertOk()
            ->assertInertia(fn (Assert $assert) => $assert
                ->component('Public/CmsPage')
                ->where('page.heading', 'Privasi Pelanggan')
                ->where('page.slug', 'kebijakan-privasi')
                ->where('page.body', '<p>Data hanya dipakai untuk memproses pesanan.</p>'));
    }
}
