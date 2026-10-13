<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Setelan media halaman detail model (kontrak 2026-09-15):
 * media_show_product_photos = tampilkan foto produk asli di hero model.
 * Bila dimatikan, hero hanya memakai gambar utama + galeri model.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->boolean('media_show_product_photos')
                ->default(true)
                ->after('media_asset_id');
        });
    }

    public function down(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->dropColumn('media_show_product_photos');
        });
    }
};
