<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installation_projects', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('category_label')->nullable();
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive', 'archived'])->default('active')->index();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->foreignId('model_product_id')->nullable()->constrained('cms_model_products')->nullOnDelete();
            $table->string('main_image_url', 1024)->nullable();
            $table->foreignId('main_image_asset_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->string('main_video_url', 1024)->nullable();
            $table->foreignId('main_video_asset_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->json('gallery_images')->nullable();
            $table->json('specifications')->nullable();
            $table->json('features')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installation_projects');
    }
};
