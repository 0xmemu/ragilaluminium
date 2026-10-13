<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Item 6 antrean pekerjaan: penjaga anti-duplikat kasus retur terbuka kini
 * dilevel database. Kolom hasil-hitung (generated column) berisi order_id
 * hanya saat kasus masih open; unique index di atasnya menolak kasus open
 * kedua untuk pesanan yang sama tanpa menghalangi kasus lama yang sudah
 * selesai. Ekspresi CASE dipakai agar sah di MySQL sekaligus SQLite (test).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->unsignedBigInteger('open_guard')->nullable()->storedAs("case when status = 'open' then order_id else null end");
            $table->unique('open_guard', 'uniq_return_cases_open_per_order');
        });
    }

    public function down(): void
    {
        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->dropUnique('uniq_return_cases_open_per_order');
            $table->dropColumn('open_guard');
        });
    }
};
