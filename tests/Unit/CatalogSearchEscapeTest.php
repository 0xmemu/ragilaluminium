<?php

namespace Tests\Unit;

use App\Support\CatalogSearch;
use ReflectionMethod;
use Tests\TestCase;

class CatalogSearchEscapeTest extends TestCase
{
    /**
     * Invoke protected static escapeLikeWildcards().
     */
    private function escape(string $value): string
    {
        $ref = new ReflectionMethod(CatalogSearch::class, 'escapeLikeWildcards');
        $ref->setAccessible(true);

        return $ref->invoke(null, $value);
    }

    public function test_percent_wildcard_is_escaped(): void
    {
        $this->assertSame('100\\%', $this->escape('100%'));
        $this->assertSame('\\%', $this->escape('%'));
        $this->assertSame('a\\%b\\%c', $this->escape('a%b%c'));
    }

    public function test_underscore_wildcard_is_escaped(): void
    {
        $this->assertSame('\\_', $this->escape('_'));
        $this->assertSame('window\\_jungkit', $this->escape('window_jungkit'));
    }

    public function test_backslash_is_escaped(): void
    {
        $this->assertSame('a\\\\b', $this->escape('a\\b'));
    }

    public function test_plain_text_is_untouched(): void
    {
        $this->assertSame('jendela sliding', $this->escape('jendela sliding'));
        $this->assertSame('100x50', $this->escape('100x50'));
        $this->assertSame('', $this->escape(''));
    }

    public function test_mixed_wildcards_all_escaped(): void
    {
        $this->assertSame('100\\%\\_diskon\\_khusus\\_50\\%', $this->escape('100%_diskon_khusus_50%'));
    }
}
