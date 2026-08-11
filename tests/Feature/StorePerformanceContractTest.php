<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PerformanceMetric;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Mengunci kontrak payload dashboard: `performa.metrics` (4 KPI traffic) dan
 * `performa.trend` (granularity + series) yang diturunkan DashboardController
 * dari StorePerformanceService::build().
 *
 * Jika shape/urutan/atribut di sini berubah, Dashboard.tsx (MetricTile, TrendBars)
 * akan pecah — jadi setiap perubahan kontrak harus disengaja.
 */
class StorePerformanceContractTest extends TestCase
{
    use RefreshDatabase;

    private const DASHBOARD_TRAFFIC_KEYS = [
        'visitors',
        'conversion',
        'new_customers',
        'repeat_customers',
    ];

    private function createVisibleProduct(string $sku = 'WIN-PERF-CONTRACT'): Product
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => 'Jendela Performa Kontrak',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-V1',
            'price' => 1_000_000,
            'stock' => 5,
            'status' => 'active',
        ]);

        return $product;
    }

    private function createFulfilledOrder(string $orderNumber, int $total): Order
    {
        $product = $this->createVisibleProduct('WIN-PERF-CONTRACT-'.substr($orderNumber, -6));

        $order = Order::create([
            'order_number' => $orderNumber,
            'customer_name' => 'Pelanggan Kontrak',
            'customer_phone' => '081200000001',
            'shipping_address_line1' => 'Jl Kontrak No 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $total,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'unit_price' => $total,
            'quantity' => 1,
            'line_subtotal' => $total,
            'line_discount' => 0,
            'line_total' => $total,
        ]);

        return $order;
    }

    public function test_build_today_exposes_exactly_the_4_dashboard_traffic_kpis(): void
    {
        $report = app(StorePerformanceService::class)->build('today');

        $traffic = collect($report['sections'])->firstWhere('key', 'traffic');
        $this->assertNotNull($traffic, 'section traffic wajib ada di report');

        // Persis derivasi DashboardController:
        $dashboardMetrics = collect($traffic['kpis'])
            ->whereIn('key', self::DASHBOARD_TRAFFIC_KEYS)
            ->values()
            ->all();

        $this->assertCount(4, $dashboardMetrics);
        $this->assertSame(self::DASHBOARD_TRAFFIC_KEYS, array_column($dashboardMetrics, 'key'));

        foreach ($dashboardMetrics as $metric) {
            $this->assertSame(
                ['key', 'label', 'value', 'previous', 'change_percent', 'format'],
                array_keys($metric),
                "shape KPI {$metric['key']} harus persis kontrak Dashboard.tsx"
            );
            $this->assertIsString($metric['label']);
            $this->assertIsNumeric($metric['value']);
            $this->assertIsNumeric($metric['previous']);
            $this->assertTrue(
                $metric['change_percent'] === null || is_numeric($metric['change_percent']),
                "change_percent {$metric['key']} harus null atau numerik"
            );
            $this->assertContains($metric['format'], ['number', 'percent', 'currency', 'hours', 'days']);
        }
    }

    public function test_granularity_contract_hour_for_today_day_for_last_7(): void
    {
        $service = app(StorePerformanceService::class);

        $this->assertSame('hour', $service->build('today')['range']['granularity']);
        $this->assertSame('day', $service->build('last_7')['range']['granularity']);
        $this->assertSame('last_7', $service->build('last_7')['range']['period']);
    }

    public function test_revenue_chart_series_shape_fed_to_trend_bars(): void
    {
        $this->createFulfilledOrder('RA-CONTRACT-0001', 2_000_000);

        $report = app(StorePerformanceService::class)->build('last_7');

        $chart = collect($report['charts'])->firstWhere('key', 'revenue');
        $this->assertNotNull($chart);
        $this->assertSame('currency', $chart['total_format']);
        $this->assertSame(2_000_000.0, $chart['total']);
        $this->assertCount(7, $chart['series'], 'last_7 harus punya 7 titik harian');

        foreach ($chart['series'] as $point) {
            $this->assertSame(
                ['bucket', 'label', 'value'],
                array_keys($point),
                'shape titik series harus {bucket, label, value}'
            );
            $this->assertIsNumeric($point['value']);
        }

        // Total series harus sama dengan total chart (revenue hari ini masuk salah satu bucket).
        $seriesSum = array_sum(array_column($chart['series'], 'value'));
        $this->assertEqualsWithDelta(2_000_000.0, $seriesSum, 0.01);
    }

    public function test_visitors_and_orders_feed_today_kpis(): void
    {
        $this->createFulfilledOrder('RA-CONTRACT-0002', 1_500_000);

        // SQLite menyimpan metric_date cast date sebagai 'Y-m-d 00:00:00', sedangkan
        // visitorsBetween memakai whereBetween string tanggal — di MySQL kolom DATE
        // men-trim time jadi ini artefak env test. Insert raw menyimpan plain date
        // persis seperti perilaku produksi, sehingga kontrak tetap teruji.
        DB::table('performance_metrics')->insert([
            'metric_date' => now()->toDateString(),
            'metric_name' => 'storefront_unique_visitors',
            'metric_value' => 3,
            'context' => null,
            'created_at' => now(),
        ]);

        $report = app(StorePerformanceService::class)->build('today');

        $traffic = collect($report['sections'])->firstWhere('key', 'traffic')['kpis'];
        $sales = collect($report['sections'])->firstWhere('key', 'sales')['kpis'];

        $visitors = collect($traffic)->firstWhere('key', 'visitors');
        $conversion = collect($traffic)->firstWhere('key', 'conversion');
        $revenue = collect($sales)->firstWhere('key', 'omzet');

        $this->assertSame(3, $visitors['value']);
        $this->assertEqualsWithDelta(33.33, $conversion['value'], 0.01); // 1 order / 3 pengunjung * 100
        $this->assertEqualsWithDelta(1_500_000.0, $revenue['value'], 0.01);
        $this->assertSame('number', $visitors['format']);
        $this->assertSame('percent', $conversion['format']);
        $this->assertSame('currency', $revenue['format']);
    }

    public function test_change_percent_rules_match_dashboard_delta_badge(): void
    {
        $service = app(StorePerformanceService::class);

        // Tidak ada data kemarin & hari ini → 0.0 (bukan null), supaya DeltaBadge tidak kosong.
        $empty = $service->build('today');
        $traffic = collect($empty['sections'])->firstWhere('key', 'traffic')['kpis'];
        $visitors = collect($traffic)->firstWhere('key', 'visitors');

        $this->assertSame(0.0, $visitors['change_percent']);

        // Kemarin ada revenue 1jt, hari ini 2jt → +100.0.
        $yesterday = now()->subDay()->startOfDay();
        $yesterdayOrder = Order::create([
            'order_number' => 'RA-CONTRACT-YEST',
            'customer_name' => 'Kemarin',
            'customer_phone' => '081200000002',
            'shipping_address_line1' => 'Jl Kontrak No 2',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1_000_000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1_000_000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
        // created_at bukan fillable → set langsung agar order jatuh ke kemarin.
        $yesterdayOrder->created_at = $yesterday->copy()->addHour();
        $yesterdayOrder->save();
        $this->createFulfilledOrder('RA-CONTRACT-0003', 2_000_000);

        $report = $service->build('today');
        $sales = collect($report['sections'])->firstWhere('key', 'sales')['kpis'];
        $omzet = collect($sales)->firstWhere('key', 'omzet');

        $this->assertEqualsWithDelta(100.0, $omzet['change_percent'], 0.01);
    }
}
