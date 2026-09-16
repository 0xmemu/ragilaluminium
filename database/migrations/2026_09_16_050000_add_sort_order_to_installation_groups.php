<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            if (! Schema::hasColumn('cms_model_products', 'installation_sort_order')) {
                $table->unsignedInteger('installation_sort_order')->default(0)->after('sort_order');
            }
        });

        Schema::table('installation_groups', function (Blueprint $table) {
            if (! Schema::hasColumn('installation_groups', 'sort_order')) {
                $table->unsignedInteger('sort_order')->default(0)->after('title');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->dropColumn('installation_sort_order');
        });

        Schema::table('installation_groups', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
