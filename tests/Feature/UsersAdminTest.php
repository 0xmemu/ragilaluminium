<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\AdminAccountCredentials;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UsersAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_manajemen_admin_lists_filters_and_creates_equal_admin(): void
    {
        Notification::fake();
        config(['mail.default' => 'array']);

        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
            'email' => 'boss@example.com',
        ]);
        User::factory()->create([
            'name' => 'Staf Kudus',
            'email' => 'staf@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.users.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Users/Index')
                ->where('title', 'Manajemen Admin')
                ->has('rows', 2)
                ->missing('roleOptions'));

        $this->actingAs($admin)
            ->get(route('admin.users.index', ['status' => 'active', 'q' => 'Staf']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 1)
                ->where('rows.0.email', 'staf@example.com'));

        $this->actingAs($admin)
            ->post(route('admin.users.store'), [
                'name' => 'Admin Baru',
                'username' => 'admin.baru',
                'email' => 'boss@example.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => 'viewer', // ignored — Stage 2 equal-admin
                'status' => 'active',
            ])
            ->assertRedirect(route('admin.users.index'));

        $this->assertDatabaseHas('users', [
            'username' => 'admin.baru',
            'email' => 'boss@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $created = User::query()->where('username', 'admin.baru')->firstOrFail();
        Notification::assertSentTo(
            $created,
            AdminAccountCredentials::class,
            fn (AdminAccountCredentials $notification) => $notification->username === 'admin.baru'
        );
    }

    public function test_cannot_deactivate_self_or_last_active_admin(): void
    {
        $only = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
            'email' => 'only@example.com',
            'password' => Hash::make('password123'),
        ]);

        $this->actingAs($only)
            ->from(route('admin.users.index'))
            ->post(route('admin.users.deactivate', $only))
            ->assertRedirect()
            ->assertSessionHasErrors('status');

        $this->assertTrue($only->fresh()->status === 'active');

        $this->actingAs($only)
            ->from(route('admin.users.edit', $only))
            ->put(route('admin.users.update', $only), [
                'name' => $only->name,
                'username' => $only->username,
                'email' => $only->email,
                'status' => 'inactive',
            ])
            ->assertSessionHasErrors('status');

        $this->assertSame('active', $only->fresh()->status);
        $this->assertSame('admin', $only->fresh()->role);
    }

    public function test_admin_can_deactivate_other_user(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $other = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.users.deactivate', $other))
            ->assertRedirect();

        $this->assertSame('inactive', $other->fresh()->status);

        $this->actingAs($admin)
            ->post(route('admin.users.activate', $other))
            ->assertRedirect();

        $this->assertSame('active', $other->fresh()->status);
        $this->assertSame('admin', $other->fresh()->role);
    }
}
