<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Migrasi data: kode kategori produk WINDOW/DOOR/BOUVEN -> JENDELA/PINTU/BOVEN.
 *
 * Fase 2 task migrasi kategori Indonesia. Kanonik baru sudah aktif di kode
 * (Fase 1); migration ini menyelaraskan nilai `products.product_category`.
 *
 * GUARD: sebelum & sesudah update, list seluruh nilai DISTINCT; bila ada nilai
 * di luar set yang diketahui, TIDAK di-auto-fix, hanya dicatat (rollback manual).
 *
 * Catatan rollback: reverse map aman hanya bila tidak ada produk baru WINDOW/
 * DOOR/BOUVEN yang dibuat setelah migration. Untuk produksi, backup dulu
 * (`mysqldump products`) sebelum `php artisan migrate`.
 */
return new class extends Migration
{
    private const MAP = [
        'WINDOW' => 'JENDELA',
        'DOOR' => 'PINTU',
        'BOUVEN' => 'BOVEN',
    ];

    public function up(): void
    {
        $before = DB::table('products')->distinct()->pluck('product_category')->all();
        DB::table('products')
            ->whereIn('product_category', array_keys(self::MAP))
            ->orderBy('id')
            ->get()
            ->each(function ($p) {
                DB::table('products')->where('id', $p->id)
                    ->update(['product_category' => self::MAP[$p->product_category]]);
            });
        $after = DB::table('products')->distinct()->pluck('product_category')->all();

        // Guard: laporkan bila ada nilai di luar kanonik+alias yang diketahui.
        $known = ['JENDELA', 'PINTU', 'BOVEN'];
        $unknown = array_values(array_filter($after, fn ($c) => ! in_array($c, $known, true)));
        if ($unknown !== []) {
            // sengaja dilempar; admin diminta review sebelum lanjut
            throw new \RuntimeException(
                'Migrasi kategori menemukan nilai tak dikenal: '.implode(', ', $unknown)
            );
        }
    }

    public function down(): void
    {
        // Reverse map (batasan: hanya bila belum ada data kanonik baru buatan
        // post-migration; review owner sebelum dipakai).
        DB::table('products')->whereIn('product_category', ['JENDELA', 'PINTU', 'BOVEN'])
            ->orderBy('id')->get()->each(function ($p) {
                DB::table('products')->where('id', $p->id)->update([
                    'product_category' => [
                        'JENDELA' => 'WINDOW',
                        'PINTU' => 'DOOR',
                        'BOVEN' => 'BOUVEN',
                    ][$p->product_category],
                ]);
            });
    }
};
