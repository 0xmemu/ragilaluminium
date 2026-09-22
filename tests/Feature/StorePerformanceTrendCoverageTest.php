<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak grafik tren: setiap kartu KPI di baris atas halaman Performa Toko
 * harus punya seri tren yang bisa digambar. Sebelumnya kartu Produk Terjual
 * dan Pengunjung yang Membeli tidak punya seri, sehingga klik kartunya tidak
 * menampilkan grafik.
 *
 * Dijaga di sini supaya penambahan KPI baru tidak diam-diam meninggalkan kartu
 * tanpa grafik.
 */
class StorePerformanceTrendCoverageTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Concerns\TanamEventPengakuan;

    /** Kunci chart yang wajib ada, sejajar dengan kartu KPI di baris atas. */
    private const CHART_KEYS = [
        'revenue',
        'orders',
        'products',
        'units',
        'visitors',
        'conversion_rate',
    ];

    private function createProductWithVariant(string $sku): array
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => 'Jendela Tren Kontrak',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-V1',
            'price' => 1_000_000,
            'stock' => 5,
            'status' => 'active',
        ]);

        return [$product, $variant];
    }

    private function createOrder(string $orderNumber, string $variantSku, int $quantity = 1): Order
    {
        $order = Order::create([
            'order_number' => $orderNumber,
            'customer_name' => 'Pelanggan Tren',
            'customer_phone' => '081200000009',
            'shipping_address_line1' => 'Jl Tren No 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1_000_000 * $quantity,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1_000_000 * $quantity,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => Product::query()->value('id'),
            'parent_sku' => 'TREN-PARENT',
            'variant_sku' => $variantSku,
            'name' => 'Jendela Tren',
            'unit_price' => 1_000_000,
            'quantity' => $quantity,
            'line_subtotal' => 1_000_000 * $quantity,
            'line_discount' => 0,
            'line_total' => 1_000_000 * $quantity,
        ]);

        return $this->tanamEventPengakuan($order);
    }

    public function test_setiap_chart_yang_dibutuhkan_kartu_tersedia(): void
    {
        $report = app(StorePerformanceService::class)->build('last_7');

        $keys = array_column($report['charts'], 'key');

        foreach (self::CHART_KEYS as $key) {
            $this->assertContains(
                $key,
                $keys,
                'chart "' . $key . '" wajib ada supaya kartunya bisa menampilkan tren'
            );
        }

        $this->assertSame(
            self::CHART_KEYS,
            $keys,
            'urutan chart harus sejajar dengan urutan kartu KPI di halaman'
        );
    }

    public function test_semua_chart_punya_seri_dan_pembanding(): void
    {
        $report = app(StorePerformanceService::class)->build('last_7');

        foreach ($report['charts'] as $chart) {
            $this->assertNotEmpty(
                $chart['series'],
                'chart "' . $chart['key'] . '" harus punya titik seri, bukan daftar kosong'
            );
            $this->assertNotEmpty(
                $chart['previous_series'],
                'chart "' . $chart['key'] . '" harus punya seri pembanding'
            );

            foreach ($chart['series'] as $point) {
                $this->assertSame(['bucket', 'label', 'value'], array_keys($point));
                $this->assertIsNumeric($point['value']);
            }
        }
    }

    public function test_seri_produk_terjual_menghitung_varian_unik(): void
    {
        $this->createProductWithVariant('TREN-A');

        // Dua pesanan memakai varian sama, satu pesanan varian lain. Total
        // produk terjual harus 2, bukan 3, karena varian dihitung unik.
        $this->createOrder('RA-TREN-0001', 'TREN-A-V1');
        $this->createOrder('RA-TREN-0002', 'TREN-A-V1');
        $this->createOrder('RA-TREN-0003', 'TREN-B-V1');

        $report = app(StorePerformanceService::class)->build('last_7');

        $chart = collect($report['charts'])->firstWhere('key', 'products');
        $this->assertNotNull($chart);
        $this->assertSame('number', $chart['total_format']);
        $this->assertEquals(
            2,
            (int) $chart['total'],
            'produk terjual harus menghitung variant_sku secara unik'
        );

    }

    public function test_seri_produk_terjual_menghitung_baris_tanpa_varian(): void
    {
        $this->createProductWithVariant('TREN-C');
        $order = $this->createOrder('RA-TREN-0004', 'TREN-C-V1');
        // Produk yang dijual tanpa varian ukuran menyimpan variant_sku kosong.
        // Perbaikan 2026-09-21: baris seperti ini tidak lagi dibuang, melainkan
        // dihitung memakai parent_sku, supaya produknya tidak hilang dari
        // laporan. Sebelumnya baris ini dibuang diam diam.
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => Product::query()->value('id'),
            'parent_sku' => 'TREN-PARENT',
            'variant_sku' => null,
            'name' => 'Baris Tanpa Varian',
            'unit_price' => 500_000,
            'quantity' => 1,
            'line_subtotal' => 500_000,
            'line_discount' => 0,
            'line_total' => 500_000,
        ]);

        $report = app(StorePerformanceService::class)->build('last_7');
        $chart = collect($report['charts'])->firstWhere('key', 'products');

        $this->assertEquals(2, (int) $chart['total'], 'baris tanpa varian dihitung memakai parent_sku');

    }

    public function test_seri_konversi_memakai_satuan_persen(): void
    {
        $this->createProductWithVariant('TREN-D');
        $this->createOrder('RA-TREN-0005', 'TREN-D-V1');

        $report = app(StorePerformanceService::class)->build('last_7');
        $chart = collect($report['charts'])->firstWhere('key', 'conversion_rate');

        $this->assertNotNull($chart);
        $this->assertSame(
            'percent',
            $chart['total_format'],
            'chart konversi harus bertanda persen supaya sumbu dan totalnya tidak tampil sebagai angka polos'
        );
    }
}
