<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * shipping_records.status: ENUM(6) -> VARCHAR(32).
 * Pipeline tracking J&T diperluas ke 17 status (tracking_pending, label_created,
 * pickup_scheduled, picked_up, shipment_received, processing, in_transit,
 * arrived_destination, out_for_delivery, delivery_attempted, delivered,
 * return_initiated, returned_to_sender, lost, damaged, exception, unknown)
 * + legacy (pending_pickup, in_process, returned, cancelled).
 * Docs database-schema-ragil-aluminium.md sudah menyatakan VARCHAR — migration
 * ini menyelaraskan implementasi dengan docs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipping_records', function (Blueprint $table) {
            $table->string('status', 32)->default('pending_pickup')->change();
        });
    }

    public function down(): void
    {
        Schema::table('shipping_records', function (Blueprint $table) {
            $table->enum('status', [
                'pending_pickup', 'in_process', 'in_transit', 'delivered', 'returned', 'cancelled',
            ])->default('pending_pickup')->change();
        });
    }
};
