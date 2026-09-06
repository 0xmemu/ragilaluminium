<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->decimal('shipping_chargeable_weight_kg', 10, 3)->nullable()->after('shipping_insurance_amount');
            $table->json('shipping_package_snapshot')->nullable()->after('shipping_chargeable_weight_kg');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['shipping_chargeable_weight_kg', 'shipping_package_snapshot']);
        });
    }
};
