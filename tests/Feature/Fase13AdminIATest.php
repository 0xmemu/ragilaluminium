<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class Fase13AdminIATest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_dashboard_is_summary_and_followup_not_full_performa(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                ->has('attention')
                ->has('statusOrder')
                ->has('quickActions')
                ->has('recentOrders'));
    }

    public function test_store_performance_is_a_separate_feature_not_embedded_in_dashboard(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.analytics.store-performance'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Analytics/StorePerformance'));
    }

    public function test_log_aktivitas_resides_under_akun_sistem_navigation(): void
    {
        $nav = config('admin-sitemap.navigation.akun_sistem.items');
        $this->assertIsArray($nav);
        $routes = array_column($nav, 'route');
        $this->assertContains('admin.activity-logs.index', $routes);
        $this->assertContains('admin.notifications.index', $routes);
    }

    public function test_import_performance_is_not_a_separate_nav_item(): void
    {
        $nav = config('admin-sitemap.navigation.produk.items');
        $routes = array_column($nav, 'route');
        $this->assertNotContains('admin.analytics.import-performance', $routes);
    }

    public function test_import_performance_is_reachable_from_the_import_page(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.imports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ResourceIndex')
                ->where('toolbarLinks.0.label', 'Performa Import'));
    }
}
