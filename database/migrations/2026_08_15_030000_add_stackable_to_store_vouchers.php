<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('store_vouchers', function (Blueprint $table): void {
            $table->boolean('stackable')->default(false)->after('min_purchase');
        });
    }

    public function down(): void
    {
        Schema::table('store_vouchers', function (Blueprint $table): void {
            $table->dropColumn('stackable');
        });
    }
};
