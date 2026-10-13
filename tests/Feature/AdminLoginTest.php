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

    public function test_email_is_rejected_as_credential(): void
    {
        // Keputusan owner 2026-09-24: login hanya lewat username.
        User::factory()->create([
            'username' => 'legacy.admin',
            'password' => 'password',
        ]);

        $this->from(route('login'))
            ->post(route('login.post'), [
            'login' => 'legacy@example.com',
            'password' => 'password',
        ])->assertRedirect(route('login'))
            ->assertSessionHasErrors('login');

        $this->assertGuest();
    }

    public function test_shared_email_error_is_gone(): void
    {
        // Pesan lama "Email ini dipakai beberapa akun" tidak ada lagi karena
        // email bukan kredensial. Dua akun username berbeda tidak berpengaruh.
        User::factory()->create(['username' => 'admin.satu']);
        User::factory()->create(['username' => 'admin.dua']);

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin.satu',
                'password' => 'password',
            ])
            ->assertRedirect(route('admin.dashboard'));

        $this->assertAuthenticated();
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