<?php

namespace Tests\Feature;

use App\Models\WhatsAppTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

class ConsultationWhatsAppTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_consultation_send_creates_outbound_whatsapp_message(): void
    {
        Http::fake([
            'https://graph.facebook.com/*' => Http::response([
                'messages' => [['id' => 'meta-consultation-1']],
            ], 200),
        ]);
        config([
            'services.whatsapp.driver' => 'meta',
            'services.whatsapp.meta.token' => 'meta-token',
            'services.whatsapp.meta.number_id' => '12345',
            'services.whatsapp.meta.base_url' => 'https://graph.facebook.com/v20.0',
        ]);

        WhatsAppTemplate::create([
            'internal_key' => 'consultation_request',
            'provider_template_name' => 'consultation_request',
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
        ]);

        $response = $this->from('/products')->post(route('consultation.whatsapp.send'), [
            'phone' => '081234567890',
            'source' => 'model_produk',
        ]);

        $response->assertRedirect('/products');
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('whatsapp_messages', [
            'direction' => 'outbound',
            'phone_number' => '6281234567890',
            'internal_template_key' => 'consultation_request',
            'status' => 'sent',
        ]);
    }

    public function test_consultation_send_rejects_empty_phone(): void
    {
        $response = $this->from('/products')->post(route('consultation.whatsapp.send'), [
            'phone' => '',
            'source' => 'model_produk',
        ]);

        $response->assertRedirect('/products');
        $response->assertSessionHasErrors([
            'phone' => 'Nomor WhatsApp wajib diisi.',
        ]);
        $this->assertDatabaseCount('whatsapp_messages', 0);
    }

    public function test_consultation_send_rejects_invalid_phone(): void
    {
        WhatsAppTemplate::create([
            'internal_key' => 'consultation_request',
            'provider_template_name' => 'consultation_request',
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
        ]);

        $response = $this->from('/products')->post(route('consultation.whatsapp.send'), [
            'phone' => 'abc',
            'source' => 'model_produk',
        ]);

        $response->assertRedirect('/products');
        $response->assertSessionHasErrors('phone');
        $this->assertDatabaseCount('whatsapp_messages', 0);
    }

    public function test_model_produk_page_shares_consultation_whatsapp_props(): void
    {
        $this->get('/products')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/ModelProduk')
                ->has('consultationWhatsApp.directUrl')
                ->where('consultationWhatsApp.submitLabel', 'Konsultasi'));
    }
}
