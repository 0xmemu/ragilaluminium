<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use App\Support\CmsDocumentSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TentangKamiAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_edit_tentang_kami_and_public_about_renders_body(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.tentang-kami.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/CmsDocument/Edit')
                ->where('document.slug', 'tentang-kami'));

        $this->actingAs($admin)
            ->put(route('admin.tentang-kami.update'), [
                'title' => 'Tentang Ragil Aluminium',
                'heading' => 'Siapa Kami',
                'body' => "<p>Kami membuat jendela aluminium premium.</p>",
                'published' => true,
            ])
            ->assertRedirect(route('admin.tentang-kami.edit'));

        $page = CmsPage::query()->where('slug', CmsDocumentSettings::KEY_TENTANG_KAMI)->first();
        $this->assertNotNull($page);
        $this->assertSame('Siapa Kami', $page->content['heading']);
        $this->assertStringContainsString('jendela aluminium', $page->content['body']);

        $this->get(route('about'))
            ->assertOk()
            ->assertInertia(fn (Assert $assert) => $assert
                ->component('Public/InformasiToko')
                ->where('page.heading', 'Siapa Kami')
                ->where('page.body', '<p>Kami membuat jendela aluminium premium.</p>'));
    }
}
