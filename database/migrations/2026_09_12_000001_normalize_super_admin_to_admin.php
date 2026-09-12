<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Semua akun dashboard setara, role kanonik hanya `admin`.
 *
 * Akun ber-role `super_admin` tidak bisa masuk panel sama sekali karena
 * User::isAdmin() hanya menerima role `admin`. Akun seperti itu muncul dari
 * command admin:create yang dulu memakai `super_admin` sebagai default.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'super_admin')
            ->update(['role' => 'admin']);
    }

    public function down(): void
    {
        // Tidak dikembalikan: role super_admin sudah tidak dipakai.
    }
};
