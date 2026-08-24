<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Price history append-only (P2-2.3).
 * Riwayat perubahan harga varian; ditulis oleh ProductVariantObserver.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_price_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained('product_variants');
            $table->decimal('price_before', 12, 2);
            $table->decimal('price_after', 12, 2);
            $table->string('source', 32)->default('manual');
            $table->string('reason', 255)->nullable();
            $table->foreignId('changed_by_user_id')->nullable()->constrained('users');
            $table->timestamp('created_at');
            $table->index(['product_variant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_price_logs');
    }
};