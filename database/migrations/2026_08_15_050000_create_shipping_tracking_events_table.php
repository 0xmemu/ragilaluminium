<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_tracking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipping_record_id')->constrained('shipping_records')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('provider', 40)->default('jnt');
            $table->string('waybill_number', 100);
            $table->string('provider_status', 80)->nullable();
            $table->string('normalized_status', 40)->nullable();
            $table->string('source', 24)->default('poll');
            $table->string('location', 160)->nullable();
            $table->text('description')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->char('event_hash', 64);
            $table->timestamps();

            $table->unique(['shipping_record_id', 'event_hash'], 'uniq_shipping_tracking_event');
            $table->index(['order_id', 'occurred_at'], 'idx_tracking_events_order_time');
            $table->index(['waybill_number', 'occurred_at'], 'idx_tracking_events_waybill_time');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_tracking_events');
    }
};
