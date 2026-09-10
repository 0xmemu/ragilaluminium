<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('cms_model_products', 'type')) {
            Schema::table('cms_model_products', function (Blueprint $table): void {
                $table->dropColumn('type');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('cms_model_products', 'type')) {
            Schema::table('cms_model_products', function (Blueprint $table): void {
                $table->enum('type', ['polos', 'ornamen', 'lainnya'])->default('polos')->after('name');
            });
        }
    }
};
