<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            // Sumber diskon baris: flashsale | reg. Diisi saat checkout dari
            // PriceService::flash_sale (CartService::priceFor).
            $table->string('discount_source', 20)->default('reg')->after('line_discount');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropColumn('discount_source');
        });
    }
};
