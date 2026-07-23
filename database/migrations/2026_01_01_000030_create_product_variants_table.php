<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('variant_sku')->unique();
            $table->string('variation_1_name')->nullable();
            $table->string('variation_1_option')->nullable();
            $table->string('variation_2_name')->nullable();
            $table->string('variation_2_option')->nullable();
            $table->decimal('price', 12, 2);
            $table->integer('stock')->default(0);
            $table->decimal('weight_kg', 8, 3)->nullable();
            $table->decimal('width_cm', 8, 2)->nullable();
            $table->decimal('height_cm', 8, 2)->nullable();
            $table->decimal('depth_cm', 8, 2)->nullable();
            $table->enum('status', ['active', 'inactive', 'archived'])->default('active');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('product_id', 'idx_product_variants_product_id');
        });

        // MySQL utf8mb4: full 4×varchar(255) composite index exceeds 3072-byte limit.
        // Prefix index keeps schema index name; SQLite ignores prefix syntax via driver check.
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement(
                'ALTER TABLE product_variants ADD INDEX idx_product_variants_variations '
                .'(variation_1_name(64), variation_1_option(64), variation_2_name(64), variation_2_option(64))'
            );
        } else {
            Schema::table('product_variants', function (Blueprint $table) {
                $table->index(
                    ['variation_1_name', 'variation_1_option', 'variation_2_name', 'variation_2_option'],
                    'idx_product_variants_variations'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
