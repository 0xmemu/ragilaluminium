<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Validation\ValidationException;

final class ExportSafety
{
    public static function maxRows(): int
    {
        return max(1, (int) config('operations.export_max_rows', 50000));
    }

    public static function assertQueryWithinLimit(Builder|Relation $query): void
    {
        self::assertCountWithinLimit((int) (clone $query)->limit(self::maxRows() + 1)->count());
    }

    public static function assertPerformancePayloadWithinLimit(array $payload): void
    {
        $count = 20;

        foreach (is_array($payload['sections'] ?? null) ? $payload['sections'] : [] as $section) {
            $count += is_countable($section['kpis'] ?? null) ? count($section['kpis']) : 0;
        }

        $count += is_countable($payload['top_products'] ?? null) ? count($payload['top_products']) : 0;
        $count += is_countable($payload['customers'] ?? null) ? count($payload['customers']) : 0;

        foreach (is_array($payload['charts'] ?? null) ? $payload['charts'] : [] as $chart) {
            $count += 2;
            $count += is_countable($chart['series'] ?? null) ? count($chart['series']) : 0;
        }

        self::assertCountWithinLimit($count);
    }

    public static function assertCountWithinLimit(int $count): void
    {
        if ($count <= self::maxRows()) {
            return;
        }

        throw ValidationException::withMessages([
            'export' => 'Export terlalu besar. Gunakan filter atau periode yang lebih kecil.',
        ]);
    }

    public static function writeCsvRow($handle, array $values): void
    {
        fputcsv($handle, self::row($values));
    }

    public static function row(array $values): array
    {
        return array_values(array_map([self::class, 'cell'], $values));
    }

    public static function cell(mixed $value): mixed
    {
        if (! is_string($value) || $value === '') {
            return $value;
        }

        return preg_match('/^\s*[=+\-@]/u', $value) === 1 ? "'".$value : $value;
    }
}
