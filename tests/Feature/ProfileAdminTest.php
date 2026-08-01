<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProfileAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_and_update_own_profile(): void
    {
        $admin = User::factory()->create([
            'name' => 'Admin Lama',
            'email' => 'admin@example.com',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.profile.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Profile/Edit')
                ->where('profile.name', 'Admin Lama')
                ->where('profile.email', 'admin@example.com')
                ->where('profile.role_label', 'Admin'));

        $this->actingAs($admin)
            ->put(route('admin.profile.update'), [
                'name' => 'Admin Baru',
                'username' => 'admin.baru',
                'email' => 'baru@example.com',
            ])
            ->assertRedirect(route('admin.profile.edit'));

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'name' => 'Admin Baru',
            'username' => 'admin.baru',
            'email' => 'baru@example.com',
        ]);
    }

    public function test_admin_must_confirm_current_password_to_change_password(): void
    {
        $admin = User::factory()->create([
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->from(route('admin.profile.edit'))
            ->put(route('admin.profile.update'), [
                'name' => $admin->name,
                'username' => $admin->username,
                'email' => $admin->email,
                'password' => 'newpass123',
                'password_confirmation' => 'newpass123',
            ])
            ->assertSessionHasErrors('current_password');

        $this->actingAs($admin)
            ->put(route('admin.profile.update'), [
                'name' => $admin->name,
                'username' => $admin->username,
                'email' => $admin->email,
                'current_password' => 'password123',
                'password' => 'newpass123',
                'password_confirmation' => 'newpass123',
            ])
            ->assertRedirect(route('admin.profile.edit'));

        $this->assertTrue(Hash::check('newpass123', $admin->fresh()->password));
    }
}
