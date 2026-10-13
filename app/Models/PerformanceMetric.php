<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformanceMetric extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'metric_date',
        'metric_name',
        'metric_value',
        'context',
        'context_hash',
        'created_at',
    ];

    protected $casts = [
        'metric_date' => 'date',
        'metric_value' => 'decimal:4',
        'context' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Hash kanonik untuk context (kunci JSON diurutkan).
     * Null/empty context -> md5('') agar tetap tercakup unique index.
     */
    public static function hashContext(mixed $context): string
    {
        if (! is_array($context) || $context === []) {
            return md5('');
        }

        return md5(json_encode(self::canonicalize($context)));
    }

    protected static function canonicalize(array $data): array
    {
        ksort($data);
        foreach ($data as $k => $v) {
            if (is_array($v)) {
                $data[$k] = self::canonicalize($v);
            }
        }

        return $data;
    }
}