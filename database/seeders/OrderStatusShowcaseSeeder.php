<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Pesanan uji untuk mengaudit SELURUH keadaan halaman Cek Status Pesanan.
 *
 * Seeder sebelumnya (`OrderReviewSimulationSeeder`) hanya menyiapkan pesanan
 * berstatus "delivered" karena tujuannya menguji alur ulasan. Akibatnya
 * halaman status hanya pernah dilihat dalam satu keadaan, dan kekeliruan
 * tampilan pada keadaan lain tidak pernah terlihat. Seeder ini menutup celah
 * itu: satu pesanan untuk setiap keadaan yang bisa dihasilkan view model.
 *
 * ## Daftar pesanan
 *
 * | Nomor | Status pesanan | Bayar | Pengiriman | Keadaan yang diuji |
 * |---|---|---|---|---|
 * | RA-UI-2209-01 | awaiting_confirmation | transfer, belum bayar | tanpa resi | Menunggu pembayaran |
 * | RA-UI-2209-02 | awaiting_confirmation | COD | tanpa resi | Pesanan dikonfirmasi (COD) |
 * | RA-UI-2209-03 | processing | transfer, lunas | tanpa resi | Menyiapkan (transfer) |
 * | RA-UI-2209-04 | processing | COD | tanpa resi | Menyiapkan (COD) |
 * | RA-UI-2209-05 | shipped | transfer, lunas | in_transit + resi | Paket dalam perjalanan |
 * | RA-UI-2209-06 | shipped | COD | out_for_delivery + resi | Paket sedang diantar |
 * | RA-UI-2209-07 | shipped | transfer, lunas | picked_up + resi | Menunggu penjemputan kurir |
 * | RA-UI-2209-08 | delivered | COD, lunas | delivered + resi | Sampai (COD, kasus badge keliru) |
 * | RA-UI-2209-09 | delivered | transfer, lunas | delivered + resi | Sampai (transfer) |
 * | RA-UI-2209-10 | completed | transfer, lunas | delivered + resi | Pesanan selesai |
 * | RA-UI-2209-11 | return_in_process | COD, lunas | returned + resi + kasus retur | Retur diproses |
 * | RA-UI-2209-12 | return_completed | COD, belum lunas | returned + resi + kasus retur | Retur selesai |
 * | RA-UI-2209-13 | cancelled | transfer, belum bayar | dibatalkan | Pesanan dibatalkan |
 * | RA-UI-2209-14 | issue | transfer, lunas | exception + resi | Perlu perhatian |
 * | RA-UI-2209-15 | delivered | transfer, lunas | exception + resi | Pengiriman belum berhasil |
 * | RA-UI-2209-16 | delivered | COD, lunas | delivered + resi | 3 item sekaligus |
 * | RA-UI-2209-17 | delivered | refunded | delivered + resi | Refund diproses |
 * | RA-UI-2209-18 | delivered | COD, lunas | TANPA resi | Sampai tanpa catatan pengiriman (COD) |
 * | RA-UI-2209-19 | delivered | transfer, lunas | TANPA resi | Sampai tanpa catatan pengiriman (transfer) |
 *
 * Nomor HP untuk membuka: `62857000011NN`, dengan NN = dua angka terakhir nomor
 * pesanan. Contoh RA-UI-2209-08 memakai 6285700001108.
 *
 * Dua keadaan terakhir (18 dan 19) ada karena pesanan yang ditandai Sampai
 * tanpa catatan resi pernah menampilkan badge "Menunggu pembayaran" padahal
 * pembayarannya sudah lunas. Tanpa keduanya, kekeliruan itu tidak terlihat
 * saat mengaudit tampilan.
 *
 * ## Keamanan data
 *
 * Hanya nomor berawalan `RA-UI-2209-` yang disentuh. Seeder ini tidak memanggil
 * `order_number_sequences`, jadi penomoran pesanan asli tidak terpengaruh, dan
 * tidak ada pesanan asli yang memakai awalan itu.
 *
 * Idempoten: setiap kali dijalankan, pesanan uji beserta seluruh anakannya
 * (item, pengiriman, riwayat pelacakan, kasus retur) ditulis ulang.
 *
 * ## Membersihkan setelah selesai
 *
 *   DELETE FROM shipping_tracking_events WHERE order_id IN
 *     (SELECT id FROM orders WHERE order_number LIKE 'RA-UI-2209-%');
 *   DELETE FROM shipping_records WHERE order_id IN
 *     (SELECT id FROM orders WHERE order_number LIKE 'RA-UI-2209-%');
 *   DELETE FROM order_return_items WHERE return_case_id IN
 *     (SELECT id FROM order_return_cases WHERE order_id IN
 *       (SELECT id FROM orders WHERE order_number LIKE 'RA-UI-2209-%'));
 *   DELETE FROM order_return_cases WHERE order_id IN
 *     (SELECT id FROM orders WHERE order_number LIKE 'RA-UI-2209-%');
 *   DELETE FROM order_items WHERE order_id IN
 *     (SELECT id FROM orders WHERE order_number LIKE 'RA-UI-2209-%');
 *   DELETE FROM orders WHERE order_number LIKE 'RA-UI-2209-%';
 *
 * `dev:cleanup-dummy` belum mengenal awalan RA-UI, jadi pesanan ini HARUS
 * dihapus manual sebelum deploy ke produksi.
 *
 * Seeder ini tidak dipanggil DatabaseSeeder.
 */
