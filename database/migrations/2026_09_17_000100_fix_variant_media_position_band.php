<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Perbaikan data (bug 2026-09-17): media varian duduk di band posisi katalog
 * sehingga position-nya SERI dengan foto katalog. Akibatnya urutan acak,
 * foto varian bisa jadi cover storefront, dan 2 baris varian tertandai
 * is_main_image.
 *
 * Tindakan:
 * 1. Semua media varian (product_variant_id NOT NULL) dipindah ke band 50-79
 *    (50 + (slot-1)*10 mengikuti variation slot), tidak lagi di 1-49.
 * 2. is_main_image dicabut dari semua baris varian.
 * 3. Gambar utama ditegakkan ulang per produk: tepat satu, dari media katalog
 *    (bukan varian, bukan hasil pemasangan), deterministik position lalu id.
 */
return new class extends Migration
{
    public function up(): void
    {
        $variantRows = DB::table('product_media')->whereNotNull('product_variant_id')->get();

        foreach ($variantRows as $row) {
            DB::table('product_media')->where('id', $row->id)->update([
                'position' => $this->variantBand((object) $row),
                'is_main_image' => false,
            ]);
        }

        // Tegakkan ulang gambar utama per produk.
        $productIds = DB::table('product_media')
            ->select('product_id')->distinct()->pluck('product_id');

        foreach ($productIds as $productId) {
            $main = DB::table('product_media')
                ->where('product_id', $productId)
                ->whereNull('product_variant_id')
                ->where('is_installation', false)
                ->where('show_in_catalog', true)
                ->where('visibility', 'visible')
                ->orderBy('position')
                ->orderBy('id')
                ->first();

            // Produk yang seluruh medianya arsip/tidak tampil tidak punya
            // kandidat gambar utama. Jangan sentuh flag lamanya: produk seperti
            // itu sengaja nonaktif, dan flag yang diset admin harus tetap utuh
            // supaya tidak perlu diatur ulang saat produk diaktifkan kembali.
            if ($main === null) {
                continue;
            }

            DB::table('product_media')->where('product_id', $productId)
                ->update(['is_main_image' => false]);

            DB::table('product_media')->where('id', $main->id)
                ->update(['is_main_image' => true]);
        }
    }

    /** Band media varian: 50 + (slot-1)*10, fallback 50. */
    private function variantBand(object $row): int
    {
        $variant = DB::table('product_variants')->where('id', $row->product_variant_id)->first();
        if (! $variant) {
            return 50;
        }

        for ($slot = 1; $slot <= 5; $slot++) {
            $option = $variant->{'variation_'.$slot.'_option'} ?? null;
            if (filled($option)) {
                return 50 + ($slot - 1) * 10;
            }
        }

        return 50;
    }

    public function down(): void
    {
        // Tidak dikembalikan: data lama adalah kondisi rusak.
    }
};
