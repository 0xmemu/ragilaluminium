<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_attributes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();
            $table->string('attribute_name');
            $table->string('attribute_value');
            $table->enum('source', ['shopee', 'internal'])->default('internal');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('product_id', 'idx_product_attributes_product');
            $table->index('product_variant_id', 'idx_product_attributes_variant');
            $table->index('attribute_name', 'idx_product_attributes_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_attributes');
    }
};
