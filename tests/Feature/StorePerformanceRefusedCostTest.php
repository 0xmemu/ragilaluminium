<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ShippingRecord;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Beban nyata paket yang tidak diterima pembeli (keputusan owner 2026-09-19).
 *
 * Pembeli tidak membayar sepeser pun, tetapi J&T sudah mengantar paket ke
 * alamat pembeli sehingga ongkir KIRIM tetap ditagih ke toko, dan biaya
 * layanan COD hangus karena tidak ada uang COD yang bisa dipotong.
 *
 * Angka ini RINCIAN dari pengurang yang sudah tercermin di Penjualan Bersih,
 * bukan pengurang tambahan. Test terakhir mengunci sifat itu supaya tidak ada
 * yang mengurangkannya dua kali di kemudian hari.
 */
class StorePerformanceRefusedCostTest extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(int $sku): Product
    {
        return Product::create([
            'parent_sku' => 'RC-'.$sku,
            'name' => 'Produk Beban Ditolak '.$sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'price' => 100000,
            'stock' => 10,
        ]);
    }

    /**
     * Pesanan COD yang paketnya kembali sebelum diterima pembeli.
     *
     * @param  array<string, mixed>  $overrides
     */
    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RC-'.uniqid(),
            'customer_name' => 'Pelanggan Menolak',
            'customer_phone' => '0813'.random_int(10000000, 99999999),
            'shipping_address_line1' => 'Jl B',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'return_completed',
            'payment_status' => 'pending',
            'shipping_status' => 'returned',
            'subtotal_amount' => 800000,
            'shipping_amount' => 150000,
            'shipping_subsidy_amount' => 0,
            'shipping_insurance_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'cod_fee_amount' => 50000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ], $overrides));
    }

    private function addItem(Order $order, Product $product, int $qty = 1, int $price = 800000): void
    {
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'unit_price' => $price,
            'quantity' => $qty,
            'line_subtotal' => $price * $qty,
            'line_discount' => 0,
            'line_total' => $price * $qty,
        ]);
    }

    /** @return array<string, float|int> */
    private function financial(): array
    {
        return app(StorePerformanceService::class)->build(period: 'this_month')['financial'];
    }

    private function borneKpi(): array
    {
        $report = app(StorePerformanceService::class)->build(period: 'this_month');

        return collect(collect($report['sections'])
            ->firstWhere('key', 'returns_cancellations')['kpis'])
            ->firstWhere('key', 'refused_borne_cost');
    }

    public function test_beban_dihitung_dari_ongkir_checkout_saat_jnt_belum_melapor(): void
    {
        $product = $this->makeProduct(1);
        $order = $this->makeOrder();
        $this->addItem($order, $product);

        $fin = $this->financial();

        // J&T belum melaporkan tagihan: ongkir memakai asumsi checkout
        // (ongkir pembeli + subsidi + asuransi) = 150000, lalu ditambah biaya
        // layanan COD 50000.
        $this->assertSame(150000.0, (float) $fin['refused_shipping_cost']);
        $this->assertSame(50000.0, (float) $fin['refused_cod_fee']);
        $this->assertSame(200000.0, (float) $fin['refused_borne_cost']);
        $this->assertSame(1, (int) $fin['refused_borne_count']);
    }

    public function test_tagihan_asli_jnt_dipakai_bila_sudah_dilaporkan(): void
    {
        $product = $this->makeProduct(2);
        $order = $this->makeOrder();
        $this->addItem($order, $product);

        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'jnt',
            'waybill_number' => 'JT-RC-'.uniqid(),
            'status' => 'returned',
            'status_raw' => 'returned',
            'last_status_at' => now(),
            'shipping_cost' => 187500,
        ]);

        $fin = $this->financial();

        // Tagihan asli J&T menang atas asumsi checkout, termasuk walau status
        // resinya already returned: yang diambil adalah nilai tagihannya.
        $this->assertSame(187500.0, (float) $fin['refused_shipping_cost']);
        $this->assertSame(237500.0, (float) $fin['refused_borne_cost']);
    }

    public function test_pesanan_yang_sudah_lunas_tidak_masuk_beban(): void
    {
        $product = $this->makeProduct(3);
        $order = $this->makeOrder(['payment_status' => 'paid']);
        $this->addItem($order, $product);
        Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cod',
            'amount' => 1000000,
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $fin = $this->financial();

        // Uang sudah diterima: tidak ada kas yang batal, jadi tidak ada beban
        // paket ditolak yang perlu dicatat di sini.
        $this->assertSame(0.0, (float) $fin['refused_borne_cost']);
        $this->assertSame(0, (int) $fin['refused_borne_count']);
    }

    public function test_retur_yang_masih_berjalan_belum_masuk_beban(): void
    {
        $product = $this->makeProduct(4);
        $order = $this->makeOrder(['order_status' => 'return_in_process']);
        $this->addItem($order, $product);

        $fin = $this->financial();

        // Selama retur belum selesai, kas belum final: beban dicatat saat
        // retur ditutup supaya tidak ada angka yang berubah-ubah.
        $this->assertSame(0.0, (float) $fin['refused_borne_cost']);
        $this->assertSame(0, (int) $fin['refused_borne_count']);
    }

    public function test_beban_adalah_rincian_bukan_pengurang_tambahan(): void
    {
        $product = $this->makeProduct(5);
        $order = $this->makeOrder();
        $this->addItem($order, $product);

        $fin = $this->financial();

        // Nilai barang yang batal dikeluarkan lewat refused_goods_value,
        // sedangkan ongkir dan biaya COD tetap keluar sehingga sudah ikut
        // terhitung di shipping_raw dan cod_fee. Karena itu Penjualan Bersih
        // TIDAK boleh dikurangi refused_borne_cost lagi.
        $expected = (float) $fin['gross_revenue']
            - (float) $fin['shipping_raw']
            - (float) $fin['cod_fee']
            - (float) $fin['refund_adjustments']
            - (float) $fin['return_shipping_store']
            - (float) $fin['refused_goods_value'];

        $this->assertSame(round($expected, 2), round((float) $fin['net_revenue'], 2));
        $this->assertGreaterThan(0.0, (float) $fin['refused_borne_cost'], 'beban tetap dilaporkan sebagai rincian');
    }

    public function test_kpi_beban_terbaca_dengan_label_yang_jelas(): void
    {
        $product = $this->makeProduct(6);
        $order = $this->makeOrder();
        $this->addItem($order, $product);

        $kpi = $this->borneKpi();

        $this->assertNotNull($kpi, 'KPI beban paket ditolak ada di blok Retur & Pembatalan');
        $this->assertSame(200000.0, (float) $kpi["value"]);
        $this->assertStringContainsString("Ongkir kirim", (string) $kpi["detail"]);
        $this->assertStringContainsString("perjalanan balik", (string) $kpi["detail"]);
    }
}
