<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Generic CMS pages (hero, cara pemesanan, tentang kami, ketentuan, kebijakan, etc.)
        Schema::create('cms_pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->json('content')->nullable();
            $table->boolean('published')->default(false);
            $table->foreignId('updated_by_admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Homepage banner slides managed from Beranda editor.
        Schema::create('cms_banners', function (Blueprint $table) {
            $table->id();
            $table->string('title')->nullable();
            $table->string('image_url');
            $table->string('link_url')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('published')->default(true);
            $table->timestamps();
        });

        // Model Produk showcase cards.
        Schema::create('cms_model_products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('image_url')->nullable();
            $table->enum('type', ['polos', 'ornamen', 'lainnya'])->default('polos');
            $table->enum('status', ['active', 'draft'])->default('draft');
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // FAQ items.
        Schema::create('cms_faq_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cms_page_id')->constrained('cms_pages')->cascadeOnDelete();
            $table->string('question');
            $table->text('answer');
            $table->string('category')->default('Umum & Profil Toko');
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Masalah & Solusi rows.
        Schema::create('cms_problems_solutions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cms_page_id')->constrained('cms_pages')->cascadeOnDelete();
            $table->text('problem');
            $table->text('solution');
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Hasil Pemasangan gallery.
        Schema::create('cms_gallery_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cms_page_id')->constrained('cms_pages')->cascadeOnDelete();
            $table->string('image_url');
            $table->string('label')->nullable();
            $table->boolean('published')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Testimonials.
        Schema::create('cms_testimonials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cms_page_id')->constrained('cms_pages')->cascadeOnDelete();
            $table->string('customer_name');
            $table->text('message')->nullable();
            $table->string('image_url')->nullable();
            $table->boolean('published')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cms_testimonials');
        Schema::dropIfExists('cms_gallery_items');
        Schema::dropIfExists('cms_problems_solutions');
        Schema::dropIfExists('cms_faq_items');
        Schema::dropIfExists('cms_model_products');
        Schema::dropIfExists('cms_banners');
        Schema::dropIfExists('cms_pages');
    }
};
