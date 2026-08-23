<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Paket 1 (Sprint 2 retur): tambah kolom ke order_return_cases & order_return_items.
 * Forward-only, non-destruktif: hanya menambah kolom nullable/default.
 * Dasar: docs/desain-teknis-retur-sprint2.md
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->string('reason_detail')->nullable()->after('reason');
            $table->string('fault_party', 20)->default('other')->after('reason_detail');
            $table->boolean('shipping_cost_borne_by_store')->default(false)->after('fault_party');
        });

        Schema::table('order_return_items', function (Blueprint $table) {
            $table->foreignId('replacement_product_id')->nullable()->after('returned_quantity');
            $table->foreignId('replacement_variant_id')->nullable()->after('replacement_product_id');
            $table->integer('replacement_quantity')->nullable()->after('replacement_variant_id');
        });
    }

    public function down(): void
    {
        Schema::table('order_return_items', function (Blueprint $table) {
            $table->dropColumn(['replacement_product_id', 'replacement_variant_id', 'replacement_quantity']);
        });

        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->dropColumn(['reason_detail', 'fault_party', 'shipping_cost_borne_by_store']);
        });
    }
};