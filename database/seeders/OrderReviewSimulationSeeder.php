<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Dua pesanan simulasi untuk menguji alur ulasan dari SISI PELANGGAN.
 *
 * Alur ulasan pelanggan belum pernah diuji dari awal sampai tersimpan. Seeder
 * ini menyiapkan pesanan berstatus "delivered" yang bisa dibuka sendiri oleh
 * pelanggan lewat halaman Cek Status Pesanan, sehingga form ulasannya benar
 * benar bisa diisi: pilih bintang, ketik teks atau ketuk chip saran, unggah
 * foto/video, lalu kirim.
 *
 * ## Nomor dan identitas untuk dicoba
 *
 * | Order | Isi | Nomor HP untuk akses |
 * |---|---|---|
 * | RA-SIM-2609-01 | 1 produk: SP57802368148 (140x50) | 6285700000001 |
 * | RA-SIM-2609-02 | 2 produk: SP57802368148 + SP58155312043 | 6285700000002 |
 *
 * Dua pesanan sengaja dibuat berbeda isinya:
 * - pesanan SATU produk: pilihan produk seharusnya sudah terpilih otomatis;
 * - pesanan DUA produk: pelanggan wajib memilih produk dulu, dan mengirim
 *   tanpa memilih seharusnya ditolak dengan pesan yang jelas.
 *
 * Cara membuka: halaman /order/status, isi nomor order dan nomor HP di atas.
 * Setelah nomor HP cocok, sesi browser itu diingat sehingga pesanan bisa
 * dibuka lagi tanpa mengisi nomor HP.
 *
 * ## Keamanan data
 *
 * Hanya dua nomor berawalan `RA-SIM-2609-` yang disentuh. Baris lain di tabel
 * orders dan order_items tidak pernah diubah. Tidak ada order asli yang
 * memakai awalan ini (order asli memakai awalan RA-2608/ORD26).
 *
 * Seeder ini TIDAK memanggil order_number_sequences, jadi penomoran order asli
 * tidak terpengaruh.
 *
 * Idempoten: bila nomor sudah ada, pesanan dan itemnya ditulis ulang sehingga
 * hasilnya sama setiap kali dijalankan.
 *
 * ## Membersihkan setelah selesai
 *
 *   DELETE FROM order_items WHERE order_id IN
 *     (SELECT id FROM orders WHERE order_number LIKE 'RA-SIM-2609-%');
 *   DELETE FROM orders WHERE order_number LIKE 'RA-SIM-2609-%';
 *
 * PENTING: command `dev:cleanup-dummy` belum mengenal nomor RA-SIM, jadi
 * pesanan ini HARUS dihapus manual sebelum deploy ke produksi. Pesanan ini
 * juga sengaja tidak dikaitkan ke ulasan apa pun, supaya kalau tertinggal ia
 * tidak menyeret data ulasan.
 *
 * Seeder ini tidak dipanggil DatabaseSeeder.
 */
class OrderReviewSimulationSeeder extends Seeder
{
    private const PREFIX = 'RA-SIM-2609-';

    public function run(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('orders') || ! DB::getSchemaBuilder()->hasTable('order_items')) {
            return;
        }

        $specs = $this->orderSpecs();

        foreach ($specs as $spec) {
            $this->writeOrder($spec);
        }

