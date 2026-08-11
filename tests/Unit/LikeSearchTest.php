<?php

namespace Tests\Unit;

use App\Support\LikeSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class LikeSearchTest extends TestCase
{
    public function test_escape_makes_wildcards_literal(): void
    {
        $this->assertSame('\%', LikeSearch::escape('%'));
        $this->assertSame('\_', LikeSearch::escape('_'));
        $this->assertSame('\\\\', LikeSearch::escape('\\'));
        $this->assertSame('jendela 100\%', LikeSearch::escape('jendela 100%'));
        $this->assertSame('text polos', LikeSearch::escape('text polos'));
    }

    public function test_limit_truncates_long_terms(): void
    {
        $this->assertSame('a', LikeSearch::limit('a', 1));
        $this->assertSame(str_repeat('x', 120), LikeSearch::limit(str_repeat('x', 500)));
        $this->assertSame('trim', LikeSearch::limit('  trim  ', 50));
    }

    public function test_pattern_wraps_escaped_term_with_percent(): void
    {
        $this->assertSame('%\%%', LikeSearch::pattern('%'));
        $this->assertSame('%text polos%', LikeSearch::pattern('text polos'));
    }

    public function test_where_like_uses_escape_clause(): void
    {
        $query = DB::table('sqlite_master')->select('*');
        $builder = new Builder($query);

        LikeSearch::whereLike($builder, 'name', '100%');

        $sql = $builder->toSql();
        $this->assertStringContainsString('LIKE ? ESCAPE ?', $sql);
        $bindings = $builder->getBindings();
        $this->assertSame('%100\%%', $bindings[0]);
        $this->assertSame('\\', $bindings[1]);
    }
}
