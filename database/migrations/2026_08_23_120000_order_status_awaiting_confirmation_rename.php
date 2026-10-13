<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Status order: 'pending_payment' -> 'awaiting_confirmation' (2026-08-23).
 *
 * Semua order baru mulai dari 'awaiting_confirmation' (menunggu konfirmasi pesanan),
 * bukan 'pending_payment'. Migration ini: (1) alter ENUM kolom orders.order_status agar
 * anggota 'pending_payment' diganti 'awaiting_confirmation', (2) update data lama.
 * Hanya MySQL (produksi/dev). Idempotent untuk retry aman.
 */
class OrderStatusAwaitingConfirmationRename extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            echo "Skip rename order_status (driver: ".DB::getDriverName().").\n";

            return;
        }

        $col = DB::select("SHOW COLUMNS FROM orders LIKE 'order_status'");
        $type = $col[0]->Type ?? '';

        // Idempotent: lewati bila sudah memakai awaiting_confirmation
        if (str_contains($type, 'awaiting_confirmation') && ! str_contains($type, 'pending_payment')) {
            echo "order_status sudah memakai awaiting_confirmation. Selesai.\n";

            return;
        }

        DB::statement("ALTER TABLE orders MODIFY COLUMN order_status ENUM(
            'awaiting_confirmation','processing','shipped','delivered',
            'completed','issue','return_in_process','return_completed','cancelled'
        ) DEFAULT 'awaiting_confirmation'");

        DB::table('orders')
            ->where('order_status', 'pending_payment')
            ->update(['order_status' => 'awaiting_confirmation']);
    }

    public function down(): void
    {
        // Forward-only: tidak ada rollback andal.
    }
}