<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_messages', function (Blueprint $table) {
            $table->id();
            $table->enum('direction', ['outbound', 'inbound']);
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('phone_number');
            $table->string('internal_template_key')->nullable();
            $table->string('provider_message_id')->nullable();
            $table->text('content_text')->nullable();
            $table->json('content_payload')->nullable();
            $table->enum('status', ['pending', 'sent', 'delivered', 'read', 'failed', 'received'])->default('pending');
            $table->text('error_reason')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamps();

            $table->index('order_id', 'idx_whatsapp_messages_order');
            $table->index('phone_number', 'idx_whatsapp_messages_phone');
            $table->index(['direction', 'status'], 'idx_whatsapp_messages_direction_status');
            $table->index('provider_message_id', 'idx_whatsapp_messages_provider_message_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_messages');
    }
};
