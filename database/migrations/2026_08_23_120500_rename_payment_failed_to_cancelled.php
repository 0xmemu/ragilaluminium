<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rename payments.status 'failed' -> 'cancelled' (2026-08-23).
 *
 * Status 'failed' untuk pembayaran tidak pernah dipicu oleh event apa pun
 * (tidak ada kode yang men-set-nya untuk Payment). Sebaliknya, pembatalan order
 * (ADR-006: hanya valid sebelum shipment) meninggalkan payment pending tertahan.
 * Status yang lebih jujur untuk "pembayaran dibatalkan karena order batal"
 * adalah 'cancelled', bukan 'failed'. Implementasi: cancel() menandai
 * payment pending -> cancelled, payment completed -> refunded.
 *
 * Hanya MySQL (produksi/dev). Forward-only.
 */
class RenamePaymentFailedToCancelled extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            echo "Skip rename payments.status (driver: ".DB::getDriverName().").\n";

            return;
        }

        DB::statement("ALTER TABLE payments MODIFY COLUMN status ENUM(
            'pending','completed','cancelled','refunded'
        ) DEFAULT 'pending'");

        // Data lama: payment berstatus 'failed' (jika ada) jadi 'cancelled'
        DB::table('payments')->where('status', 'failed')->update(['status' => 'cancelled']);
    }

    public function down(): void
    {
        // Forward-only: tidak ada rollback andal.
    }
}