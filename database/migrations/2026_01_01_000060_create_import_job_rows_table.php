<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_job_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_job_id')->constrained('import_jobs')->cascadeOnDelete();
            $table->integer('row_number');
            $table->json('raw_data')->nullable();
            $table->enum('status', ['pending', 'processed', 'success', 'failed'])->default('pending');
            $table->text('error_reason')->nullable();
            $table->foreignId('linked_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('linked_product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['import_job_id', 'row_number'], 'idx_import_job_rows_job');
            $table->index('status', 'idx_import_job_rows_status');
            $table->index('linked_product_id', 'idx_import_job_rows_linked_product');
            $table->index('linked_product_variant_id', 'idx_import_job_rows_linked_variant');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_job_rows');
    }
};
