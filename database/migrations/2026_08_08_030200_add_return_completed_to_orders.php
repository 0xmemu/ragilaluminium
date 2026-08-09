<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SPESIFIKASI-FINAL §A/E: status baru Retur Selesai.
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('order_status', [
                'pending_payment',
                'processing',
                'shipped',
                'delivered',
                'completed',
                'issue',
                'return_in_process',
                'return_completed',
                'cancelled',
            ])->change();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('order_status', [
                'pending_payment',
                'processing',
                'shipped',
                'delivered',
                'completed',
                'issue',
                'return_in_process',
                'cancelled',
            ])->change();
        });
    }
};
