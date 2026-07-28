<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\JntReadiness;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JntReadinessTest extends TestCase
{
    use RefreshDatabase;

    public function test_jnt_status_reports_open_platform_provider(): void
    {
        config([
            'jnt.enabled' => false,
            'jnt.credentials.api_account' => null,
            'jnt.credentials.private_key' => null,
            'jnt.credentials.customer_code' => null,
            'jnt.credentials.customer_password' => null,
            'jnt.sender.mobile' => '081234598065',
            'jnt.sender.prov' => 'JAWA TENGAH',
            'jnt.sender.city' => 'BANJARNEGARA',
            'jnt.sender.area' => 'MANDIRAJA',
            'jnt.sender.address' => 'Jl Test',
            'jnt.sender.postcode' => '53473',
        ]);

        $this->artisan('jnt:status')
            ->expectsOutputToContain('J&T Cargo Open Platform')
            ->expectsOutputToContain('JNT_API_ACCOUNT')
            ->assertFailed();

        $report = JntReadiness::report();
        $this->assertSame(JntReadiness::PROVIDER, $report['provider']);
        $this->assertFalse($report['client_ready']);
        $this->assertContains('JNT_API_ACCOUNT', $report['missing']);
        $this->assertNotContains('JNT_SENDER_POSTCODE', $report['missing']);
    }

    public function test_joint_debug_fails_clearly_when_not_ready(): void
    {
        config([
            'jnt.enabled' => false,
            'jnt.credentials.api_account' => null,
            'jnt.credentials.private_key' => null,
        ]);

        $this->artisan('jnt:joint-debug', ['--times' => 1])
            ->expectsOutputToContain('jnt:status')
            ->assertFailed();
    }

    public function test_admin_settings_shows_open_platform_status(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        config([
            'jnt.enabled' => false,
            'jnt.environment' => 'sandbox',
            'jnt.credentials.api_account' => null,
            'jnt.credentials.private_key' => null,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.settings.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/ResourceShow')
                ->where('fields', function ($fields) {
                    $labels = collect($fields)->pluck('label')->all();

                    return in_array('Shipping Provider', $labels, true)
                        && in_array('J&T Client Ready', $labels, true);
                }));
    }
}
