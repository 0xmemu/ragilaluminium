<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambah kolom admin_seen_status ke tabel orders.
     * Kolom ini mencatat status pesanan terakhir yang sudah dilihat atau
     * ditindaklanjuti oleh admin. Bila nilai ini berbeda dengan order_status saat ini
     * (atau masih null pada pesanan baru), maka pesanan tersebut dianggap "baru"
     * untuk tab status terkait dan memunculkan badge merah di kanan atas tab.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('admin_seen_status', 32)
                ->nullable()
                ->after('order_status')
                ->index('idx_orders_admin_seen_status');
        });

        // Untuk pesanan yang sudah ada di database saat migrasi ini berjalan:
        // tandai status saat ini sebagai sudah dilihat agar tidak memunculkan badge
        // merah palsu massal untuk data riwayat lama, kecuali pesanan yang notifikasinya
        // masih belum dibaca oleh admin.
        DB::table('orders')->update([
            'admin_seen_status' => DB::raw('order_status'),
        ]);

        $unreadOrderIds = DB::table('admin_notifications')
            ->whereNotNull('order_id')
            ->whereNull('read_at')
            ->pluck('order_id');

        if ($unreadOrderIds->isNotEmpty()) {
            DB::table('orders')
                ->whereIn('id', $unreadOrderIds)
                ->update(['admin_seen_status' => null]);
        }
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('idx_orders_admin_seen_status');
            $table->dropColumn('admin_seen_status');
        });
    }
};
