<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->string('variation_3_name', 64)->nullable()->after('variation_2_option');
            $table->string('variation_3_option', 64)->nullable()->after('variation_3_name');
            $table->string('variation_4_name', 64)->nullable()->after('variation_3_option');
            $table->string('variation_4_option', 64)->nullable()->after('variation_4_name');
            $table->string('variation_5_name', 64)->nullable()->after('variation_4_option');
            $table->string('variation_5_option', 64)->nullable()->after('variation_5_name');
        });

        // Composite index update: jika MySQL, ganti index dengan versi baru (tambah 3-5)
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE product_variants DROP INDEX idx_product_variants_variations');
            DB::statement(
                'ALTER TABLE product_variants ADD INDEX idx_product_variants_variations '
                .'(variation_1_name(64), variation_1_option(64), '
                .'variation_2_name(64), variation_2_option(64), '
                .'variation_3_name(64), variation_3_option(64))'
            );
        }
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn(['variation_3_name', 'variation_3_option', 'variation_4_name', 'variation_4_option', 'variation_5_name', 'variation_5_option']);
        });
    }
};