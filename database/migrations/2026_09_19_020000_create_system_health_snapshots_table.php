<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_health_snapshots', function (Blueprint $table) {
            $table->id();
            $table->timestamp('taken_at');
            $table->decimal('load_1', 8, 4)->nullable();
            $table->decimal('load_5', 8, 4)->nullable();
            $table->decimal('load_15', 8, 4)->nullable();
            $table->decimal('memory_used_mb', 10, 2)->nullable();
            $table->decimal('memory_total_mb', 10, 2)->nullable();
            $table->decimal('memory_pct', 5, 2)->nullable();
            $table->decimal('disk_used_gb', 10, 2)->nullable();
            $table->decimal('disk_total_gb', 10, 2)->nullable();
            $table->decimal('disk_pct', 5, 2)->nullable();
            $table->decimal('db_response_ms', 8, 2)->nullable();
            $table->integer('queue_backlog')->nullable();
            $table->decimal('php_memory_mb', 10, 2)->nullable();
            $table->decimal('php_peak_mb', 10, 2)->nullable();
            $table->timestamps();

            $table->index('taken_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_health_snapshots');
    }
};
