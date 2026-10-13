<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hapus kolom mati sub_models.image_url (kontrak 2026-09-16).
 *
 * Kolom tidak pernah terisi (0 baris di produksi) dan tidak dibaca
 * storefront sama sekali: gambar desain/sub model di katalog selalu berasal
 * dari media produk (InertiaCatalog::cardImage), bukan dari tabel ini.
 * Field "URL gambar" di form admin juga dihapus bersamaan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sub_models', function (Blueprint $table) {
            $table->dropColumn('image_url');
        });
    }

    public function down(): void
    {
        Schema::table('sub_models', function (Blueprint $table) {
            $table->string('image_url', 1024)->nullable();
        });
    }
};
