<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\AdminCapabilities;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCapabilityContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_user_gets_all_capabilities(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $payload = AdminCapabilities::for($admin);

        $this->assertSame(1, $payload['version']);
        $this->assertFalse($payload['granular'], 'granular=false sampai ada permission granular backend');
        $this->assertTrue($payload['capabilities']['dashboard.view']);
        $this->assertTrue($payload['capabilities']['orders.view']);
        $this->assertTrue($payload['capabilities']['orders.cancel']);
        $this->assertTrue($payload['capabilities']['returns.refund']);
        $this->assertTrue($payload['capabilities']['users.manage']);
        $this->assertTrue($payload['capabilities']['integrations.manage']);
    }

    public function test_non_admin_user_gets_no_capabilities(): void
    {
        $user = User::factory()->create(['role' => 'staff', 'status' => 'active']);

        $payload = AdminCapabilities::for($user);

        $this->assertFalse($payload['capabilities']['dashboard.view']);
        $this->assertFalse($payload['capabilities']['orders.view']);
        $this->assertFalse($payload['capabilities']['users.manage']);
    }

    public function test_guest_gets_no_capabilities(): void
    {
        $payload = AdminCapabilities::for(null);

        $this->assertFalse($payload['capabilities']['orders.view']);
        $this->assertFalse($payload['capabilities']['dashboard.view']);
    }

    public function test_namespace_is_stable_and_complete(): void
    {
        $all = AdminCapabilities::all();

        $this->assertContains('dashboard.view', $all);
        $this->assertContains('analytics.view', $all);
        $this->assertContains('orders.process', $all);
        $this->assertContains('orders.cancel', $all);
        $this->assertContains('payments.manage', $all);
        $this->assertContains('shipping.refresh', $all);
        $this->assertContains('returns.create', $all);
        $this->assertContains('returns.complete', $all);
        $this->assertContains('returns.refund', $all);
        $this->assertContains('returns.replacement', $all);
        $this->assertContains('products.publish', $all);
        $this->assertContains('promotions.manage', $all);
        $this->assertContains('cod_settings.manage', $all);
        $this->assertContains('whatsapp.manage_connection', $all);
        $this->assertContains('storefront_content.manage', $all);
        $this->assertContains('activity_logs.view', $all);
        $this->assertContains('users.manage', $all);
        $this->assertContains('settings.manage', $all);
        $this->assertContains('integrations.manage', $all);
    }

    public function test_inertia_shared_props_expose_capabilities_for_admin_only(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $response = $this->actingAs($admin)->get(route('admin.dashboard'));
        $response->assertOk();

        $props = $response->viewData('page')['props'] ?? [];
        $auth = $props['auth'] ?? [];
        $this->assertArrayHasKey('capabilities', $auth);
        $this->assertSame(1, $auth['capabilities']['version']);
        $this->assertTrue($auth['capabilities']['capabilities']['orders.view']);
    }

    public function test_server_guard_still_rejects_non_admin(): void
    {
        $customer = User::factory()->create(['role' => 'staff', 'status' => 'active']);

        $this->actingAs($customer)
            ->get(route('admin.dashboard'))
            ->assertForbidden();
    }
}