class OrderStatusShowcaseSeeder extends Seeder
{
    private const PREFIX = 'RA-UI-2209-';

    /** Produk dan varian dibaca dari katalog saat seeder dijalankan. */
    private const KATALOG = [
        ['product_id' => 98, 'variant_id' => 677],
        ['product_id' => 51, 'variant_id' => 104],
    ];

    public function run(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('orders') || ! DB::getSchemaBuilder()->hasTable('order_items')) {
            return;
        }

        $items = $this->katalogItems();

        foreach ($this->specs() as $spec) {
            $this->writeOrder($spec, $items);
        }

        $jumlah = count($this->specs());
        $this->command?->info('Pesanan uji keadaan status siap: '.$jumlah.' pesanan.');
        $this->command?->line('Awalan nomor: '.self::PREFIX.'01 sampai '.self::PREFIX.str_pad((string) $jumlah, 2, '0', STR_PAD_LEFT));
        $this->command?->line('Nomor HP: 6285700001101 sampai 62857000011'.str_pad((string) $jumlah, 2, '0', STR_PAD_LEFT).' (dua angka terakhir mengikuti nomor pesanan).');
    }

    /**
     * Rancangan seluruh keadaan.
     *
     * @return list<array<string,mixed>>
     */
    private function specs(): array
    {
        $kota = [
            ['KABUPATEN BANJARNEGARA', 'JAWA TENGAH', '53473', 'Jln. Raya Mandiraja Wetan'],
            ['KOTA SURABAYA', 'JAWA TIMUR', '60271', 'Jln. Raya Darmo Nomor 1'],
            ['KOTA BANDUNG', 'JAWA BARAT', '40115', 'Jln. Asia Afrika Nomor 12'],
        ];

        $specs = [];
        $rows = [
            // nn, status, payment_status, method, shipping, waybill, items, case, refunded
            ['01', 'awaiting_confirmation', 'pending', 'transfer', null, null, 1],
            ['02', 'awaiting_confirmation', 'pending', 'cod', null, null, 1],
            ['03', 'processing', 'paid', 'transfer', null, null, 1],
            ['04', 'processing', 'pending', 'cod', null, null, 2],
            ['05', 'shipped', 'paid', 'transfer', 'in_transit', true, 1],
            ['06', 'shipped', 'pending', 'cod', 'out_for_delivery', true, 2],
            ['07', 'shipped', 'paid', 'transfer', 'picked_up', true, 1],
            ['08', 'delivered', 'paid', 'cod', 'delivered', true, 1],
            ['09', 'delivered', 'paid', 'transfer', 'delivered', true, 1],
            ['10', 'completed', 'paid', 'transfer', 'delivered', true, 2],
            ['11', 'return_in_process', 'paid', 'cod', 'returned', true, 1, 'open'],
            ['12', 'return_completed', 'pending', 'cod', 'returned', true, 1, 'completed'],
            ['13', 'cancelled', 'pending', 'transfer', null, null, 1],
            ['14', 'issue', 'paid', 'transfer', 'exception', true, 1],
            ['15', 'delivered', 'paid', 'transfer', 'exception', true, 2],
            ['16', 'delivered', 'paid', 'cod', 'delivered', true, 3],
            ['17', 'delivered', 'refunded', 'transfer', 'delivered', true, 1],
            // Dua keadaan terakhir sengaja TANPA catatan resi. Pesanan yang
            // ditandai Sampai tanpa resi membuat view model jatuh ke cabang
            // "belum dikirim", dan di situlah badge pernah menampilkan
            // "Menunggu pembayaran" untuk pesanan yang sudah lunas.
            ['18', 'delivered', 'paid', 'cod', null, false, 1],
            ['19', 'delivered', 'paid', 'transfer', null, false, 1],
        ];

        foreach ($rows as $i => $row) {
            [$nn, $status, $payment, $method, $shipping, $waybill, $count] = $row;
            $case = $row[7] ?? null;
            [$city, $province, $postal, $street] = $kota[$i % count($kota)];

            $specs[] = [
                'order_number' => self::PREFIX.$nn,
                'customer_name' => $this->namaPelanggan((int) $nn),
                'customer_phone' => '62857000011'.$nn,
                'shipping_address_line1' => $street,
                'shipping_city' => $city,
                'shipping_province' => $province,
                'shipping_postal_code' => $postal,
                'shipping_amount' => 350000 + ($i * 25000),
                'order_status' => $status,
                'payment_status' => $payment,
                'payment_method' => $method,
                'cod_flag' => $method === 'cod' ? 1 : 0,
                'shipping_status' => $shipping,
                'waybill' => $waybill ? 'JNT-UI-'.$nn.'-2609' : null,
                'item_count' => $count,
                'return_case' => $case,
                // Umur pesanan dibuat berbeda-beda supaya tanggal di kartu
                // tidak semua sama dan baris tanggalnya ikut teruji.
                'days_ago' => $i % 5,
            ];
        }

        return $specs;
    }

    private function namaPelanggan(int $nn): string
    {
        $nama = [
            '1' => 'Ayu Lestari', '2' => 'Bagas Prakoso', '3' => 'Citra Halim',
            '4' => 'Dimas Nugroho', '5' => 'Eka Saputra', '6' => 'Fitri Handayani',
            '7' => 'Galih Pratama', '8' => 'Hana Maulida', '9' => 'Irfan Setiawan',
            '10' => 'Joko Susilo', '11' => 'Kartika Sari', '12' => 'Lukman Hakim',
            '13' => 'Maya Anggraini', '14' => 'Nanda Kusuma', '15' => 'Oktavia Putri',
            '16' => 'Pandu Wicaksono', '17' => 'Rina Marlina',
            '18' => 'Sari Dewi', '19' => 'Budi Santoso',
        ];

        return $nama[(string) $nn] ?? 'Pelanggan Uji '.$nn;
    }

    /**
     * Ambil daftar item katalog sekali saja, supaya tidak ada kueri berulang.
     *
     * @return list<array<string,mixed>>
     */
    private function katalogItems(): array
    {
        $out = [];

        foreach (self::KATALOG as $row) {
            $product = DB::table('products')->where('id', $row['product_id'])->first();
            $variant = DB::table('product_variants')->where('id', $row['variant_id'])->first();

            if (! $product || ! $variant) {
                throw new RuntimeException(
                    'Produk atau varian untuk pesanan uji tidak ditemukan (product_id '
                    .$row['product_id'].', variant_id '.$row['variant_id'].'). Jalankan import katalog dulu.'
                );
            }

            $out[] = [
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
                'unit_price' => (float) $variant->price,
            ];
        }

        return $out;
    }

    /**
     * Tulis satu pesanan beserta seluruh anakannya.
     *
     * Memakai query builder, bukan Eloquent, supaya tidak ada observer, cast,
     * atau event yang terpicu saat data uji ditulis.
     *
     * @param  array<string,mixed>  $spec
     * @param  list<array<string,mixed>>  $katalog
     */
    private function writeOrder(array $spec, array $katalog): void
    {
        DB::transaction(function () use ($spec, $katalog): void {
            $number = (string) $spec['order_number'];
            $old = DB::table('orders')->where('order_number', $number)->value('id');

            if ($old) {
                $this->purge((int) $old);
            }

            $lines = [];
            for ($i = 0; $i < (int) $spec['item_count']; $i++) {
                $base = $katalog[$i % count($katalog)];
                $base['quantity'] = 1;
                $base['line_subtotal'] = $base['unit_price'];
                $base['line_discount'] = 0;
                $base['line_total'] = $base['unit_price'];
                $lines[] = $base;
            }

            $subtotal = array_sum(array_column($lines, 'line_total'));
            $shipping = (float) $spec['shipping_amount'];
            $created = now()->subDays((int) $spec['days_ago'])->setTime(9, 15 + ((int) substr($number, -2) % 40));

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
                'order_status' => $spec['order_status'],
                'payment_status' => $spec['payment_status'],
                'shipping_status' => $spec['shipping_status'] ?? 'pending_pickup',
                'subtotal_amount' => $subtotal,
                'shipping_amount' => $shipping,
                'shipping_subsidy_amount' => 0,
                'shipping_insurance_amount' => 0,
                'discount_amount' => 0,
                'voucher_discount_amount' => 0,
                'cod_fee_amount' => 0,
                'total_amount' => $subtotal + $shipping,
                'payment_method' => $spec['payment_method'],
                'cod_flag' => (int) $spec['cod_flag'],
                'created_at' => $created,
                'updated_at' => $created,
            ]);

            foreach ($lines as $line) {
                DB::table('order_items')->insert($line + [
                    'order_id' => $orderId,
                    'created_at' => $created,
                    'updated_at' => $created,
                ]);
            }

            $shippingId = null;
            if (! empty($spec['waybill'])) {
                $shippingId = $this->writeShipping($orderId, $spec, $created);
            }

            if ($spec['return_case'] !== null) {
                $this->writeReturnCase($orderId, $spec, $created);
            }

            unset($shippingId);
        });
    }

    /** Hapus pesanan uji beserta seluruh anakannya. */
    private function purge(int $orderId): void
    {
        $caseIds = DB::table('order_return_cases')->where('order_id', $orderId)->pluck('id')->all();
        if ($caseIds !== []) {
            DB::table('order_return_items')->whereIn('return_case_id', $caseIds)->delete();
            DB::table('order_return_cases')->whereIn('id', $caseIds)->delete();
        }

        if (DB::getSchemaBuilder()->hasTable('shipping_tracking_events')) {
            DB::table('shipping_tracking_events')->where('order_id', $orderId)->delete();
        }
        DB::table('shipping_records')->where('order_id', $orderId)->delete();
        DB::table('order_items')->where('order_id', $orderId)->delete();
        DB::table('orders')->where('id', $orderId)->delete();
    }

    /**
     * Catatan pengiriman beserta riwayat pelacakannya, supaya kartu J&T dan
     * timeline "Lacak Pesanan" ikut terisi.
     */
    private function writeShipping(int $orderId, array $spec, $created): int
    {
        $status = (string) $spec['shipping_status'];
        $lastAt = $created->copy()->addDays(2);

        $shippingId = DB::table('shipping_records')->insertGetId([
            'order_id' => $orderId,
            'carrier_name' => 'J&T Cargo',
            'service_name' => 'EZ',
            'waybill_number' => $spec['waybill'],
            'shipping_cost' => (float) $spec['shipping_amount'],
            'shipping_freight' => (float) $spec['shipping_amount'],
            'shipping_insured_fee' => 0,
            'shipping_chargeable_weight_kg' => 12.5,
            'status' => $status,
            'status_raw' => strtoupper($status),
            'last_status_at' => $lastAt,
            'tracking_url' => 'https://www.jet.co.id/track/trace?waybill='.$spec['waybill'],
            'created_at' => $created,
            'updated_at' => $lastAt,
        ]);

        if (! DB::getSchemaBuilder()->hasTable('shipping_tracking_events')) {
            return $shippingId;
        }

        // Rantai perjalanan yang masuk akal untuk setiap keadaan akhir.
        $rantai = [
            'picked_up' => ['picked_up'],
            'in_transit' => ['picked_up', 'in_transit'],
            'out_for_delivery' => ['picked_up', 'in_transit', 'arrived_destination_hub', 'out_for_delivery'],
            'delivered' => ['picked_up', 'in_transit', 'arrived_destination_hub', 'out_for_delivery', 'delivered'],
            'returned' => ['picked_up', 'in_transit', 'out_for_delivery', 'delivery_failed', 'returned_to_sender'],
            'exception' => ['picked_up', 'in_transit', 'delivery_exception'],
        ][$status] ?? [];

        $lokasi = ['BANJARNEGARA', 'SEMARANG', 'SURABAYA', 'KOTA TUJUAN'];
        $aturan = [
            'picked_up' => ['Paket telah dijemput kurir', 'Kurir menerima paket di gudang toko.'],
            'in_transit' => ['Paket dalam perjalanan', 'Paket menuju hub berikutnya.'],
            'arrived_destination_hub' => ['Paket tiba di hub tujuan', 'Paket tiba di hub wilayah tujuan.'],
            'out_for_delivery' => ['Paket sedang diantar', 'Kurir sedang mengantar paket ke alamat penerima.'],
            'delivered' => ['Paket telah diterima', 'Paket diterima oleh penerima.'],
            'delivery_failed' => ['Pengantaran belum berhasil', 'Kurir belum berhasil menemui penerima.'],
            'delivery_exception' => ['Kendala pengiriman', 'Terjadi kendala saat pengiriman paket.'],
            'returned_to_sender' => ['Paket dikembalikan ke toko', 'Paket dikembalikan ke pengirim.'],
        ];

        foreach ($rantai as $i => $kode) {
            $at = $created->copy()->addDays(2)->addHours($i * 7);
            [$desc, $ket] = $aturan[$kode];
            DB::table('shipping_tracking_events')->insert([
                'shipping_record_id' => $shippingId,
                'order_id' => $orderId,
                'provider' => 'jnt',
                'waybill_number' => $spec['waybill'],
                'provider_status' => strtoupper($kode),
                'normalized_status' => $kode,
                'source' => 'webhook',
                'location' => $lokasi[$i % count($lokasi)],
                'description' => $desc.' '.$ket,
                'occurred_at' => $at,
                'event_hash' => hash('sha256', $spec['waybill'].'|'.$kode.'|'.$i),
                'created_at' => $at,
                'updated_at' => $at,
            ]);
        }

        return $shippingId;
    }

    /** Kasus retur untuk pesanan 11 dan 12. */
    private function writeReturnCase(int $orderId, array $spec, $created): void
    {
        $open = $spec['return_case'] === 'open';
        $items = DB::table('order_items')->where('order_id', $orderId)->get();

        $caseId = DB::table('order_return_cases')->insertGetId([
            'order_id' => $orderId,
            'status' => $open ? 'open' : 'completed',
            'reason' => 'pecah',
            'reason_detail' => 'Kaca pecah saat paket diterima.',
            'fault_party' => 'store',
            'shipping_cost_borne_by_store' => 1,
            'resolution_type' => $open ? null : 'refund',
            'customer_notes' => 'Paket diterima dengan kaca pecah pada salah satu daun.',
            'admin_notes' => $open ? null : 'Refund disetujui admin setelah diskusi WhatsApp.',
            'refund_amount' => $open ? 0 : (float) DB::table('orders')->where('id', $orderId)->value('subtotal_amount'),
            'replacement_amount' => 0,
            'additional_shipping_amount' => 0,
            'return_shipping_cost' => $open ? 0 : 150000,
            'completed_at' => $open ? null : $created->copy()->addDays(4),
            'created_by_user_id' => null,
            'updated_by_user_id' => null,
            'created_at' => $created->copy()->addDays(3),
            'updated_at' => $created->copy()->addDays($open ? 3 : 4),
        ]);

        foreach ($items as $item) {
            DB::table('order_return_items')->insert([
                'return_case_id' => $caseId,
                'order_item_id' => $item->id,
                'requested_quantity' => 1,
                'returned_quantity' => $open ? 0 : 1,
                'created_at' => $created->copy()->addDays(3),
                'updated_at' => $created->copy()->addDays(3),
            ]);
        }
    }
}
