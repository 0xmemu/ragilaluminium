<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Voucher bertarget (keputusan owner 2026-08-20):
     * general = seluruh keranjang (perilaku lama, default);
     * model   = hanya produk dengan product_model = target_model;
     * product = hanya produk dengan id = target_product_id.
     */
    public function up(): void
    {
        Schema::table('store_vouchers', function (Blueprint $table): void {
            $table->string('target_type')->default('general')->after('stackable');
            $table->string('target_model')->nullable()->after('target_type');
            $table->foreignId('target_product_id')->nullable()->after('target_model')
                ->constrained('products')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('store_vouchers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('target_product_id');
            $table->dropColumn(['target_type', 'target_model']);
        });
    }
};
