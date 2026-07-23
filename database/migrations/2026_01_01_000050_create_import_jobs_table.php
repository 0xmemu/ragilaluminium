<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_jobs', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['shopee_mass_upload', 'shopee_mass_update', 'internal_bulk_update']);
            $table->string('source_file_name');
            $table->string('source_file_path')->nullable();
            $table->integer('total_rows')->nullable();
            $table->integer('processed_rows')->default(0);
            $table->integer('success_rows')->default(0);
            $table->integer('failed_rows')->default(0);
            $table->enum('status', ['pending', 'running', 'completed', 'failed'])->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('global_error_message')->nullable();
            $table->foreignId('triggered_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status', 'idx_import_jobs_status');
            $table->index('type', 'idx_import_jobs_type');
            $table->index('triggered_by_user_id', 'idx_import_jobs_triggered_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_jobs');
    }
};
