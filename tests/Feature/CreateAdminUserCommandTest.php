<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateAdminUserCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_admin_interactive(): void
    {
        $this->artisan('admin:create')
            ->expectsQuestion('Nama lengkap', 'Owner')
            ->expectsQuestion('Username', 'owner')
            ->expectsQuestion('Email (opsional)', 'owner@ragilaluminium.com')
            ->expectsQuestion('Password (minimal 8 karakter)', 'rahasia123')
            ->expectsOutput("Admin user 'owner' created successfully!")
            ->assertExitCode(0);

        $this->assertDatabaseHas('users', [
            'username' => 'owner',
            'email' => 'owner@ragilaluminium.com',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $user = User::where('username', 'owner')->first();
        $this->assertTrue(Hash::check('rahasia123', $user->password), 'password harus di-hash bcrypt');
    }

    public function test_create_admin_with_options(): void
    {
        $this->artisan('admin:create', [
            '--name' => 'Staff Satu',
            '--username' => 'staff1',
            '--email' => 'staff1@ragilaluminium.com',
            '--password' => 'rahasia123',
            '--role' => 'staff',
        ])->assertExitCode(0);

        $this->assertDatabaseHas('users', [
            'username' => 'staff1',
            'role' => 'staff',
            'status' => 'active',
        ]);
    }

    public function test_username_must_be_unique(): void
    {
        User::create([
            'name' => 'Existing',
            'username' => 'febrian',
            'email' => 'febrian@ragilaluminium.com',
            'password' => Hash::make('rahasia123'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->artisan('admin:create', [
            '--name' => 'Duplikat',
            '--username' => 'febrian',
            '--password' => 'rahasia123',
        ])
            ->expectsOutput("Username 'febrian' sudah ada!")
            ->assertExitCode(1);

        $this->assertSame(1, User::where('username', 'febrian')->count());
    }

    public function test_role_must_be_valid(): void
    {
        $this->artisan('admin:create', [
            '--name' => 'Rogue',
            '--username' => 'rogue',
            '--password' => 'rahasia123',
            '--role' => 'god',
        ])
            ->expectsOutput("Role 'god' tidak valid. Pilihan: admin, staff, viewer.")
            ->assertExitCode(1);

        $this->assertDatabaseMissing('users', ['username' => 'rogue']);
    }

    public function test_password_must_be_at_least_8_characters(): void
    {
        $this->artisan('admin:create', [
            '--name' => 'Lemah',
            '--username' => 'lemah',
            '--password' => 'rahasia123',
            '--role' => 'staff',
        ])->assertExitCode(0);

        // Baris di atas valid; fokus: password pendek ditolak.
        $this->artisan('admin:create', [
            '--name' => 'Pendek',
            '--username' => 'pendek',
            '--password' => '123',
            '--role' => 'staff',
        ])
            ->expectsOutput('Password minimal 8 karakter.')
            ->assertExitCode(1);

        $this->assertDatabaseMissing('users', ['username' => 'pendek']);
    }

    public function test_akun_hasil_create_bisa_masuk_panel_admin(): void
    {
        $this->artisan('admin:create', [
            '--name' => 'Admin Baru',
            '--username' => 'adminbaru',
            '--password' => 'rahasia123',
        ])->assertExitCode(0);

        $user = User::where('username', 'adminbaru')->first();

        $this->assertNotNull($user);
        $this->assertSame('admin', $user->role);
        $this->assertTrue($user->isAdmin(), 'Akun hasil admin:create harus lolos isAdmin() agar bisa masuk panel.');
        $this->assertTrue($user->isActive());
    }
}
