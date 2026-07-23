<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_logs', function (Blueprint $table) {
            $table->id();
            $table->string('event_type');
            $table->string('entity_type');
            $table->unsignedBigInteger('entity_id');
            $table->json('payload')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at');

            $table->index(['entity_type', 'entity_id'], 'idx_event_logs_entity');
            $table->index('event_type', 'idx_event_logs_event_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_logs');
    }
};
