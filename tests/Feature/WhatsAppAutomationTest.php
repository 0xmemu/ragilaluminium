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
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.connection'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/WhatsApp/Connection')
                ->has('connection')
                ->has('stats'));
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

        $this->assertDatabaseHas('whatsapp_messages', [
            'order_id' => $codOrder->id,
            'internal_template_key' => 'order_created',
            'direction' => 'outbound',
        ]);

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

        $this->assertDatabaseHas('whatsapp_messages', [
            'order_id' => $transferOrder->id,
            'internal_template_key' => 'payment_instructions',
            'direction' => 'outbound',
        ]);

        $this->assertSame(2, WhatsAppMessage::query()->count());
    }
}
