<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Balasan admin atas ulasan pelanggan (owner 2026-09-18).
 *
 * Balasan disimpan pada baris ulasan yang sama, bukan sebagai baris baru, supaya
 * teks pelanggan tetap utuh dan tidak pernah ditimpa. Balasan hanya tampil di
 * storefront bila ulasannya sendiri lolos scope published (published + approved),
 * jadi membalas ulasan yang masih pending tidak membocorkan apa pun ke publik.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_testimonials', function (Blueprint $table) {
            $table->text('admin_reply')->nullable()->after('verified_at');
            $table->timestamp('admin_replied_at')->nullable()->after('admin_reply');
            $table->foreignId('admin_reply_admin_id')->nullable()->after('admin_replied_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cms_testimonials', function (Blueprint $table) {
            $table->dropForeign(['admin_reply_admin_id']);
            $table->dropColumn(['admin_reply', 'admin_replied_at', 'admin_reply_admin_id']);
        });
    }
};
