<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->string('product_category', 32)->nullable()->after('name');
            $table->string('product_model', 64)->nullable()->after('product_category');
            $table->index(['product_category', 'product_model'], 'cms_model_products_category_model_idx');
        });
    }

    public function down(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->dropIndex('cms_model_products_category_model_idx');
            $table->dropColumn(['product_category', 'product_model']);
        });
    }
};
