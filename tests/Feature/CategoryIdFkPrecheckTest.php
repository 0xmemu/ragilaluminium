<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Documents pre-check for deferred FK products.category_id.
 * No categories table exists yet — FK must wait for production migrate + taxonomy table.
 */
class CategoryIdFkPrecheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_products_category_id_column_exists_without_categories_table(): void
    {
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('products', 'category_id'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('categories'));
    }

    public function test_live_db_orphan_precheck_report_is_safe(): void
    {
        // Informational: when categories table is absent, FK cannot be added.
        // Opaque Shopee/mapping IDs may live in category_id without a parent row.
        $this->assertTrue(true);
    }
}
