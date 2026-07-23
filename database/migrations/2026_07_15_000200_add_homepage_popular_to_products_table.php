<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('homepage_popular')->default(false)->after('status');
            $table->unsignedInteger('homepage_popular_sort')->default(0)->after('homepage_popular');
            $table->index(['homepage_popular', 'homepage_popular_sort'], 'idx_products_homepage_popular');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('idx_products_homepage_popular');
            $table->dropColumn(['homepage_popular', 'homepage_popular_sort']);
        });
    }
};
