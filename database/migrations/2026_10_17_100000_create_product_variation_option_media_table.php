<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gambar per OPSI variasi, bukan per kombinasi.
 *
 * Sebelum tabel ini, gambar varian hanya bisa menempel pada kombinasi
 * (product_media.product_variant_id). Akibatnya memilih opsi sumbu kedua
 * (mis. Kaca) menimpa gambar sumbu pertama (mis. Warna), karena tidak ada
 * tempat menyimpan gambar milik satu nilai opsi.
 *
 * Model mengikuti Shopee: satu gambar per opsi, dan hanya satu sumbu per
 * produk yang boleh bergambar (products.image_axis_slot).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variation_option_media', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('variation_slot');
            $table->string('variation_name', 100);
            $table->string('option_value', 255);
            $table->foreignId('media_asset_id')->constrained('media_assets')->cascadeOnDelete();
            $table->string('source_url', 2048)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->foreignId('created_by_import_job_id')->nullable()
                ->constrained('import_jobs')->nullOnDelete();
            $table->timestamps();

            $table->unique(
                ['product_id', 'variation_slot', 'option_value'],
                'pvom_product_slot_option_unique'
            );
            $table->index(['product_id', 'variation_slot'], 'pvom_product_slot_index');
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->unsignedTinyInteger('image_axis_slot')->nullable()->after('design_variant');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn('image_axis_slot');
        });

        Schema::dropIfExists('product_variation_option_media');
    }
};
