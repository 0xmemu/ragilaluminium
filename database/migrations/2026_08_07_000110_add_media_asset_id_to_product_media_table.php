<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_media', function (Blueprint $table) {
            $table->foreignId('media_asset_id')
                ->nullable()
                ->after('product_variant_id')
                ->constrained('media_assets')
                ->nullOnDelete();
            $table->index(['media_asset_id', 'visibility'], 'idx_product_media_asset_visibility');
        });
    }

    public function down(): void
    {
        Schema::table('product_media', function (Blueprint $table) {
            $table->dropForeign(['media_asset_id']);
            $table->dropIndex('idx_product_media_asset_visibility');
            $table->dropColumn('media_asset_id');
        });
    }
};
