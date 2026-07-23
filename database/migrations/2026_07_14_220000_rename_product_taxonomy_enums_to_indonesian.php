<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Samakan enum taxonomy dengan bahasa tampilan publik.
 * FIXED→KACA_MATI, ORNAMENT→ORNAMEN, PLAIN→POLOS, COMBINATION→KOMBINASI.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('products')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            $this->migrateSqlite();

            return;
        }

        DB::table('products')->where('product_model', 'FIXED')->update(['product_model' => 'KACA_MATI']);
        DB::table('products')->where('design_variant', 'ORNAMENT')->update(['design_variant' => 'ORNAMEN']);
        DB::table('products')->where('design_variant', 'PLAIN')->update(['design_variant' => 'POLOS']);
        DB::table('products')->where('design_variant', 'COMBINATION')->update(['design_variant' => 'KOMBINASI']);

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE products MODIFY product_model ENUM('JUNGKIT','SLIDING','SWING','KACA_MATI','ZIGZAG') NOT NULL");
            DB::statement("ALTER TABLE products MODIFY design_variant ENUM('POLOS','ORNAMEN','KOMBINASI','SERIES_A','SERIES_B','SERIES_C') NOT NULL");
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('products')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            $this->remapSqlite([
                'KACA_MATI' => 'FIXED',
                'ORNAMEN' => 'ORNAMENT',
                'POLOS' => 'PLAIN',
                'KOMBINASI' => 'COMBINATION',
            ], true);

            return;
        }

        DB::table('products')->where('product_model', 'KACA_MATI')->update(['product_model' => 'FIXED']);
        DB::table('products')->where('design_variant', 'ORNAMEN')->update(['design_variant' => 'ORNAMENT']);
        DB::table('products')->where('design_variant', 'POLOS')->update(['design_variant' => 'PLAIN']);
        DB::table('products')->where('design_variant', 'KOMBINASI')->update(['design_variant' => 'COMBINATION']);

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE products MODIFY product_model ENUM('JUNGKIT','SLIDING','SWING','FIXED','ZIGZAG') NOT NULL");
            DB::statement("ALTER TABLE products MODIFY design_variant ENUM('PLAIN','ORNAMENT','COMBINATION','SERIES_A','SERIES_B','SERIES_C') NOT NULL");
        }
    }

    private function migrateSqlite(): void
    {
        $this->remapSqlite([
            'FIXED' => 'KACA_MATI',
            'ORNAMENT' => 'ORNAMEN',
            'PLAIN' => 'POLOS',
            'COMBINATION' => 'KOMBINASI',
        ], false);
    }

    /**
     * SQLite: ganti nilai + buang CHECK enum dengan rebuild kolom string.
     * Index composite harus di-drop dulu sebelum drop column.
     *
     * @param  array<string, string>  $map
     */
    private function remapSqlite(array $map, bool $rollback): void
    {
        try {
            Schema::table('products', function (Blueprint $table) {
                $table->dropIndex('idx_products_category_model_design');
            });
        } catch (\Throwable) {
            // Index mungkin sudah ter-drop dari percobaan migrasi sebelumnya.
        }

        if (! Schema::hasColumn('products', 'product_model_v2')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('product_model_v2', 40)->nullable();
                $table->string('design_variant_v2', 40)->nullable();
            });
        }

        $modelFrom = $rollback ? 'KACA_MATI' : 'FIXED';
        $modelTo = $rollback ? 'FIXED' : 'KACA_MATI';
        DB::statement("UPDATE products SET product_model_v2 = CASE product_model WHEN '{$modelFrom}' THEN '{$modelTo}' ELSE product_model END");

        $designCase = $rollback
            ? "CASE design_variant WHEN 'ORNAMEN' THEN 'ORNAMENT' WHEN 'POLOS' THEN 'PLAIN' WHEN 'KOMBINASI' THEN 'COMBINATION' ELSE design_variant END"
            : "CASE design_variant WHEN 'ORNAMENT' THEN 'ORNAMEN' WHEN 'PLAIN' THEN 'POLOS' WHEN 'COMBINATION' THEN 'KOMBINASI' ELSE design_variant END";
        DB::statement("UPDATE products SET design_variant_v2 = {$designCase}");

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['product_model', 'design_variant']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('product_model', 40)->nullable();
            $table->string('design_variant', 40)->nullable();
        });

        DB::statement('UPDATE products SET product_model = product_model_v2, design_variant = design_variant_v2');

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['product_model_v2', 'design_variant_v2']);
            $table->index(['product_category', 'product_model', 'design_variant'], 'idx_products_category_model_design');
        });
    }
};
