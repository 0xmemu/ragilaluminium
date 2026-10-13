<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('pallet_allowance_per_side_cm', 8, 3)->nullable()->after('depth_cm');
            $table->decimal('pallet_weight_kg', 10, 3)->nullable()->after('pallet_allowance_per_side_cm');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['pallet_allowance_per_side_cm', 'pallet_weight_kg']);
        });
    }
};
