<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Product;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Penjaga keputusan owner 2026-09-29: ongkir perjalanan balik (tagihan
 * pengembalian J&T yang diisi admin saat retur selesai) mostly ditanggung kas
 * toko, jadi mengurangi Penjualan Bersih dan tampil sebagai KPI sendiri,
 * dihitung per kasus retur pada periode penyelesaiannya.
 */
class ReturnTripShippingKpiTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Concerns\TanamEventPengakuan;

    private function makeOrder(): Order
    {
        $order = Order::create([
            'order_number' => 'TRIP-'.uniqid(),
            'customer_name' => 'Cust',
            'customer_phone' => '081500000001',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'return_in_process',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 500000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);

        $this->tanamEventPengakuan($order);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => Product::create([
                'parent_sku' => 'TRIP-'.uniqid(),
                'name' => 'Produk',
                'category_id' => 1,
                'product_category' => 'JENDELA',
                'product_model' => 'SLIDING',
                'design_variant' => 'POLOS',
                'status' => 'active',
                'stock' => 50,
            ])->id,
            'parent_sku' => 'TRIP',
            'variant_sku' => 'TRIP-V',
            'name' => 'Produk',
            'unit_price' => 500000,
            'quantity' => 1,
            'line_subtotal' => 500000,
            'line_discount' => 0,
            'line_total' => 500000,
        ]);

        return $order;
    }

    private function selesaikanKasus(Order $order, float $ongkirBalik = 0.0): void
    {
        OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'rusak',
            'fault_party' => 'store',
            'shipping_cost_borne_by_store' => true,
            'resolution_type' => 'refund',
            'refund_amount' => 0,
            'return_shipping_cost' => 0,
            'additional_shipping_amount' => $ongkirBalik,
            'customer_notes' => 'uji',
            'completed_at' => now(),
            'created_by_user_id' => null,
            'updated_by_user_id' => null,
        ]);
    }

    private function buildReport(): array
    {
        return app(StorePerformanceService::class)->build(period: 'this_month');
    }

    public function test_ongkir_balik_mengurangi_net_dan_muncul_sebagai_kpi(): void
    {
        $order = $this->makeOrder();
        $this->selesaikanKasus($order, 45000.0);

        $laporan = $this->buildReport();
        $fin = $laporan['financial'];
        $this->assertSame(45000.0, (float) $fin['return_trip_shipping']);

        // Pengurang Net langsung terukur: Net dengan ongkir balik 45000 pada
        // penjualan 500000 adalah 455000; tanpa ongkir balik kembali 500000.
        $this->assertSame(455000.0, round((float) $fin['net_revenue'], 2));
        OrderReturnCase::query()->update(['additional_shipping_amount' => 0]);
        $finTanpa = $this->buildReport()['financial'];
        $this->assertSame(500000.0, round((float) $finTanpa['net_revenue'], 2));

        $kpi = collect(collect($laporan['sections'])
            ->firstWhere('key', 'returns_cancellations')['kpis'])
            ->firstWhere('key', 'return_trip_shipping_total');
        $this->assertNotNull($kpi, 'KPI Ongkir Perjalanan Balik ada di blok Retur & Pembatalan');
        $this->assertSame('Ongkir Perjalanan Balik', $kpi['label']);
        $this->assertSame(45000.0, (float) $kpi['value']);
    }

    public function test_dua_kasus_dengan_ongkir_balik_berjumlah_per_kasus(): void
    {
        $order = $this->makeOrder();
        $this->selesaikanKasus($order, 45000.0);
        // Satu pesanan boleh punya lebih dari satu kasus selesai; setiap kasus
        // membawa tagihan perjalanannya sendiri sehingga saling menjumlah.
        $this->selesaikanKasus($order, 25000.0);

        $fin = $this->buildReport()['financial'];
        $this->assertSame(70000.0, (float) $fin['return_trip_shipping']);
    }

    public function test_kasus_void_tidak_dihitung(): void
    {
        $order = $this->makeOrder();
        OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'rusak',
            'fault_party' => 'store',
            'shipping_cost_borne_by_store' => true,
            'resolution_type' => 'refund',
            'refund_amount' => 0,
            'return_shipping_cost' => 0,
            'additional_shipping_amount' => 45000,
            'customer_notes' => 'uji',
            'completed_at' => now(),
            'voided_at' => now(),
            'created_by_user_id' => null,
            'updated_by_user_id' => null,
        ]);

        $fin = $this->buildReport()['financial'];
        $this->assertSame(0.0, (float) $fin['return_trip_shipping']);
    }
}
