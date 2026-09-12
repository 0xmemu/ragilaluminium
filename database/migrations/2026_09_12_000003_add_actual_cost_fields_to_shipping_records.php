<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Rincian biaya ASLI dari J&T Cargo.
     *
     * Endpoint pelacakan (logistics/trace) yang sudah dipakai sehari-hari
     * ternyata mengembalikan rincian tagihan per nomor resi:
     *   totalFreight (total tagihan, SUDAH termasuk asuransi)
     *   freight      (ongkir saja)
     *   insuredFee   (asuransi, terpisah)
     *   weight       (berat tagih versi J&T)
     *
     * Nilai-nilai itu dulu diterima lalu dibuang karena tabel event tidak punya
     * kolom biaya. Kolom-kolom ini menyimpannya supaya pembukuan memakai
     * tagihan J&T yang sebenarnya, bukan asumsi ongkir checkout.
     *
     * shipping_cost tetap jadi TOTAL tagihan J&T (totalFreight), termasuk
     * asuransi, supaya tidak ada penambahan ganda.
     */
    public function up(): void
    {
        Schema::table('shipping_records', function (Blueprint $table) {
            // Ongkir saja, tanpa asuransi.
            $table->decimal('shipping_freight', 12, 2)->nullable()->after('shipping_cost');
            // Asuransi yang ditagih J&T (insuredFee).
            $table->decimal('shipping_insured_fee', 12, 2)->nullable()->after('shipping_freight');
            // Berat tagih versi J&T (angka final, bukan hitungan kami).
            $table->decimal('shipping_chargeable_weight_kg', 8, 2)->nullable()->after('shipping_insured_fee');
            // Kapan rincian biaya terakhir diambil dari J&T.
            $table->timestamp('shipping_cost_synced_at')->nullable()->after('shipping_chargeable_weight_kg');
        });
    }

    public function down(): void
    {
        Schema::table('shipping_records', function (Blueprint $table) {
            $table->dropColumn([
                'shipping_freight',
                'shipping_insured_fee',
                'shipping_chargeable_weight_kg',
                'shipping_cost_synced_at',
            ]);
        });
    }
};
