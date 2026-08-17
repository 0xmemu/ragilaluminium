<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Fase13LoginSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
            'email' => 'admin@ragil.test',
            'password' => 'secret123',
        ]);
    }

    public function test_login_is_locked_out_after_max_attempts_brute_force_prevention(): void
    {
        $this->admin();

        for ($i = 0; $i < 5; $i++) {
            $this->from(route('login'))
                ->post(route('login.post'), [
                    'login' => 'admin@ragil.test',
                    'password' => 'wrong-password',
                ]);
        }

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin@ragil.test',
                'password' => 'secret123',
            ])
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors('login');

        $this->assertGuest();
    }

    public function test_login_rotates_web_session_and_keeps_whatsapp_independent(): void
    {
        $this->admin();

        $this->get(route('login'));
        $before = session()->getId();

        $this->post(route('login.post'), [
            'login' => 'admin@ragil.test',
            'password' => 'secret123',
        ])->assertRedirect(route('admin.dashboard'));

        $this->assertAuthenticated();
        $after = session()->getId();
        $this->assertNotSame($before, $after, 'Successful login must rotate the web session id (anti-fixation).');

        // WhatsApp runs as an external daemon configured via config, not stored
        // in the admin web session -> web session rotation never disconnects it.
        $this->assertFalse(session()->has('whatsapp_connection'));
        $this->assertIsString(config('services.whatsapp.default_provider'));
    }
}
