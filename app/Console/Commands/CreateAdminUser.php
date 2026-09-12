<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * Buat user admin baru via CLI (production-safe, tanpa UI).
 *
 * Mode interaktif:            php artisan admin:create
 * Mode non-interaktif:        php artisan admin:create --name="Owner" --username="owner" \
 *                                 --email="owner@ragilaluminium.com" --password="..." --role="admin"
 *
 * Validasi: username unik, email unik (bila diisi), role enum valid,
 * password min 8 karakter. Password di-hash bcrypt; status default active.
 */
class CreateAdminUser extends Command
{
    protected $signature = 'admin:create
        {--name= : Nama lengkap admin}
        {--username= : Username (unik, dipakai login)}
        {--email= : Email admin (opsional)}
        {--password= : Password minimal 8 karakter}
        {--role=admin : Role kanonik admin (staff|viewer tidak punya akses panel)}';

    protected $description = 'Buat user admin baru (interaktif atau via opsi).';

    public function handle(): int
    {
        // Mode interaktif penuh hanya bila nama/username/password TIDAK
        // diberikan sebagai opsi (email & role menyusul secara interaktif).
        $providedAll = $this->option('name') !== null
            && $this->option('username') !== null
            && $this->option('password') !== null;

        $name = $this->option('name')
            ?? $this->ask('Nama lengkap');
        $username = $this->option('username')
            ?? $this->ask('Username');

        if (! $providedAll) {
            $emailOpt = trim((string) ($this->option('email') ?? ''));
            if ($emailOpt === '') {
                $emailOpt = trim((string) ($this->ask('Email (opsional)') ?? ''));
            }
            $email = $emailOpt;

            $role = $this->option('role')
                ?: $this->choice('Role', ['admin', 'staff', 'viewer'], 0);
        } else {
            $email = trim((string) ($this->option('email') ?? ''));
            $role = $this->option('role') ?: 'admin';
        }

        $password = $this->option('password')
            ?? $this->secret('Password (minimal 8 karakter)');

        $roles = ['admin', 'staff', 'viewer'];

        if (! $password || mb_strlen((string) $password) < 8) {
            $this->error('Password minimal 8 karakter.');

            return self::FAILURE;
        }

        if (! in_array($role, $roles, true)) {
            $this->error("Role '{$role}' tidak valid. Pilihan: ".implode(', ', $roles).'.');

            return self::FAILURE;
        }

        if (blank(trim((string) $username))) {
            $this->error('Username tidak boleh kosong.');

            return self::FAILURE;
        }

        if (User::query()->where('username', $username)->exists()) {
            $this->error("Username '{$username}' sudah ada!");

            return self::FAILURE;
        }

        if ($email !== '' && User::query()->where('email', $email)->exists()) {
            $this->error("Email '{$email}' sudah terdaftar!");

            return self::FAILURE;
        }

        User::create([
            'name' => $name,
            'username' => $username,
            'email' => $email,
            'password' => Hash::make($password),
            'role' => $role,
            'status' => 'active',
        ]);

        $this->info("Admin user '{$username}' created successfully!");

        return self::SUCCESS;
    }
}