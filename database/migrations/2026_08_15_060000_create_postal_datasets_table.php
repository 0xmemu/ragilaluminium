<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('postal_datasets', function (Blueprint $table) {
            $table->id();
            $table->string('source', 80);
            $table->string('version', 64);
            $table->string('source_url', 500)->nullable();
            $table->string('reference_source', 120)->nullable();
            $table->string('reference_url', 500)->nullable();
            $table->date('published_at')->nullable();
            $table->timestamp('retrieved_at')->nullable();
            $table->char('checksum_sha256', 64)->nullable();
            $table->string('status', 16)->default('staged');
            $table->unsignedInteger('row_count')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['source', 'version'], 'uq_postal_dataset_source_version');
            $table->index(['status', 'retrieved_at'], 'idx_postal_dataset_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('postal_datasets');
    }
};
