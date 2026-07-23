<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_faq_items', function (Blueprint $table) {
            $table->string('status', 20)->default('active')->after('category');
            $table->index(['cms_page_id', 'status'], 'idx_cms_faq_items_page_status');
        });
    }

    public function down(): void
    {
        Schema::table('cms_faq_items', function (Blueprint $table) {
            $table->dropIndex('idx_cms_faq_items_page_status');
            $table->dropColumn('status');
        });
    }
};
