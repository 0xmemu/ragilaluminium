<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class RemoveLegacyFlashSaleAttributes extends Migration
{
    /**
     * Konsolidasi Flash Sale: hapus atribut legacy (promo_flash_sale/flash_sale + promo_compare_price)
     * setelah source-truth pindah ke kampanye (ADR Flash Sale konsolidasi).
     * Forward-only: data legacy usang; kampanye adalah sumber kebenaran.
     */
    public function up(): void
    {
        DB::table('product_attributes')
            ->whereIn('attribute_name', ['promo_flash_sale', 'flash_sale', 'promo_compare_price'])
            ->delete();
    }

    public function down(): void
    {
        // Tidak dapat dikembalikan secara aman (data usang); konsolidasi permanen.
    }
}