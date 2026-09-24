<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Batas idle sesi admin (keputusan owner 2026-09-24).
 *
 * Admin yang login TANPA mencentang "Tetap Masuk Di Perangkat Ini" harus
 * otomatis logout setelah idle beberapa waktu. Yang mencentang tidak
 * dibatasi.
 */
class AdminSessionIdleTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'username' => 'admin.idle',
            'password' => 'password',
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    public function test_non_remember_session_logs_out_after_idle_timeout(): void
    {
        config(['operations.admin_session_idle_minutes' => 30]);

        $this->admin();

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin.idle',
                'password' => 'password',
            ])
            ->assertRedirect(route('admin.dashboard'));

        $this->assertAuthenticated();

        // Geser penanda aktivitas ke 31 menit lalu (batas 30 menit).
        $this->withSession(['admin_last_activity' => time() - (31 * 60)]);

        $this->get(route('admin.dashboard'))
            ->assertRedirect(route('login'));

        $this->assertGuest();
    }

    public function test_non_remember_session_stays_logged_in_when_active(): void
    {
        config(['operations.admin_session_idle_minutes' => 30]);

        $this->admin();

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin.idle',
                'password' => 'password',
            ])
            ->assertRedirect(route('admin.dashboard'));

        // Aktivitas 5 menit lalu: masih di dalam batas.
        $this->withSession(['admin_last_activity' => time() - (5 * 60)]);

        $this->get(route('admin.dashboard'))->assertOk();

        $this->assertAuthenticated();
    }

    public function test_remember_session_is_not_subject_to_idle_timeout(): void
    {
        config(['operations.admin_session_idle_minutes' => 30]);

        $this->admin();

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin.idle',
                'password' => 'password',
                'remember' => true,
            ])
            ->assertRedirect(route('admin.dashboard'));

        $this->assertAuthenticated();
        $this->assertTrue(session('admin_session_persistent'));

        // Sangat lama idle, sesi ber-remember harus tetap hidup.
        $this->withSession(['admin_last_activity' => time() - (60 * 60 * 24 * 30)]);

        $this->get(route('admin.dashboard'))->assertOk();

        $this->assertAuthenticated();
    }

    public function test_login_always_overwrites_persistent_flag(): void
    {
        config(['operations.admin_session_idle_minutes' => 30]);

        $this->admin();

        // Login pertama mencentang.
        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin.idle',
                'password' => 'password',
                'remember' => true,
            ]);

        $this->assertTrue(session('admin_session_persistent'));

        // Logout lalu login lagi TANPA centang: flag harus ikut berubah.
        $this->post(route('logout'))->assertRedirect(route('login'));

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin.idle',
                'password' => 'password',
            ]);

        $this->assertFalse(session('admin_session_persistent'));
    }

    public function test_idle_timeout_disabled_when_config_is_zero(): void
    {
        config(['operations.admin_session_idle_minutes' => 0]);

        $this->admin();

        $this->from(route('login'))
            ->post(route('login.post'), [
                'login' => 'admin.idle',
                'password' => 'password',
            ])
            ->assertRedirect(route('admin.dashboard'));

        $this->withSession(['admin_last_activity' => time() - (60 * 60 * 24 * 365)]);

        $this->get(route('admin.dashboard'))->assertOk();

        $this->assertAuthenticated();
    }
}
