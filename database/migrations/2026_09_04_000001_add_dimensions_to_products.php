<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ADR-021: dimensi & berat adalah ATRIBUT PRODUK (J&T Cargo: berat kg + dimensi
 * kubikasi per paket), bukan per varian. Kolom products diisi dari rata-rata/
 * default varian yang ada; varian tetap menyimpan nilainya agar kombinasi lama
 * tetap valid, namun form admin tidak lagi mengedit per varian.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('weight_kg', 8, 3)->nullable()->after('design_variant');
            $table->decimal('width_cm', 8, 2)->nullable()->after('weight_kg');
            $table->decimal('height_cm', 8, 2)->nullable()->after('width_cm');
            $table->decimal('depth_cm', 8, 2)->nullable()->after('height_cm');
        });

                DB::statement(<<<'SQL'
            UPDATE products
            SET weight_kg = (SELECT MAX(weight_kg) FROM product_variants WHERE product_variants.product_id = products.id),
                width_cm = (SELECT MAX(width_cm) FROM product_variants WHERE product_variants.product_id = products.id),
                height_cm = (SELECT MAX(height_cm) FROM product_variants WHERE product_variants.product_id = products.id),
                depth_cm = (SELECT MAX(depth_cm) FROM product_variants WHERE product_variants.product_id = products.id)
            WHERE weight_kg IS NULL
        SQL);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['weight_kg', 'width_cm', 'height_cm', 'depth_cm']);
        });
    }
};
