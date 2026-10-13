<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // ID wilayah Kemendagri dari dropdown checkout (nullable: order lama
            // dan pilihan via peta tidak selalu punya ID). Dipakai untuk prefill
            // detail pengiriman saat checkout ulang (order terakhir per HP).
            $table->string('shipping_province_id', 20)->nullable()->after('shipping_province');
            $table->string('shipping_city_id', 20)->nullable()->after('shipping_city');
            $table->string('shipping_district_id', 20)->nullable()->after('shipping_district');
            $table->string('shipping_village_id', 20)->nullable()->after('shipping_village');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'shipping_province_id',
                'shipping_city_id',
                'shipping_district_id',
                'shipping_village_id',
            ]);
        });
    }
};
