<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Media hasil pemasangan tidak wajib terikat SKU:
 * - product_id  -> nullable (Kasus B: milik model saja, Kasus C: mandiri)
 * - model_product_id -> baru (menaut media ke model produk tanpa SKU)
 *
 * Sumber tunggal: product_media.is_installation. Storefront tidak berubah
 * tampilannya; media level-model kini punya rumah sah di tabel yang sama.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_media', function (Blueprint $table) {
            $table->foreignId('model_product_id')
                ->nullable()
                ->after('product_id')
                ->constrained('cms_model_products')
                ->nullOnDelete();
        });

        // Lepaskan foreign key + index product_id sebelum membuat nullable.
        Schema::table('product_media', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
        });

        Schema::table('product_media', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->nullable()->change();
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
            $table->index(['model_product_id', 'is_installation', 'visibility', 'status'], 'idx_pm_model_installation');
        });
    }

    public function down(): void
    {
        Schema::table('product_media', function (Blueprint $table) {
            $table->dropForeign(['model_product_id']);
            $table->dropIndex('idx_pm_model_installation');
            $table->dropColumn('model_product_id');
        });
    }
};
