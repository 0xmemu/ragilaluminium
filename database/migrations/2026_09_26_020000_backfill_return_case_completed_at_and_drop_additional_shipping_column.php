<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Dua pembersihan kolom kasus retur:
     *
     * 1. Kasus retur berstatus completed yang `completed_at`-nya kosong diisi
     *    dari waktu perubahan terakhir (atau waktu pembuatan). Seluruh angka
     *    refund dan ongkir retur di Performa Toko disaring dari kolom itu,
     *    sehingga kasus selesai tanpa tanggal hilang diam-diam dari laporan.
     *    Penulisan baru dijaga di OrderReturnCase::booted().
     *
     * 2. `additional_shipping_amount` dibuang: kolom kedua untuk satu fakta
     *    yang sama (ongkir retur ditanggung toko). Formulir admin tidak pernah
     *    mengisinya, sehingga ekspor pesanan selalu membaca nol. Mulai sekarang
     *    satu-satunya kolom ongkir retur adalah `return_shipping_cost`, sama
     *    dengan yang dibaca Performa Toko.
     */
    public function up(): void
    {
        DB::table('order_return_cases')
            ->where('status', 'completed')
            ->whereNull('completed_at')
            ->update([
                'completed_at' => DB::raw('COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)'),
            ]);

        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->dropColumn('additional_shipping_amount');
        });
    }

    public function down(): void
    {
        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->decimal('additional_shipping_amount', 15, 2)->default(0)->after('replacement_amount');
        });
    }
};
