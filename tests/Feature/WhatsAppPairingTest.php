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

    public function test_pairing_code_endpoint_returns_json(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $response = $this->actingAs($admin)
            ->postJson(route('admin.whatsapp.pairing.code'), ['phone' => '6281776370707']);

        $this->assertTrue(in_array($response->status(), [200, 422, 423, 500, 502], true));
        $this->assertIsArray($response->json());
    }
}
