<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Kampanye diskon (Promo Toko + Flash Sale) — SPESIFIKASI-FINAL §C.
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('type')->default('store'); // store | flash_sale
            $table->string('name');
            $table->string('status')->default('draft'); // draft | scheduled | active | ended | finished
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ends_at')->nullable();
            $table->unsignedTinyInteger('discount_percent');
            $table->boolean('sync_banner')->default(false); // Promo Toko: banner homepage sinkron
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['type', 'status']);
        });

        Schema::create('promotion_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->string('target_type'); // product | sub_model | model
            $table->string('target_id', 64); // id produk / kode model / kode sub model
            $table->boolean('excluded')->default(false); // produk/varian tidak ikut promo
            $table->unsignedTinyInteger('override_discount_percent')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('promotion_id');
            $table->unique(['promotion_id', 'target_type', 'target_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_items');
        Schema::dropIfExists('promotions');
    }
};
