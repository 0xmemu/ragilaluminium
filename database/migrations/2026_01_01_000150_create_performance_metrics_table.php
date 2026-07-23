<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('performance_metrics', function (Blueprint $table) {
            $table->id();
            $table->date('metric_date');
            $table->string('metric_name');
            $table->decimal('metric_value', 18, 4);
            $table->json('context')->nullable();
            $table->timestamp('created_at');

            $table->index(['metric_date', 'metric_name'], 'idx_performance_metrics_date_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('performance_metrics');
    }
};
