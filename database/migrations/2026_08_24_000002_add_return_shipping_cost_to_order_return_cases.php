<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ongkir retur yang ditanggung toko (biaya operasional, bukan pengurang omzet).
 * Wajib > 0 jika fault_party = store; opsional (goodwill) jika customer/other.
 * Forward-only, non-destruktif.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->decimal('return_shipping_cost', 10, 2)
                ->default(0)
                ->comment('Ongkir retur yang ditanggung toko (biaya operasional, bukan pengurang omzet)')
                ->after('additional_shipping_amount');
        });
    }

    public function down(): void
    {
        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->dropColumn('return_shipping_cost');
        });
    }
};