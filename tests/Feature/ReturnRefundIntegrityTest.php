<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pengunci cacat yang ditemukan audit retur, refund, dan keuangan
 * (2026-09-26). Setiap test di sini menutup satu jalur yang sebelumnya bisa
 * diam-diam membuang angka atau gagal tanpa pesan.
 */
class ReturnRefundIntegrityTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Concerns\TanamEventPengakuan;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function produk(string $sku = 'RR-1', int $stok = 20): array
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => 'Jendela '.$sku,
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-V1',
            'price' => 500000,
            'stock' => $stok,
            'status' => 'active',
        ]);

        return [$product, $variant];
    }

    private function order(array $overrides = []): Order
    {
        $order = Order::create(array_merge([
            'order_number' => 'RA-RR-'.uniqid(),
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Kudus',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '59311',
            'shipping_country' => 'Indonesia',
            'order_status' => 'delivered',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 500000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ], $overrides));

        return $order;
    }

    private function kasus(Order $order, array $overrides = []): OrderReturnCase
    {
        return OrderReturnCase::create(array_merge([
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'rusak',
            'fault_party' => 'store',
            'shipping_cost_borne_by_store' => true,
            'customer_notes' => 'Barang penyok saat diterima.',
        ], $overrides));
    }

    // ---------------------------------------------------------------- stok

    public function test_potong_stok_pengganti_masuk_buku_besar_stok(): void
    {
        $admin = $this->admin();
        [$product, $variant] = $this->produk();
        $order = $this->order(['order_status' => 'return_in_process']);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => 'RR-1',
            'variant_sku' => 'RR-1-V1',
            'name' => 'Jendela RR-1',
            'unit_price' => 500000,
            'quantity' => 2,
            'line_subtotal' => 500000,
            'line_discount' => 0,
            'line_total' => 500000,
        ]);
        $orderItem = $order->items()->first();
        $kasus = $this->kasus($order);
        $kasus->items()->create([
            'order_item_id' => $orderItem->id,
            'requested_quantity' => 2,
            'returned_quantity' => 2,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', [$order, $kasus]), [
                'resolution_type' => 'replacement',
                'admin_notes' => 'Diganti unit baru.',
                'replacement_items' => [[
                    'order_item_id' => $orderItem->id,
                    'product_id' => $product->id,
                    'variant_id' => $variant->id,
                    'quantity' => 2,
                ]],
                'return_shipping_cost' => 20000,
                'returned_items' => [
                    ['id' => $kasus->items()->first()->id, 'returned_quantity' => 2],
                ],
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertSame(18, (int) $variant->fresh()->stock, 'stok pengganti berkurang 2');
        // Inilah penguncinya: mutasi stok penggantian wajib meninggalkan baris
        // buku besar stok, bukan hanya mengubah angka di kolom stok.
        $gerak = DB::table('stock_movements')
            ->where('product_variant_id', $variant->id)
            ->where('movement_type', 'return_replacement_out')
            ->get();
        $this->assertCount(1, $gerak, 'tepat satu baris buku besar per pemotongan');
        $this->assertSame(20, (int) $gerak->first()->stock_before);
        $this->assertSame(18, (int) $gerak->first()->stock_after);
        $this->assertSame(-2, (int) $gerak->first()->quantity);
        $this->assertSame('return_case', $gerak->first()->reference_type);
        $this->assertSame($kasus->id, (int) $gerak->first()->reference_id);
    }

    public function test_penggantian_tanpa_varian_ditolak_dengan_pesan_jelas(): void
    {
        $admin = $this->admin();
        [$product, $variant] = $this->produk('RR-2');
        $order = $this->order(['order_status' => 'return_in_process']);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => 'RR-2',
            'variant_sku' => 'RR-2-V1',
            'name' => 'Jendela RR-2',
            'unit_price' => 500000,
            'quantity' => 1,
            'line_subtotal' => 500000,
            'line_discount' => 0,
            'line_total' => 500000,
        ]);
        $orderItem = $order->items()->first();
        $kasus = $this->kasus($order);
        $kasus->items()->create([
            'order_item_id' => $orderItem->id,
            'requested_quantity' => 1,
            'returned_quantity' => 1,
        ]);

        // Tanpa varian: stok tidak bisa dihitung karena tabel produk tidak punya
        // kolom stok. Harus ditolak dengan pesan yang terbaca, bukan gagal SQL.
        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', [$order, $kasus]), [
                'resolution_type' => 'replacement',
                'admin_notes' => 'Ganti tanpa varian.',
                'replacement_items' => [[
                    'order_item_id' => $orderItem->id,
                    'product_id' => $product->id,
                    'variant_id' => null,
                    'quantity' => 1,
                ]],
                'return_shipping_cost' => 20000,
            ])
            ->assertSessionHasErrors('replacement_items');

        $this->assertSame('open', $kasus->fresh()->status, 'kasus tidak ikut selesai');
    }

    public function test_ditolak_saat_kasus_sudah_selesai_walau_dikirim_ulang(): void
    {
        $admin = $this->admin();
        [$product, $variant] = $this->produk('RR-3');
        $order = $this->order(['order_status' => 'return_completed']);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => 'RR-3',
            'variant_sku' => 'RR-3-V1',
            'name' => 'Jendela RR-3',
            'unit_price' => 500000,
            'quantity' => 1,
            'line_subtotal' => 500000,
            'line_discount' => 0,
            'line_total' => 500000,
        ]);
        $orderItem = $order->items()->first();
        $kasus = $this->kasus($order, ['status' => 'completed', 'resolution_type' => 'refund']);

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', [$order, $kasus]), [
                'resolution_type' => 'replacement',
                'admin_notes' => 'Coba ulang.',
                'replacement_items' => [[
                    'order_item_id' => $orderItem->id,
                    'product_id' => $product->id,
                    'variant_id' => $variant->id,
                    'quantity' => 1,
                ]],
                'return_shipping_cost' => 0,
            ])
            ->assertSessionHasErrors('return');

        $this->assertSame(20, (int) $variant->fresh()->stock, 'stok tidak dipotong dua kali');
        $this->assertSame(0, DB::table('stock_movements')->count(), 'tidak ada baris buku besar baru');
    }

    // ----------------------------------------------------------- completed_at

    public function test_kasus_selesai_tanpa_tanggal_otomatis_diisi(): void
    {
        $order = $this->order(['order_status' => 'return_completed']);
        $kasus = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'rusak',
            'fault_party' => 'store',
            'customer_notes' => 'Selesai tanpa tanggal.',
            'refund_amount' => 100000,
        ]);

        // Seluruh angka refund dan ongkir retur disaring dari kolom ini, jadi
        // kasus selesai tanpa tanggal akan hilang diam-diam dari laporan.
        $this->assertNotNull($kasus->fresh()->completed_at, 'completed_at wajib terisi');
    }

    public function test_refund_tanpa_tanggal_selesai_tidak_hilang_dari_laporan(): void
    {
        $order = $this->order([
            'order_status' => 'return_completed',
            'created_at' => now(),
        ]);
        $this->tanamEventPengakuan($order);
        OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'rusak',
            'fault_party' => 'store',
            'customer_notes' => 'Refund lewat jalur lama.',
            'refund_amount' => 75000,
            'return_shipping_cost' => 25000,
        ]);

        $laporan = app(\App\Services\StorePerformanceService::class)->build('today', now()->toDateString(), now()->toDateString());

        $this->assertSame(75000.0, (float) $laporan['financial']['refund_adjustments']);
        $this->assertSame(25000.0, (float) $laporan['financial']['return_shipping_store']);
    }

    // ------------------------------------------------------------- ekspor

    public function test_sum_kolom_uang_tabel_pesanan_sama_dengan_kpi(): void
    {
        $admin = $this->admin();
        [$product, $variant] = $this->produk('RR-4');

        // Pesanan diakui: dibuat hari ini dan mencapai Diproses.
        $terjual = $this->order(['order_status' => 'processing', 'total_amount' => 1000000]);
        $this->tanamEventPengakuan($terjual);
        OrderItem::create([
            'order_id' => $terjual->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => 'RR-4',
            'variant_sku' => 'RR-4-V1',
            'name' => 'Jendela RR-4',
            'unit_price' => 1000000,
            'quantity' => 1,
            'line_subtotal' => 1000000,
            'line_discount' => 0,
            'line_total' => 1000000,
        ]);

        // Pesanan ditolak kurir: retur selesai, belum lunas, tidak pernah masuk
        // Diproses sehingga TIDAK diakui sebagai penjualan periode ini.
        $ditolak = $this->order([
            'order_status' => 'return_completed',
            'payment_status' => 'pending',
            'total_amount' => 500000,
        ]);
        OrderReturnCase::create([
            'order_id' => $ditolak->id,
            'status' => 'completed',
            'reason' => 'ditolak',
            'fault_party' => 'other',
            'customer_notes' => 'Paket kembali.',
            'refund_amount' => 0,
            'return_shipping_cost' => 0,
        ]);

        $this->actingAs($admin)->get(route('admin.orders.export', [
            'period' => 'today',
            'from' => now()->toDateString(),
            'to' => now()->toDateString(),
        ]))->assertOk();

        $baris = \App\Support\IncomeDetailQuery::orders(now()->toDateString(), now()->toDateString());
        $grossBaris = array_sum(array_column($baris, 'gross_revenue'));
        $netBaris = array_sum(array_column($baris, 'net_revenue'));

        $laporan = app(\App\Services\StorePerformanceService::class)->build('today', now()->toDateString(), now()->toDateString());
        $fin = $laporan['financial'];

        // Inilah penguncinya: SUM kolom uang Tabel Pesanan tidak boleh berbeda
        // dari KPI yang tampil di layar.
        $this->assertSame(
            round((float) $fin['gross_revenue'], 2),
            round($grossBaris, 2),
            'SUM Penjualan Gross tabel = KPI',
        );
        $this->assertSame(
            round((float) $fin['net_revenue'], 2),
            round($netBaris, 2),
            'SUM Penjualan Bersih tabel = KPI',
        );
    }

    public function test_ongkir_retur_dan_refund_jendela_retur_ikut_masuk_ekspor(): void
    {
        [$product, $variant] = $this->produk('RR-5');

        // Pesanan lama (di luar rentang), retur SELESAI di dalam rentang.
        $lama = $this->order([
            'order_status' => 'return_completed',
            'created_at' => now()->subMonths(2),
        ]);
        $this->tanamEventPengakuan($lama);
        OrderItem::create([
            'order_id' => $lama->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => 'RR-5',
            'variant_sku' => 'RR-5-V1',
            'name' => 'Jendela RR-5',
            'unit_price' => 500000,
            'quantity' => 1,
            'line_subtotal' => 500000,
            'line_discount' => 0,
            'line_total' => 500000,
        ]);
        OrderReturnCase::create([
            'order_id' => $lama->id,
            'status' => 'completed',
            'reason' => 'rusak',
            'fault_party' => 'store',
            'customer_notes' => 'Retur pesanan lama.',
            'refund_amount' => 40000,
            'return_shipping_cost' => 15000,
        ]);

        $baris = \App\Support\IncomeDetailQuery::orders(now()->toDateString(), now()->toDateString());
        $refundBaris = array_sum(array_column($baris, 'refund_amount'));
        $ongkirBaris = array_sum(array_column($baris, 'return_shipping_store'));

        $laporan = app(\App\Services\StorePerformanceService::class)->build('today', now()->toDateString(), now()->toDateString());
        $fin = $laporan['financial'];

        // Refund dan ongkir retur mengikuti tanggal SELESAI retur, jadi pesanan
        // di luar rentang tetap harus menyumbang angkanya ke tabel ekspor.
        $this->assertSame(round((float) $fin['refund_adjustments'], 2), round($refundBaris, 2));
        $this->assertSame(round((float) $fin['return_shipping_store'], 2), round($ongkirBaris, 2));
        $this->assertSame(40000.0, $refundBaris);
        $this->assertSame(15000.0, $ongkirBaris);
    }

    // -------------------------------------------------------------- model

    public function test_tidak_ada_kolom_ongkir_retur_kedua_di_skema(): void
    {
        // Satu fakta bisnis satu kolom: kolom kedua yang tidak pernah diisi
        // formulir admin membuat ekspor pesanan selalu membaca nol.
        $this->assertFalse(
            \Illuminate\Support\Facades\Schema::hasColumn('order_return_cases', 'additional_shipping_amount'),
            'kolom duplikat ongkir retur sudah dibuang',
        );
        $this->assertTrue(
            \Illuminate\Support\Facades\Schema::hasColumn('order_return_cases', 'return_shipping_cost'),
            'kolom ongkir retur yang dipakai tetap ada',
        );
    }
}
