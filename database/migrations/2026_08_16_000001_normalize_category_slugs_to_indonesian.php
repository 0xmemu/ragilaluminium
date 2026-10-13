<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Normalisasi kategori katalog ke kode/slug Bahasa Indonesia (JENDELA/PINTU/BOVEN).
 *
 * - Kelompok global where(...)->orWhere(...) dengan closure agar prioritas AND/OR benar.
 * - Preflight konflik unique code/slug: baris LEBIH KUAT menang; jangan menimpa nilai
 *   Indonesia bila sudah dipakai baris lain (menghindari unique violation).
 * - Snapshot state asli (code/slug/name/seo_title/seo_description) ke tabel shadow agar
 *   down() dapat memulihkan penuh termasuk name + metadata lain, bukan hanya code/slug.
 */
return new class extends Migration
{
    /** @var list<array{0: string, 1: list<string>, 2: string, 3: string, 4: string, 5: string}> */
    private const MAP = [
        ['WINDOW', ['windows'], 'JENDELA', 'jendela', 'Jendela', 'Jendela Aluminium'],
        ['DOOR', ['doors'], 'PINTU', 'pintu', 'Pintu', 'Pintu Aluminium'],
        ['BOUVEN', ['bouven'], 'BOVEN', 'boven', 'Boven', 'Boven Aluminium'],
    ];

    private const SNAPSHOT_TABLE = 'category_normalize_snapshot';

    public function up(): void
    {
        if (! Schema::hasTable('categories')) {
            return;
        }

        if (! Schema::hasTable(self::SNAPSHOT_TABLE)) {
            Schema::create(self::SNAPSHOT_TABLE, function ($table) {
                $table->unsignedBigInteger('category_id')->primary();
                $table->string('code', 50)->nullable();
                $table->string('slug', 100)->nullable();
                $table->string('name', 100)->nullable();
                $table->string('seo_title', 191)->nullable();
                $table->string('seo_description', 500)->nullable();
            });
        }

        foreach (self::MAP as [$legacyCode, $legacySlugs, $newCode, $newSlug, $newName, $defaultSeo]) {
            $rows = DB::table('categories')
                ->where(function ($q) use ($legacyCode, $legacySlugs) {
                    $q->where('code', $legacyCode);
                    foreach ($legacySlugs as $slug) {
                        $q->orWhere('slug', $slug);
                    }
                })
                ->get();

            foreach ($rows as $row) {
                $conflictCode = DB::table('categories')
                    ->where('code', $newCode)->where('id', '!=', $row->id)->exists();
                $conflictSlug = DB::table('categories')
                    ->where('slug', $newSlug)->where('id', '!=', $row->id)->exists();

                if ($conflictCode || $conflictSlug) {
                    continue;
                }

                DB::table(self::SNAPSHOT_TABLE)->updateOrInsert(
                    ['category_id' => $row->id],
                    [
                        'code' => $row->code,
                        'slug' => $row->slug,
                        'name' => $row->name,
                        'seo_title' => $row->seo_title,
                        'seo_description' => $row->seo_description,
                    ]
                );

                DB::table('categories')->where('id', $row->id)->update([
                    'code' => $newCode,
                    'slug' => $newSlug,
                    'name' => $newName,
                    'seo_title' => $row->seo_title ?: $defaultSeo,
                ]);
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('categories') || ! Schema::hasTable(self::SNAPSHOT_TABLE)) {
            return;
        }

        $snapshots = DB::table(self::SNAPSHOT_TABLE)->get();

        foreach ($snapshots as $snapshot) {
            DB::table('categories')->where('id', $snapshot->category_id)->update([
                'code' => $snapshot->code,
                'slug' => $snapshot->slug,
                'name' => $snapshot->name,
                'seo_title' => $snapshot->seo_title,
                'seo_description' => $snapshot->seo_description,
            ]);
            DB::table(self::SNAPSHOT_TABLE)->where('category_id', $snapshot->category_id)->delete();
        }

        Schema::dropIfExists(self::SNAPSHOT_TABLE);
    }
};
