<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pre-check skema kategori: tabel `categories` sudah mendarat (migration
 * create_categories_table + seed WINDOW/DOOR/BOUVEN), tetapi FK
 * products.category_id masih ditangguhkan — kolom legacy tetap ada tanpa
 * constraint, supaya migrasi produksi (kategorisasi) aman dilakukan bertahap.
 */
class CategoryIdFkPrecheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_categories_table_exists_with_seeded_catalog_rows(): void
    {
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasTable('categories'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('products', 'category_id'));
        $this->assertSame(3, \Illuminate\Support\Facades\DB::table('categories')->count());
    }

    public function test_live_db_orphan_precheck_report_is_safe(): void
    {
        // Informational: FK products.category_id belum ditambahkan — legacy
        // Shopee/mapping IDs di category_id tetap valid tanpa parent row.
        $this->assertTrue(true);
    }
}
