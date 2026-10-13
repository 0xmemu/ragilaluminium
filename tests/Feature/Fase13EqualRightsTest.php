<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Fase13EqualRightsTest extends TestCase
{
    use RefreshDatabase;

    public function test_plain_admin_can_access_all_core_admin_areas(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $areas = [
            'admin.dashboard',
            'admin.analytics.store-performance',
            'admin.notifications.index',
            'admin.activity-logs.index',
            'admin.users.index',
            'admin.imports.index',
            'admin.products.index',
        ];

        foreach ($areas as $route) {
            $this->actingAs($admin)->get(route($route))->assertOk();
        }
    }
}
