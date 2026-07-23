<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ActivityLogAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_activity_log_index_lists_event_logs_and_filters_category(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
            'name' => 'Admin Putra',
        ]);

        EventLog::create([
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => 1,
            'payload' => ['from' => 'processing', 'order_status' => 'shipped'],
            'created_by_user_id' => $admin->id,
            'created_at' => now(),
        ]);

        EventLog::create([
            'event_type' => 'auth.login',
            'entity_type' => 'user',
            'entity_id' => $admin->id,
            'payload' => ['ip' => '127.0.0.1'],
            'created_by_user_id' => $admin->id,
            'created_at' => now()->subMinute(),
        ]);

        $this->actingAs($admin)
            ->get(route('admin.activity-logs.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ActivityLogs/Index')
                ->where('category', 'all')
                ->has('rows', 2)
                ->where('rows.0.actor', 'Admin Putra'));

        $this->actingAs($admin)
            ->get(route('admin.activity-logs.index', ['category' => 'attendance']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('category', 'attendance')
                ->has('rows', 1)
                ->where('rows.0.event_type', 'auth.login'));
    }

    public function test_admin_can_export_activity_logs_csv(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        EventLog::create([
            'event_type' => 'payment.confirmed',
            'entity_type' => 'order',
            'entity_id' => 9,
            'payload' => ['amount' => 100000],
            'created_by_user_id' => $admin->id,
            'created_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->get(route('admin.activity-logs.export'));

        $response->assertOk();
        $response->assertStreamed();
        $content = $response->streamedContent();
        $this->assertStringContainsString('payment.confirmed', $content);
        $this->assertStringContainsString('Pesanan & Biaya', $content);
    }

    public function test_login_writes_auth_login_event_log(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
            'email' => 'admin@ragil.test',
            'password' => 'secret123',
        ]);

        $this->post(route('login.post'), [
            'email' => 'admin@ragil.test',
            'password' => 'secret123',
        ])->assertRedirect(route('admin.dashboard'));

        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'auth.login',
            'entity_type' => 'user',
            'entity_id' => $admin->id,
            'created_by_user_id' => $admin->id,
        ]);
    }
}
