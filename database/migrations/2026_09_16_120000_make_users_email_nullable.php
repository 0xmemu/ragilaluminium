<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Akun admin tidak memakai email: login memakai username, dan form admin
 * (/admin/users/create, /admin/profile) tidak lagi menyediakan kolom email.
 * Kolom users.email NOT NULL membuat INSERT gagal 500, jadi kolom dibuat
 * nullable. Kolomnya tetap ada untuk login legacy (email unik lama).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
        });
    }
};
