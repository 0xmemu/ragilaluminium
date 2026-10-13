<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->string('menu_href', 2048)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->dropColumn('menu_href');
        });
    }
};
