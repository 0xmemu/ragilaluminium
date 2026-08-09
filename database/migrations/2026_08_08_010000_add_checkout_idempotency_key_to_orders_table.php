<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->uuid('checkout_idempotency_key')
                ->nullable()
                ->unique('uq_orders_checkout_idempotency_key')
                ->after('order_number');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('uq_orders_checkout_idempotency_key');
            $table->dropColumn('checkout_idempotency_key');
        });
    }
};
