<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WhatsAppPairingTest extends TestCase
{
    use RefreshDatabase;

    public function test_pairing_page_requires_admin_auth(): void
    {
        $this->get(route('admin.whatsapp.pairing'))->assertRedirect(route('login'));
    }

    public function test_pairing_page_renders_for_admin(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.pairing'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/WhatsApp/Pairing')
                ->has('statusUrl')
                ->has('qrUrl')
                ->has('codeUrl'));
    }

    public function test_pairing_status_proxies_gateway(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->getJson(route('admin.whatsapp.pairing.status'))
            ->assertOk()
            ->assertJsonStructure(['status']);
    }

    public function test_pairing_qr_proxies_image_or_404(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $response = $this->actingAs($admin)->get(route('admin.whatsapp.pairing.qr'));
        $this->assertTrue(in_array($response->status(), [200, 404], true));
        if ($response->status() === 200) {
            $this->assertSame('image/png', $response->headers->get('Content-Type'));
        }
    }

    public function test_pairing_code_redirects_with_flash_feedback(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        // Endpoint kembali ke halaman pairing dengan flash (kode berhasil ATAU error).
        // Di lingkungan test gateway tidak terjangkau → diharapkan whatsapp_error.
        $this->actingAs($admin)
            ->from(route('admin.whatsapp.pairing'))
            ->post(route('admin.whatsapp.pairing.code'), ['phone' => '6281776370707'])
            ->assertRedirect(route('admin.whatsapp.pairing'));

        $session = session()->all();
        $this->assertTrue(
            array_key_exists('whatsapp_code', $session) || array_key_exists('whatsapp_error', $session),
            'Flash whatsapp_code/whatsapp_error tidak ada di session: '.json_encode($session)
        );
    }
}
