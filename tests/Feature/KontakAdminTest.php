<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KontakAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_guest_tidak_bisa_akses_editor_kontak(): void
    {
        $this->get(route('admin.beranda.kontak.edit'))->assertRedirect(route('login'));
    }

    public function test_admin_update_halaman_kontak(): void
    {
        $this->actingAs($this->admin());
        CmsPage::create(['slug' => 'kontak', 'title' => 'Kontak Kami']);

        $this->put(route('admin.beranda.kontak.update'), [
            'address' => 'Jl. Baru No. 1, Semarang',
            'phone' => '0812-0000-1111',
            'email' => 'halo@ragil.test',
            'hours' => 'Senin-Jumat 08.00-17.00',
            'problems_content' => 'Hubungi kami jika ada kendala.',
        ])->assertRedirect(route('admin.beranda.kontak.edit'));

        $page = CmsPage::where('slug', 'kontak')->first();
        $this->assertNotNull($page);
        $this->assertSame('Jl. Baru No. 1, Semarang', $this->valueOf($page->content, 'Alamat'));
        $this->assertSame('halo@ragil.test', $this->valueOf($page->content, 'Email'));
        $this->assertSame('Hubungi kami jika ada kendala.', $this->valueOf($page->content, 'Masalah & Solusi'));
    }

    private function valueOf(mixed $content, string $heading): ?string
    {
        $current = null;
        foreach (($content['blocks'] ?? []) as $block) {
            if (($block['type'] ?? '') === 'heading' && ($block['text'] ?? '') === $heading) {
                $current = $heading;
            } elseif (($block['type'] ?? '') === 'paragraph' && $current === $heading) {
                return $block['text'] ?? null;
            }
        }
        return null;
    }
}