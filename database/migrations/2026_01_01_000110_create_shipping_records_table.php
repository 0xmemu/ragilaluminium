<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('carrier_name');
            $table->string('service_name')->nullable();
            $table->string('waybill_number')->unique();
            $table->decimal('shipping_cost', 12, 2)->default(0);
            $table->enum('status', [
                'pending_pickup', 'in_process', 'in_transit', 'delivered', 'returned', 'cancelled',
            ])->default('pending_pickup');
            $table->string('status_raw')->nullable();
            $table->timestamp('last_status_at')->nullable();
            $table->text('tracking_url')->nullable();
            $table->timestamps();

            $table->index('order_id', 'idx_shipping_records_order');
            $table->index('status', 'idx_shipping_records_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_records');
    }
};
