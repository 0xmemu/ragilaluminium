<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_processing_logs', function (Blueprint $table) {
            $table->id();
            // Polimorfik: MediaAsset (asset upload) atau ProductMedia (media produk)
            $table->string('loggable_type');
            $table->unsignedBigInteger('loggable_id');
            // Denormalisasi label entitas agar mudah dicari & ditampilkan
            $table->string('entity_label')->nullable();
            // queued | processing | success | failed | dedup | archived | downloaded
            $table->string('event');
            $table->text('message')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['loggable_type', 'loggable_id']);
            $table->index('event');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_processing_logs');
    }
};
