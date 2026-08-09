<?php

namespace Tests\Feature;

use App\Models\WhatsAppTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ConsultationWhatsAppTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_consultation_send_creates_outbound_whatsapp_message(): void
    {
        // Isolasi: tanpa token → mark sent (jangan hit Meta live di PHPUnit).
        config([
            'services.whatsapp.token' => null,
            'services.whatsapp.default_provider' => 'meta',
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

    public function test_storefront_brand_phone_follows_whatsapp_business_phone(): void
    {
        config([
            'services.whatsapp.business_phone' => '6281776370707',
            'sitemap.brand.phone' => '+62 851-9966-6810',
        ]);

        $this->get(route('about'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/InformasiToko')
                ->where('brand.phone', '+62 817-7637-0707')
                ->where('consultationWhatsApp.phone', '+62 817-7637-0707')
                ->where('consultationWhatsApp.directUrl', fn ($url) => is_string($url) && str_starts_with($url, 'https://wa.me/6281776370707')));
    }

    public function test_storefront_brand_phone_falls_back_to_sitemap_when_whatsapp_unset(): void
    {
        config([
            'services.whatsapp.business_phone' => null,
            'sitemap.brand.phone' => '+62 851-9966-6810',
        ]);

        $this->get(route('about'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('brand.phone', '+62 851-9966-6810'));
    }
}
