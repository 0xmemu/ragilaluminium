<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mengembalikan kolom ongkir perjalanan balik ke tabel kasus retur.
 *
 * Kolom ini pernah ada di tabel yang sama lalu dibuang 2026-09-26 karena
 * diduga duplikat return_shipping_cost. Item 11 antrean (2026-09-27)
 * memakainya lagi untuk fakta yang BERBEDA, yaitu tagihan pengembalian dari
 * J&T, tetapi migrasi penambahnya tidak pernah dibuat dan blok penulisnya
 * memanggil variabel yang tidak terdefinisi, sehingga isian di popup
 * penyelesaian retur tidak pernah tersimpan dan penyelesaian yang mengirim
 * isian itu pasti gagal 500. Keputusan owner 2026-09-29 membuat fakta itu
 * dihitung Performa Toko, jadi kolomnya wajib ada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->decimal('additional_shipping_amount', 15, 2)->default(0)->after('return_shipping_cost');
        });
    }

    public function down(): void
    {
        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->dropColumn('additional_shipping_amount');
        });
    }
};
