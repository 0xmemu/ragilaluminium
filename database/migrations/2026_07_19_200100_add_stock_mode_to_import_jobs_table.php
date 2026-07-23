<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('import_jobs', function (Blueprint $table) {
            $table->string('stock_mode', 20)->default('file')->after('source_file_path');
            $table->unsignedInteger('manual_stock')->nullable()->after('stock_mode');
        });
    }

    public function down(): void
    {
        Schema::table('import_jobs', function (Blueprint $table) {
            $table->dropColumn(['stock_mode', 'manual_stock']);
        });
    }
};
