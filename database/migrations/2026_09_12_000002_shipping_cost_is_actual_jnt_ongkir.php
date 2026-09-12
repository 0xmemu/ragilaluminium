<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * shipping_cost = BIAYA ONGKIR ASLI dari konsol J&T Cargo.
     *
     * Sebelumnya kolom ini diisi $order->shipping_amount, yaitu harga ongkir
     * yang ditagih ke PEMBELI. Itu bukan biaya J&T, jadi tidak ada satu pun
     * angka biaya ekspedisi yang tercatat dan pembukuan hanya memakai asumsi
     * (ongkir pembeli + subsidi + asuransi).
     *
     * Mulai sekarang admin mengisi kolom ini dari konsol J&T saat input resi,
     * dan pembukuan memakai angka itu apa adanya. Kolom dibuat nullable supaya
     * "belum dicatat" bisa dibedakan dari "nol rupiah".
     *
     * Nilai lama dikosongkan karena semantiknya berbeda (harga tagihan pembeli,
     * bukan biaya J&T). Pesanan lama otomatis memakai asumsi checkout seperti
     * sebelumnya, jadi tidak ada angka yang berubah tanpa dasar.
     */
    public function up(): void
    {
        Schema::table('shipping_records', function (Blueprint $table) {
            $table->decimal('shipping_cost', 12, 2)->nullable()->default(null)->change();
        });

        DB::table('shipping_records')->update(['shipping_cost' => null]);
    }

    public function down(): void
    {
        DB::table('shipping_records')->whereNull('shipping_cost')->update(['shipping_cost' => 0]);

        Schema::table('shipping_records', function (Blueprint $table) {
            $table->decimal('shipping_cost', 12, 2)->nullable(false)->default(0)->change();
        });
    }
};
