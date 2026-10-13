<?php

namespace Tests\Unit;

use App\Support\CatalogSearch;
use Tests\TestCase;

class CatalogSearchNormalizeTest extends TestCase
{
    public function test_normalize_reports_original_changed_and_replacements(): void
    {
        $meta = CatalogSearch::normalizeQuery('Jendela slidding');

        $this->assertSame('Jendela slidding', $meta['original']);
        $this->assertSame('Jendela sliding', $meta['normalized']);
        $this->assertTrue($meta['changed']);
        $this->assertContains('slidding → sliding', $meta['replacements']);
    }

    public function test_normalize_keeps_correct_query_unchanged(): void
    {
        $meta = CatalogSearch::normalizeQuery('Jendela Sliding');

        $this->assertFalse($meta['changed']);
        $this->assertSame('Jendela Sliding', $meta['normalized']);
        $this->assertSame([], $meta['replacements']);
    }

    public function test_normalize_is_case_insensitive(): void
    {
        $meta = CatalogSearch::normalizeQuery('SLIDDING Window');

        $this->assertSame('SLIDDING Window', $meta['original']);
        $this->assertSame('sliding Window', $meta['normalized']);
        $this->assertTrue($meta['changed']);
    }

    public function test_normalize_synonym_bouven_to_boven(): void
    {
        $meta = CatalogSearch::normalizeQuery('jendela bouven');

        $this->assertSame('jendela boven', $meta['normalized']);
        $this->assertTrue($meta['changed']);
    }

    public function test_normalize_applies_multiple_replacements(): void
    {
        $meta = CatalogSearch::normalizeQuery('bouven slidding');

        $this->assertSame('boven sliding', $meta['normalized']);
        $this->assertCount(2, $meta['replacements']);
    }

    public function test_exact_dimension_parses_height_width(): void
    {
        $this->assertSame(['height' => 100.0, 'width' => 50.0], CatalogSearch::exactDimension('100x50'));
        $this->assertSame(['height' => 60.0, 'width' => 120.0], CatalogSearch::exactDimension('60 x 120'));
        $this->assertSame(['height' => 70.0, 'width' => 90.0], CatalogSearch::exactDimension('70 × 90'));
        $this->assertNull(CatalogSearch::exactDimension('jendela'));
    }

    public function test_dimension_range_parses_and_normalizes_bounds(): void
    {
        $r = CatalogSearch::dimensionRange('80x100 sampai 85x110');
        $this->assertSame(80.0, $r['hMin']);
        $this->assertSame(100.0, $r['wMin']);
        $this->assertSame(85.0, $r['hMax']);
        $this->assertSame(110.0, $r['wMax']);

        // Bounds terbalik dinormalkan (min/max per sumbu).
        $rev = CatalogSearch::dimensionRange('85x110 sampai 80x100');
        $this->assertSame(80.0, $rev['hMin']);
        $this->assertSame(110.0, $rev['wMax']);

        // Bukan range → null.
        $this->assertNull(CatalogSearch::dimensionRange('100x50'));
        $this->assertNull(CatalogSearch::dimensionRange('jendela'));
    }
}
