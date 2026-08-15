<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_testimonials', function (Blueprint $table) {
            $table->foreignId('order_id')->nullable()->after('product_id')->constrained('orders')->nullOnDelete();
            $table->foreignId('author_admin_id')->nullable()->after('order_id')->constrained('users')->nullOnDelete();
            $table->string('author_type', 24)->default('customer')->after('author_admin_id');
            $table->string('moderation_status', 24)->default('approved')->after('author_type');
            $table->string('source_reference', 2048)->nullable()->after('source');
            $table->json('media_items')->nullable()->after('image_urls');
            $table->timestamp('verified_at')->nullable()->after('moderation_status');
            $table->index(['moderation_status', 'published'], 'cms_testimonials_moderation_published_idx');
            $table->index(['order_id', 'author_type'], 'cms_testimonials_order_author_idx');
        });
    }

    public function down(): void
    {
        Schema::table('cms_testimonials', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
            $table->dropForeign(['author_admin_id']);
            $table->dropIndex('cms_testimonials_moderation_published_idx');
            $table->dropIndex('cms_testimonials_order_author_idx');
            $table->dropColumn(['order_id', 'author_admin_id', 'moderation_status', 'source_reference', 'media_items', 'verified_at']);
        });
    }
};
