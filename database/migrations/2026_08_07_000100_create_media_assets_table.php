<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_assets', function (Blueprint $table) {
            $table->id();
            $table->enum('kind', ['image', 'video'])->default('image');
            $table->string('label')->nullable();
            $table->string('source_url_hash', 64)->nullable()->unique();
            $table->string('checksum', 64)->nullable()->unique();
            $table->text('source_url')->nullable();
            $table->string('object_key')->nullable()->unique();
            $table->json('derivatives')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->unsignedInteger('width_px')->nullable();
            $table->unsignedInteger('height_px')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->foreignId('poster_asset_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->enum('status', ['pending', 'downloading', 'ready', 'failed', 'archived'])->default('pending');
            $table->enum('visibility', ['visible', 'hidden', 'archived'])->default('visible');
            $table->text('error_reason')->nullable();
            $table->foreignId('created_by_import_job_id')->nullable()->constrained('import_jobs')->nullOnDelete();
            $table->foreignId('last_updated_by_import_job_id')->nullable()->constrained('import_jobs')->nullOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['kind', 'status', 'visibility'], 'idx_media_assets_library');
            $table->index('created_at', 'idx_media_assets_created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_assets');
    }
};
