<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stock reservation (P2-3.2) - subsystem SIAP, aktif via config
 * operations.stock_reservation.enabled (default false).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained('product_variants');
            $table->integer('quantity');
            $table->string('status', 16)->default('held'); // held|released|confirmed
            $table->timestamp('expires_at');
            $table->string('reference_type', 32)->nullable();
            $table->bigInteger('reference_id')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('created_at');
            $table->timestamp('updated_at')->nullable();
            $table->index(['status', 'expires_at']);
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_reservations');
    }
};