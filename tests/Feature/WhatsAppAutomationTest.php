<?php

namespace Tests\Feature;

use App\Events\OrderCreated;
use App\Models\Order;
use App\Models\User;
use App\Models\WhatsAppMessage;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsAppService;
use App\Support\WhatsAppAutomationCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WhatsAppAutomationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_whatsapp_index_ensures_catalog_templates(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.templates.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/WhatsApp/Index')
                ->has('automations', count(WhatsAppAutomationCatalog::keys())));

        foreach (WhatsAppAutomationCatalog::keys() as $key) {
            $this->assertDatabaseHas('whatsapp_templates', [
                'internal_key' => $key,
                'status' => 'active',
            ]);
        }
    }

    public function test_admin_can_toggle_and_edit_automation_template(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)->get(route('admin.whatsapp.templates.index'))->assertOk();

        $template = WhatsAppTemplate::query()->where('internal_key', 'order_created')->firstOrFail();

        $this->actingAs($admin)
            ->post(route('admin.whatsapp.templates.deactivate', $template))
            ->assertRedirect();

        $this->assertSame('inactive', $template->fresh()->status);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.templates.edit', $template))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/WhatsApp/Edit')
                ->where('template.internal_key', 'order_created'));

        $this->actingAs($admin)
            ->put(route('admin.whatsapp.templates.update', $template), [
                'provider_template_name' => 'ragil_order_cod_v2',
                'language_code' => 'id',
                'body_preview' => 'Halo {{order_number}}',
            ])
            ->assertRedirect(route('admin.whatsapp.templates.edit', $template));

        $this->assertDatabaseHas('whatsapp_templates', [
            'id' => $template->id,
            'provider_template_name' => 'ragil_order_cod_v2',
            'body_preview' => 'Halo {{order_number}}',
        ]);
    }

    public function test_connection_page_renders_cloud_api_status(): void
    {
        config(['services.whatsapp.default_provider' => 'meta']);

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.connection'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/WhatsApp/Connection')
                ->where('connection.default_provider', 'meta')
                ->has('connection.providers.meta')
                ->has('connection.providers.baileys')
                ->has('stats'));
    }

    public function test_compare_mode_sends_copy_to_baileys_allowlist_only(): void
    {
        Http::fake([
            'https://graph.facebook.com/*' => Http::response(['messages' => [['id' => 'meta-1']]], 200),
            'https://baileys.test/*' => Http::response(['id' => 'baileys-1'], 200),
        ]);

        config([
            'services.whatsapp.default_provider' => 'meta',
            'services.whatsapp.compare_provider' => 'baileys',
            'services.whatsapp.compare_allowlist' => ['6281234567890'],
            'services.whatsapp.meta.token' => 'meta-token',
            'services.whatsapp.meta.number_id' => '12345',
            'services.whatsapp.meta.base_url' => 'https://graph.facebook.com/v20.0',
            'services.whatsapp.baileys.base_url' => 'https://baileys.test',
            'services.whatsapp.baileys.api_key' => 'baileys-key',
            'services.whatsapp.baileys.session' => 'ragil-test',
        ]);

        $template = WhatsAppTemplate::create([
            'internal_key' => 'consultation_request',
            'provider_template_name' => 'consultation_request',
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
            'body_preview' => "Halo {{1}}\nTes compare",
        ]);

        app(WhatsAppService::class)->sendTemplateMessage('081234567890', $template->internal_key, ['Ragil']);

        $this->assertDatabaseCount('whatsapp_messages', 2);
        $this->assertDatabaseHas('whatsapp_messages', [
            'provider' => 'meta',
            'provider_message_id' => 'meta-1',
            'status' => 'sent',
        ]);
        $this->assertDatabaseHas('whatsapp_messages', [
            'provider' => 'baileys',
            'provider_message_id' => 'baileys-1',
            'provider_session' => 'ragil-test',
            'status' => 'sent',
        ]);
    }

    public function test_order_created_uses_cod_or_transfer_template_key(): void
    {
        WhatsAppTemplate::create([
            'internal_key' => 'order_created',
            'provider_template_name' => 'order_created_cod',
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
        ]);
        WhatsAppTemplate::create([
            'internal_key' => 'payment_instructions',
            'provider_template_name' => 'payment_instructions',
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
        ]);

        $codOrder = Order::create([
            'order_number' => 'RA-WA-COD-1',
            'customer_name' => 'Budi',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);

        app(WhatsAppService::class)->handleOrderCreated(new OrderCreated($codOrder));

        $codMessage = WhatsAppMessage::query()->where('order_id', $codOrder->id)->firstOrFail();
        $this->assertSame('order_created', $codMessage->internal_template_key);
        $this->assertSame([
            'Budi',
            'RA-WA-COD-1',
            'Budi',
            'Jl A, Semarang, Jawa Tengah, 50254',
            '-',
            '-',
            'menyusul',
            '100.000',
        ], $codMessage->content_payload['variables']);

        $transferOrder = Order::create([
            'order_number' => 'RA-WA-TRF-1',
            'customer_name' => 'Ani',
            'customer_phone' => '081298765432',
            'shipping_address_line1' => 'Jl B',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '12190',
            'shipping_country' => 'Indonesia',
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 200000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        app(WhatsAppService::class)->handleOrderCreated(new OrderCreated($transferOrder));

        $transferMessage = WhatsAppMessage::query()->where('order_id', $transferOrder->id)->firstOrFail();
        $this->assertSame('payment_instructions', $transferMessage->internal_template_key);
        $this->assertCount(11, $transferMessage->content_payload['variables']);
        $this->assertSame('Ani', $transferMessage->content_payload['variables'][0]);
        $this->assertSame('RA-WA-TRF-1', $transferMessage->content_payload['variables'][1]);
        $this->assertSame('Ani', $transferMessage->content_payload['variables'][2]);

        $this->assertSame(2, WhatsAppMessage::query()->count());
    }

    public function test_catalog_bodies_use_positional_meta_tokens(): void
    {
        foreach (WhatsAppAutomationCatalog::all() as $trigger) {
            $this->assertStringContainsString('{{1}}', $trigger['default_body']);
            $this->assertStringNotContainsString('{{order_number}}', $trigger['default_body']);
            foreach ($trigger['variables'] as $variable) {
                $this->assertMatchesRegularExpression('/^\{\{\d+\}\}$/', $variable['token']);
            }

            preg_match_all('/\{\{(\d+)\}\}/', $trigger['default_body'], $matches);
            $indexes = $matches[1];
            $this->assertSame(
                $indexes,
                array_values(array_unique($indexes)),
                "Template {$trigger['internal_key']} mengulang indeks variabel Meta yang sama."
            );
        }
    }
}
