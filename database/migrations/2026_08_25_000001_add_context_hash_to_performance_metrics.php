<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Add context_hash + unique (metric_date, metric_name, context_hash) utk
 * mencegah duplikat agregasi harian (fix data integrity 1.1).
 *
 * Prasyarat: duplikat EXISTING sudah di-reaggregate & dihapus (script manual
 * 2026-08-24; backup /root/backups/performance_metrics-20260824-2059.sql).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('performance_metrics', function (Blueprint $table) {
            $table->string('context_hash', 64)->nullable()->after('context');
        });

        // Backfill hash kanonik (null context -> md5('')).
        $rows = DB::table('performance_metrics')->select('id', 'context')->get();
        foreach ($rows as $row) {
            $hash = self::hashContext($row->context);
            DB::table('performance_metrics')
                ->where('id', $row->id)
                ->update(['context_hash' => $hash]);
        }

        Schema::table('performance_metrics', function (Blueprint $table) {
            $table->unique(['metric_date', 'metric_name', 'context_hash'], 'perf_metrics_daily_unique');
        });
    }

    public function down(): void
    {
        Schema::table('performance_metrics', function (Blueprint $table) {
            $table->dropUnique('perf_metrics_daily_unique');
            $table->dropColumn('context_hash');
        });
    }

    /**
     * Hash kanonik context (kunci JSON diurutkan) - identik dgn
     * PerformanceMetric::hashContext().
     */
    public static function hashContext(mixed $context): string
    {
        if ($context === null) {
            return md5('');
        }

        $decoded = is_string($context) ? json_decode($context, true) : $context;
        if (! is_array($decoded)) {
            return md5('');
        }

        $canonical = self::canonicalize($decoded);

        return md5(json_encode($canonical));
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
};