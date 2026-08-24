<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stock movement audit trail (P2-3.1).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained('product_variants');
            $table->integer('stock_before')->default(0);
            $table->integer('stock_after')->default(0);
            $table->integer('quantity'); // delta signed: + masuk, - keluar
            $table->string('movement_type', 32); // order_out|order_cancel_in|order_adjust|order_item_removed|manual|import|system
            $table->string('reference_type', 32)->nullable();
            $table->bigInteger('reference_id')->nullable();
            $table->string('reason', 255)->nullable();
            $table->foreignId('changed_by_user_id')->nullable()->constrained('users');
            $table->timestamp('created_at');
            $table->index(['product_variant_id', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};