<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->json('keywords')->nullable()->after('description');
        });

        // Migrasi data lama: ambil label dari highlights (jika ada) sebagai kata kunci.
        $rows = DB::table('cms_model_products')->whereNotNull('highlights')->get(['id', 'highlights']);
        foreach ($rows as $row) {
            $items = json_decode((string) $row->highlights, true);
            $labels = [];
            if (is_array($items)) {
                foreach ($items as $item) {
                    $label = is_array($item) ? trim((string) ($item['label'] ?? '')) : trim((string) $item);
                    if ($label !== '') {
                        $labels[] = $label;
                    }
                }
            }
            DB::table('cms_model_products')->where('id', $row->id)->update([
                'keywords' => $labels !== [] ? json_encode($labels) : null,
            ]);
        }

        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->dropColumn('highlights');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->json('highlights')->nullable()->after('description');
        });

        $rows = DB::table('cms_model_products')->whereNotNull('keywords')->get(['id', 'keywords']);
        foreach ($rows as $row) {
            $items = json_decode((string) $row->keywords, true);
            $highlights = [];
            if (is_array($items)) {
                foreach (array_slice($items, 0, 6) as $i => $label) {
                    $label = trim((string) $label);
                    if ($label !== '') {
                        $highlights[] = ['icon' => ['sparkle', 'sun', 'shield-check'][$i % 3], 'label' => $label];
                    }
                }
            }
            DB::table('cms_model_products')->where('id', $row->id)->update([
                'highlights' => $highlights !== [] ? json_encode($highlights) : null,
            ]);
        }

        Schema::table('cms_model_products', function (Blueprint $table) {
            $table->dropColumn('keywords');
        });
    }
};
