<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Media setting untuk model produk (kontrak 2026-09-15):
 * - cms_model_products.media_asset_id : gambar utama model, dipilih/diunggah
 *   dari Media Library (bukan lagi tempel URL manual).
 * - cms_model_product_media           : galeri foto model (urut), tampil di
 *   hero halaman detail model bersama foto produk.
 *
 * image_url tetap dipertahankan sebagai snapshot/fallback legacy; nilainya
 * diturunkan dari media asset saat media_asset_id diisi. Lebar kolom
 * dinaikkan karena URL media (R2/CDN) bisa lebih panjang dari 255 karakter.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->string('image_url', 1024)->nullable()->change();
            $table->foreignId('media_asset_id')
                ->nullable()
                ->after('image_url')
                ->constrained('media_assets')
                ->nullOnDelete();
        });

        Schema::create('cms_model_product_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cms_model_product_id')
                ->constrained('cms_model_products')
                ->cascadeOnDelete();
            $table->foreignId('media_asset_id')
                ->constrained('media_assets')
                ->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['cms_model_product_id', 'media_asset_id'], 'cms_model_product_media_unique');
            $table->index(['cms_model_product_id', 'sort_order'], 'cms_model_product_media_order_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cms_model_product_media');

        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('media_asset_id');
            $table->string('image_url', 255)->nullable()->change();
        });
    }
};
