<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('orders', 'shipping_district')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('shipping_district')->nullable()->after('shipping_province');
            });
        }

        if (! Schema::hasColumn('orders', 'shipping_village')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('shipping_village')->nullable()->after('shipping_district');
            });
        }
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $columns = array_values(array_filter([
                Schema::hasColumn('orders', 'shipping_village') ? 'shipping_village' : null,
                Schema::hasColumn('orders', 'shipping_district') ? 'shipping_district' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
