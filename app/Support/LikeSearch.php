<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

/**
 * Pencarian LIKE yang aman & portabel (§6 boundary).
 *
 * Input user bukan pola LIKE: wildcard `%`, `_`, `\` di-escape agar dicari literal,
 * panjang dibatasi, dan klausa memakai `ESCAPE '\'` eksplisit supaya benar di semua
 * driver (MySQL default `\`, SQLite/PgSQL tidak). Ini satu-satunya titik escape untuk
 * seluruh pencarian (storefront + admin) — jangan tulis `like "%{$q}%"` manual lagi.
 */
class LikeSearch
{
    /** Escape wildcard LIKE agar input user diperlakukan literal. */
    public static function escape(string $value): string
    {
        return addcslashes($value, '\\%_');
    }

    /** Batasi panjang term supaya pola LIKE tidak membengkak. */
    public static function limit(string $value, int $max = 120): string
    {
        return mb_substr(trim($value), 0, $max);
    }

    /** Pattern `%term%` yang aman (ter-escape + terbatas). */
    public static function pattern(string $term): string
    {
        return '%'.self::limit(self::escape($term)).'%';
    }

    /** WHERE col LIKE ? ESCAPE '\' — kolom hardcoded, pattern sebagai binding. */
    public static function whereLike(Builder $query, string $column, string $term): Builder
    {
        return $query->whereRaw(self::expression($column), [self::pattern($term), '\\']);
    }

    /** OR WHERE col LIKE ? ESCAPE '\' */
    public static function orWhereLike(Builder $query, string $column, string $term): Builder
    {
        return $query->orWhereRaw(self::expression($column), [self::pattern($term), '\\']);
    }

    protected static function expression(string $column): string
    {
        return $column.' LIKE ? ESCAPE ?';
    }
}
