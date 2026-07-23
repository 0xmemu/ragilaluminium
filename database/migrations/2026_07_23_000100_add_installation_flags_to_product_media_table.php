<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_media', function (Blueprint $table) {
            $table->boolean('show_in_catalog')->default(true)->after('is_main_image');
            $table->boolean('is_installation')->default(false)->after('show_in_catalog');
            $table->index(
                ['is_installation', 'visibility', 'status'],
                'idx_product_media_installation'
            );
        });
    }

    public function down(): void
    {
        Schema::table('product_media', function (Blueprint $table) {
            $table->dropIndex('idx_product_media_installation');
            $table->dropColumn(['show_in_catalog', 'is_installation']);
        });
    }
};
