<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->string('parent_sku');
            $table->string('variant_sku')->nullable();
            $table->string('name');
            $table->string('variation_1_name')->nullable();
            $table->string('variation_1_option')->nullable();
            $table->string('variation_2_name')->nullable();
            $table->string('variation_2_option')->nullable();
            $table->decimal('unit_price', 12, 2);
            $table->integer('quantity');
            $table->decimal('line_subtotal', 12, 2);
            $table->decimal('line_discount', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2);
            $table->timestamps();

            $table->index('order_id', 'idx_order_items_order');
            $table->index('variant_sku', 'idx_order_items_variant_sku');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
