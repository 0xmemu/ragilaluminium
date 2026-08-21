<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Asuransi pengiriman opsional (pilihan pembeli di checkout, keputusan
     * owner 2026-08-21). Disimpan terpisah dari shipping_amount agar histori
     * ongkir (freight net) tetap bersih; total order = subtotal + ongkir net
     * + asuransi - voucher + biaya COD.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->decimal('shipping_insurance_amount', 12, 2)->default(0)->after('shipping_subsidy_amount');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn('shipping_insurance_amount');
        });
    }
};
