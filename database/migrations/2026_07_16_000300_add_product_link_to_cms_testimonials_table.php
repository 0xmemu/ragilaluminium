<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_testimonials', function (Blueprint $table) {
            $table->foreignId('product_id')
                ->nullable()
                ->after('cms_page_id')
                ->constrained('products')
                ->nullOnDelete();
            $table->unsignedTinyInteger('rating')->nullable()->after('message');
            $table->string('source', 32)->default('other')->after('rating');
            $table->string('location')->nullable()->after('source');
            $table->index(['product_id', 'published'], 'cms_testimonials_product_published_idx');
        });
    }

    public function down(): void
    {
        Schema::table('cms_testimonials', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropIndex('cms_testimonials_product_published_idx');
            $table->dropColumn(['product_id', 'rating', 'source', 'location']);
        });
    }
};
