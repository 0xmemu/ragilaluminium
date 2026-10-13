<?php

namespace Tests\Feature;

use App\Models\ImportJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminImportIndexTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_guest_redirected_to_login(): void
    {
        $this->get(route('admin.imports.index'))
            ->assertRedirect(route('login'));
    }

    public function test_admin_can_view_imports_index(): void
    {
        ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'test-catalog.xlsx',
            'total_rows' => 100,
            'processed_rows' => 100,
            'success_rows' => 100,
            'failed_rows' => 0,
            'status' => 'completed',
            'started_at' => now()->subMinutes(2),
            'completed_at' => now(),
            'triggered_by_user_id' => $this->admin->id,
        ]);

        $this->actingAs($this->admin)
            ->get(route('admin.imports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Imports/Index')
                ->has('summary')
                ->where('summary.total_jobs', 1)
                ->where('summary.total_completed', 1)
                ->where('summary.total_success_rows', 100)
                ->has('tabs', 4)
                ->has('jobs.data', 1)
                ->where('jobs.data.0.source_file_name', 'test-catalog.xlsx')
                ->where('jobs.data.0.status', 'completed')
                ->where('jobs.data.0.triggered_by', $this->admin->name)
            );
    }

    public function test_admin_can_filter_imports_by_status(): void
    {
        ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'completed.xlsx',
            'total_rows' => 50,
            'processed_rows' => 50,
            'success_rows' => 50,
            'status' => 'completed',
        ]);

        ImportJob::create([
            'type' => 'stock_price_update',
            'source_file_name' => 'failed.xlsx',
            'total_rows' => 10,
            'processed_rows' => 10,
            'success_rows' => 0,
            'failed_rows' => 10,
            'status' => 'failed',
        ]);

        // Filter status=completed
        $this->actingAs($this->admin)
            ->get(route('admin.imports.index', ['status' => 'completed']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Imports/Index')
                ->has('jobs.data', 1)
                ->where('jobs.data.0.source_file_name', 'completed.xlsx')
            );

        // Filter status=failed
        $this->actingAs($this->admin)
            ->get(route('admin.imports.index', ['status' => 'failed']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Imports/Index')
                ->has('jobs.data', 1)
                ->where('jobs.data.0.source_file_name', 'failed.xlsx')
            );
    }
}
