<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * shipping_status semula enum tanpa nilai 'returned', sehingga status
     * kurir "returned"/"shipped" tidak bisa di-cascade ke order. Longgarkan
     * menjadi string agar seluruh milestone J&T tertampung, dengan validasi
     * dipindah ke layer aplikasi (ShippingService::cascadeOrderStatus).
     */
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement("ALTER TABLE orders MODIFY shipping_status VARCHAR(32) NOT NULL DEFAULT 'pending_pickup'");
        } else {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('shipping_status', 32)->default('pending_pickup')->change();
            });
        }

        // Indeks nomor resi untuk lookup webhook & tracking cepat.
        Schema::table('orders', function (Blueprint $table) {
            $table->index('created_at', 'idx_orders_created_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('idx_orders_created_at');
        });
    }
};
