<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('parent_sku')->unique();
            $table->string('name');
            $table->string('short_name')->nullable();
            $table->text('description')->nullable();
            $table->unsignedBigInteger('category_id');
            $table->enum('product_category', ['WINDOW', 'DOOR', 'BOUVEN']);
            $table->enum('product_model', ['JUNGKIT', 'SLIDING', 'SWING', 'KACA_MATI', 'ZIGZAG']);
            $table->enum('design_variant', ['POLOS', 'ORNAMEN', 'KOMBINASI', 'SERIES_A', 'SERIES_B', 'SERIES_C']);
            $table->enum('status', ['active', 'inactive', 'archived', 'draft'])->default('draft');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['product_category', 'product_model', 'design_variant'], 'idx_products_category_model_design');
            $table->index('category_id', 'idx_products_category_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
