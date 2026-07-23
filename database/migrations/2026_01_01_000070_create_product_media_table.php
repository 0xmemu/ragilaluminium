<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->integer('position')->default(1);
            $table->boolean('is_main_image')->default(false);
            $table->enum('visibility', ['visible', 'archived', 'hidden'])->default('visible');
            $table->text('source_url')->nullable();
            $table->string('stored_path')->nullable();
            $table->text('stored_url')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->integer('width_px')->nullable();
            $table->integer('height_px')->nullable();
            $table->enum('status', ['pending', 'downloading', 'downloaded', 'failed'])->default('pending');
            $table->text('error_reason')->nullable();
            $table->foreignId('created_by_import_job_id')->nullable()->constrained('import_jobs')->nullOnDelete();
            $table->foreignId('last_updated_by_import_job_id')->nullable()->constrained('import_jobs')->nullOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['product_id', 'position'], 'idx_product_media_product');
            $table->index(['product_variant_id', 'position'], 'idx_product_media_variant');
            $table->index('status', 'idx_product_media_status');
            $table->index(['product_id', 'is_main_image'], 'idx_product_media_is_main');
            $table->index('visibility', 'idx_product_media_visibility');
            $table->index('created_by_import_job_id', 'idx_product_media_created_job');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_media');
    }
};
