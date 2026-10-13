<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Item 6 antrean pekerjaan: status pembayaran pesanan yang dibatalkan.
 * Yang belum dibayar menjadi 'cancelled' (tidak menggantung sebagai tagihan),
 * yang sudah dibayar dan uangnya dikembalikan menjadi 'refunded'.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_status', ['pending', 'paid', 'refunded', 'cancelled'])->default('pending')->change();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_status', ['pending', 'paid', 'refunded'])->default('pending')->change();
        });
    }
};
