<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            // Teks promo khusus layar sempit (owner 2026-10-13). Bar promo di
            // ponsel hanya muat sekitar 40 huruf, sedangkan di desktop kolomnya
            // muat 64. Kolom ini nullable: kosong berarti storefront memakai
            // teks desktop untuk kedua ukuran layar, sehingga bar promo lama
            // tidak berubah tampilannya.
            $table->string('text_mobile', 40)->nullable()->after('text');
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn('text_mobile');
        });
    }
};
