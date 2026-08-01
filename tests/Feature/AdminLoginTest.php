<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_admin_can_authenticate_with_username_and_reach_dashboard(): void
    {
        User::factory()->create([
            'username' => 'admin.tes',
            'email' => 'test@example.com',
            'password' => 'password',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin.tes',
                'password' => 'password',
            ])
            ->assertRedirect(route('admin.dashboard'));

        $this->assertAuthenticated();
        $this->get(route('admin.dashboard'))->assertOk();
    }

    public function test_unique_legacy_email_can_still_authenticate(): void
    {
        User::factory()->create([
            'username' => 'legacy.admin',
            'email' => 'legacy@example.com',
            'password' => 'password',
        ]);

        $this->post(route('login.post'), [
            'email' => 'legacy@example.com',
            'password' => 'password',
        ])->assertRedirect(route('admin.dashboard'));

        $this->assertAuthenticated();
    }

    public function test_shared_email_requires_username(): void
    {
        User::factory()->create(['username' => 'admin.satu', 'email' => 'shared@example.com']);
        User::factory()->create(['username' => 'admin.dua', 'email' => 'shared@example.com']);

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'shared@example.com',
                'password' => 'password',
            ])
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors('login');

        $this->assertGuest();
    }

    public function test_invalid_credentials_stay_on_login(): void
    {
        User::factory()->create([
            'username' => 'admin.invalid',
            'email' => 'test@example.com',
            'password' => 'password',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin.invalid',
                'password' => 'wrong-password',
            ])
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors('login');

        $this->assertGuest();
    }
}