        $this->command?->info('Pesanan simulasi ulasan siap.');
        $this->command?->line('Nomor order: '.implode(', ', array_column($specs, 'order_number')));
        $this->command?->line('Nomor HP: '.implode(', ', array_column($specs, 'customer_phone')));
        $this->command?->line('Buka halaman /order/status untuk mencoba dari sisi pelanggan.');
    }

    /**
     * Rancangan dua pesanan. Harga diambil dari varian saat seeder dijalankan,
     * jadi tidak ada harga yang ditulis manual di sini.
     *
     * @return list<array<string,mixed>>
     */
    private function orderSpecs(): array
    {
        return [
            [
                'order_number' => self::PREFIX.'01',
                'customer_name' => 'Sari Dewi',
                'customer_phone' => '6285700000001',
                'shipping_address_line1' => 'Jln. Raya Mandiraja Wetan, Samping Barat Pom Bensin',
                'shipping_city' => 'KABUPATEN BANJARNEGARA',
                'shipping_province' => 'JAWA TENGAH',
                'shipping_postal_code' => '53473',
                'shipping_amount' => 350000,
                'items' => [
                    ['product_id' => 98, 'variant_id' => 677, 'quantity' => 1],
                ],
            ],
            [
                'order_number' => self::PREFIX.'02',
                'customer_name' => 'Budi Santoso',
                'customer_phone' => '6285700000002',
                'shipping_address_line1' => 'Jln. Raya Darmo Nomor 1, Blok C',
                'shipping_city' => 'KOTA SURABAYA',
                'shipping_province' => 'JAWA TIMUR',
                'shipping_postal_code' => '60271',
                'shipping_amount' => 450000,
                'items' => [
                    ['product_id' => 98, 'variant_id' => 677, 'quantity' => 1],
                    ['product_id' => 51, 'variant_id' => 104, 'quantity' => 1],
                ],
            ],
        ];
    }

    /**
     * Tulis satu pesanan beserta itemnya. Memakai query builder, bukan Eloquent,
     * supaya tidak ada observer, casting, atau event yang ikut terpicu saat data
     * uji ditulis, dan supaya created_at bisa dipastikan.
     *
     * @param  array<string,mixed>  $spec
     */
    private function writeOrder(array $spec): void
    {
        DB::transaction(function () use ($spec): void {
            $number = (string) $spec['order_number'];
            $existingId = DB::table('orders')->where('order_number', $number)->value('id');

            if ($existingId) {
                DB::table('order_items')->where('order_id', $existingId)->delete();
                DB::table('orders')->where('id', $existingId)->delete();
            }

            $items = $this->buildItems($spec['items']);
            $subtotal = array_sum(array_column($items, 'line_subtotal'));
            $shipping = (float) $spec['shipping_amount'];
            $now = now();

            $orderId = DB::table('orders')->insertGetId([
                'order_number' => $number,
                'customer_id' => null,
                'customer_name' => $spec['customer_name'],
                'customer_phone' => $spec['customer_phone'],
                'customer_email' => null,
                'shipping_address_line1' => $spec['shipping_address_line1'],
                'shipping_address_line2' => null,
                'shipping_city' => $spec['shipping_city'],
                'shipping_province' => $spec['shipping_province'],
                'shipping_postal_code' => $spec['shipping_postal_code'],
                'shipping_country' => 'Indonesia',
                // Pesanan sudah diterima: inilah syarat agar form ulasan muncul
                // (CustomerReviewForm hanya dirender untuk delivered/completed).
                'order_status' => 'delivered',
                'payment_status' => 'paid',
                'shipping_status' => 'delivered',
                'subtotal_amount' => $subtotal,
                'shipping_amount' => $shipping,
                'shipping_subsidy_amount' => 0,
                'shipping_insurance_amount' => 0,
                'discount_amount' => 0,
                'voucher_discount_amount' => 0,
                'cod_fee_amount' => 0,
                'total_amount' => $subtotal + $shipping,
                'payment_method' => 'cod',
                'cod_flag' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach ($items as $item) {
                DB::table('order_items')->insert($item + [
                    'order_id' => $orderId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });
    }

    /**
     * Susun baris item dari data produk dan varian yang ada sekarang.
     *
     * Harga sengaja dibaca dari varian, bukan ditulis tetap, supaya pesanan uji
     * tidak menampilkan harga yang tidak masuk akal bila katalog berubah.
     *
     * @param  list<array<string,mixed>>  $rows
     * @return list<array<string,mixed>>
     */
    private function buildItems(array $rows): array
    {
        $items = [];

        foreach ($rows as $row) {
            $product = DB::table('products')->where('id', (int) $row['product_id'])->first();
            $variant = DB::table('product_variants')->where('id', (int) $row['variant_id'])->first();

            if (! $product || ! $variant) {
                throw new RuntimeException(sprintf(
                    'Produk atau varian untuk pesanan simulasi tidak ditemukan: %s. Jalankan import katalog dulu.',
                    json_encode($row),
                ));
            }

            $quantity = (int) ($row['quantity'] ?? 1);
            $unitPrice = (float) $variant->price;
            $lineTotal = $unitPrice * $quantity;

            $items[] = [
                'product_id' => (int) $product->id,
                'product_variant_id' => (int) $variant->id,
                'parent_sku' => (string) $product->parent_sku,
                'variant_sku' => (string) $variant->variant_sku,
                'name' => (string) $product->name,
                'product_category' => $product->product_category,
                'product_model' => $product->product_model,
                'design_variant' => $product->design_variant,
                'variation_1_name' => $variant->variation_1_name,
                'variation_1_option' => $variant->variation_1_option,
                'variation_2_name' => $variant->variation_2_name,
                'variation_2_option' => $variant->variation_2_option,
                'unit_price' => $unitPrice,
                'quantity' => $quantity,
                'line_subtotal' => $lineTotal,
                'line_discount' => 0,
                'line_total' => $lineTotal,
            ];
        }

        return $items;
    }
}
