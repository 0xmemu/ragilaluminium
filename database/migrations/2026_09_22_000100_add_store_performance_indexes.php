<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indeks untuk halaman Performa Toko.
 *
 * Halaman ini satu-satunya yang memindai pesanan, pembayaran, riwayat event,
 * dan kasus retur sekaligus dalam satu permintaan, jadi ia yang pertama
 * melambat saat data bertambah. Tiap indeks di bawah melayani kueri yang
 * benar-benar ada di StorePerformanceService, bukan disiapkan sebagai cadangan:
 * indeks yang tidak dipakai kueri hanya memperlambat penulisan.
 *
 * Kueri yang dilayani, semuanya di app/Services/StorePerformanceService.php:
 * - payments (status, paid_at)            : paymentCounts, pembayaran lunas dalam rentang
 * - payments (payment_method, status)     : paymentCounts, COD dan non-COD dipisah
 * - event_logs (event_type, created_at)   : cancellationCounts, pembatalan dalam rentang
 * - order_return_cases (status, completed_at) : seluruh kueri retur selesai dalam rentang
 * - order_return_cases (created_at)       : returnCounts, retur yang diajukan dalam rentang
 * - orders (created_at, order_status)     : $base, pesanan dibuat dalam rentang
 * - order_items (order_id, variant_sku)   : metrik Produk Terjual per pesanan
 *
 * Pemeriksaan hasIndex membuat migrasi ini aman dijalankan ulang, sehingga tidak
 * gagal bila indeks sudah ada karena dibuat manual di server.
 */
return new class extends Migration
{
    /**
     * @var list<array{table: string, columns: list<string>, name: string}>
     */
    private const INDEKS = [
        ['table' => 'payments', 'columns' => ['status', 'paid_at'], 'name' => 'idx_payments_status_paid_at'],
        ['table' => 'payments', 'columns' => ['payment_method', 'status'], 'name' => 'idx_payments_method_status'],
        ['table' => 'event_logs', 'columns' => ['event_type', 'created_at'], 'name' => 'idx_event_logs_type_created'],
        ['table' => 'order_return_cases', 'columns' => ['status', 'completed_at'], 'name' => 'idx_return_cases_status_completed'],
        ['table' => 'order_return_cases', 'columns' => ['created_at'], 'name' => 'idx_return_cases_created_at'],
        ['table' => 'orders', 'columns' => ['created_at', 'order_status'], 'name' => 'idx_orders_created_status'],
        ['table' => 'order_items', 'columns' => ['order_id', 'variant_sku'], 'name' => 'idx_order_items_order_variant'],
    ];

    public function up(): void
    {
        foreach (self::INDEKS as $indeks) {
            if (Schema::hasIndex($indeks['table'], $indeks['name'])) {
                continue;
            }

            Schema::table($indeks['table'], function (Blueprint $tabel) use ($indeks): void {
                $tabel->index($indeks['columns'], $indeks['name']);
            });
        }
    }

    public function down(): void
    {
        foreach (self::INDEKS as $indeks) {
            if (! Schema::hasIndex($indeks['table'], $indeks['name'])) {
                continue;
            }

            Schema::table($indeks['table'], function (Blueprint $tabel) use ($indeks): void {
                $tabel->dropIndex($indeks['name']);
            });
        }
    }
};
