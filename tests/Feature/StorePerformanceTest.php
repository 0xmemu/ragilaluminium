<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StorePerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_store_performance_page_renders_report(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.analytics.store-performance', ['period' => 'today']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Analytics/StorePerformance')
                ->has('report.sections', 5)
                ->has('report.charts', 5)
                ->where('filters.period', 'today'));
    }

    public function test_revenue_excludes_pending_and_cancelled_orders(): void
    {
        $product = Product::create([
            'parent_sku' => 'WIN-PERF-1',
            'name' => 'Jendela Perf',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $paid = Order::create([
            'order_number' => 'RA-PERF-PAID',
            'customer_name' => 'Budi',
            'customer_phone' => '081111111111',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
        OrderItem::create([
            'order_id' => $paid->id,
            'product_id' => $product->id,
            'parent_sku' => 'WIN-PERF-1',
            'name' => 'Jendela Perf',
            'unit_price' => 1000000,
            'quantity' => 2,
            'line_subtotal' => 2000000,
            'line_discount' => 0,
            'line_total' => 2000000,
        ]);
        // Fix line totals vs order total for metrics (units from items, revenue from order).
        $paid->update(['subtotal_amount' => 2000000, 'total_amount' => 2000000]);

        Order::create([
            'order_number' => 'RA-PERF-PEND',
            'customer_name' => 'Ani',
            'customer_phone' => '082222222222',
            'shipping_address_line1' => 'Jl B',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_postal_code' => '12190',
            'shipping_country' => 'Indonesia',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 500000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        Order::create([
            'order_number' => 'RA-PERF-CAN',
            'customer_name' => 'Cici',
            'customer_phone' => '083333333333',
            'shipping_address_line1' => 'Jl C',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jabar',
            'shipping_postal_code' => '40115',
            'shipping_country' => 'Indonesia',
            'order_status' => 'cancelled',
            'payment_status' => 'pending',
            'shipping_status' => 'cancelled',
            'subtotal_amount' => 750000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 750000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);

        $service = app(StorePerformanceService::class);
        $metrics = $service->metricsFor(now()->startOfDay(), now()->endOfDay());

        $this->assertEquals(2000000.0, $metrics['revenue']);
        // KPI-003: pesanan yang dihitung = order VALID (exclude pending & cancelled) => hanya 1 (processing).
        $this->assertEquals(1, $metrics['orders']);
        $this->assertEquals(2, $metrics['units']);
        $this->assertEquals(1, $metrics['models_sold']);
    }

    public function test_export_xlsx_downloads(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $response = $this->actingAs($admin)
            ->get(route('admin.analytics.store-performance.export', ['period' => 'last_7']))
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->assertHeader('content-disposition');

        $this->assertStringContainsString('.xlsx', $response->headers->get('content-disposition'));
    }

    public function test_storefront_visit_increments_unique_visitors(): void
    {
        $this->get('/')->assertOk();

        $this->assertDatabaseHas('performance_metrics', [
            'metric_name' => 'storefront_unique_visitors',
            'metric_value' => 1,
        ]);
        $this->assertDatabaseHas('performance_metrics', [
            'metric_name' => 'storefront_page_views',
        ]);
    }

    /**
     * Regresi 2026-09-18: granularitas otomatis grafik dan isi dropdown
     * granularitas wajib berasal dari sumber yang sama, sehingga nilai aktif
     * selalu ada di daftar pilihan.
     */
    public function test_granularitas_otomatis_selalu_ada_di_daftar_pilihan(): void
    {
        $service = app(StorePerformanceService::class);

        foreach (['today', 'yesterday', 'last_7', 'last_30', 'this_month', 'this_year', 'all'] as $period) {
            $range = $service->resolveRange(period: $period);
            $values = array_column(
                $service->granularityOptions($range['from'], $range['to']),
                'value',
            );

            $this->assertContains(
                $range['granularity'],
                $values,
                "Granularitas otomatis periode {$period} ({$range['granularity']}) tidak ada di daftar pilihan: ".implode(', ', $values),
            );
        }
    }

    /**
     * Regresi 2026-09-18 (owner): Per Bulan harus tersedia untuk periode Semua,
     * Tahunan, dan rentang kustom yang panjang. Sebelumnya aturan band hanya
     * melihat panjang rentang, sehingga rentang 30 sampai 45 hari tidak pernah
     * menawarkan Per Bulan walau grafiknya tetap terbentuk dari 2 bulan.
     */
    public function test_rentang_panjang_dan_periode_semua_menawarkan_per_bulan(): void
    {
        $service = app(StorePerformanceService::class);

        $ranges = [
            'rentang 40 hari' => ['2026-01-01', '2026-02-09'],
            'rentang 180 hari' => ['2026-01-01', '2026-06-29'],
            'rentang 400 hari' => ['2026-01-01', '2027-02-04'],
            'rentang 800 hari' => ['2026-01-01', '2028-03-10'],
        ];

        foreach ($ranges as $label => $dates) {
            $values = array_column(
                $service->granularityOptions(
                    \Carbon\Carbon::parse($dates[0])->startOfDay(),
                    \Carbon\Carbon::parse($dates[1])->endOfDay(),
                ),
                'value',
            );

            $this->assertContains('month', $values, "Per Bulan seharusnya tersedia untuk {$label}.");
        }
    }

    /** Rentang yang seluruhnya jatuh dalam satu bulan tidak menawarkan Per Bulan. */
    public function test_rentang_dalam_satu_bulan_tidak_menawarkan_per_bulan(): void
    {
        $service = app(StorePerformanceService::class);

        $values = array_column(
            $service->granularityOptions(
                \Carbon\Carbon::parse('2026-01-05')->startOfDay(),
                \Carbon\Carbon::parse('2026-01-25')->endOfDay(),
            ),
            'value',
        );

        $this->assertNotContains('month', $values);
        $this->assertContains('day', $values);
    }

    /**
     * Tiap skala yang ditawarkan wajib benar-benar menggambar garis, minimal
     * dua titik. Ini yang menjaga dropdown dan grafik tidak pernah berbeda.
     */
    public function test_setiap_skala_yang_ditawarkan_menggambar_minimal_dua_titik(): void
    {
        $service = app(StorePerformanceService::class);

        $ranges = [
            ['2026-01-01', '2026-01-01'],
            ['2026-01-01', '2026-01-07'],
            ['2026-01-01', '2026-02-09'],
            ['2026-01-01', '2026-06-29'],
            ['2026-01-01', '2028-03-10'],
        ];

        foreach ($ranges as $dates) {
            $from = \Carbon\Carbon::parse($dates[0])->startOfDay();
            $to = \Carbon\Carbon::parse($dates[1])->endOfDay();

            foreach ($service->granularityOptions($from, $to) as $option) {
                $series = $service->series($from, $to, $option['value'], 'visitors');

                $this->assertGreaterThanOrEqual(
                    2,
                    count($series),
                    "Skala {$option['value']} untuk ".$from->toDateString().' s/d '.$to->toDateString().' menghasilkan kurang dari 2 titik.',
                );
            }
        }
    }
}
