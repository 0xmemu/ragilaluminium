<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin baru dibuat lewat /admin/users/create tanpa email (field tidak ada di
 * form), tetapi kolom users.email NOT NULL membuat INSERT gagal 500. Email
 * tidak dipakai untuk login admin (login pakai username), jadi kolom dibuat
 * nullable dan form menambah field email opsional untuk pengiriman kredensial.
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
