<?php

namespace Tests\Feature;

use App\Http\Controllers\Admin\AnalyticsController;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak data grafik tren: kedua seri yang dipasangkan halaman harus sejajar.
 *
 * Halaman memasangkan seri periode ini dan periode pembanding berdasarkan
 * INDEKS array, bukan kunci tanggal. Karena itu tiga hal wajib berlaku pada
 * setiap kombinasi periode dan granularitas yang ditawarkan UI:
 *
 *   1. jumlah titik kedua seri sama, supaya pasangan indeks tidak bergeser
 *   2. tidak ada label yang muncul di kedua seri, supaya tooltip tidak
 *      menuliskan "Minggu 14 vs Minggu 14" untuk dua minggu berbeda
 *   3. untuk chart yang basisnya penjumlahan, angka Total sama dengan jumlah
 *      titik serinya, begitu juga angka pembanding
 *
 * Penyejajaran jendela pembanding ke batas bucket (minggu, bulan, tahun)
 * diperlukan untuk nomor 1 dan 2. Sebelumnya jendela pembanding dihitung dari
 * selisih detik sehingga bucket pertama atau terakhir muncul di kedua seri.
 */
class StorePerformanceChartAlignmentTest extends TestCase
{
    use RefreshDatabase;

    private function service(): StorePerformanceService
    {
        return app(StorePerformanceService::class);
    }

    /** Kombinasi periode dan granularitas yang benar-benar ditawarkan UI. */
    private function reachableCombinations(): array
    {
        $controller = app(AnalyticsController::class);
        $method = new \ReflectionMethod($controller, 'allowedGranularity');
        $method->setAccessible(true);

        $service = $this->service();
        $combinations = [];

        foreach (['today', 'yesterday', 'last_7', 'last_30', 'this_month', 'this_year', 'all'] as $period) {
            $range = $service->resolveRange($period);
            $payload = ['range' => [
                'from_date_iso' => $range['from']->toDateString(),
                'to_date_iso' => $range['to']->toDateString(),
            ]];

            foreach (array_column($method->invoke($controller, $payload, null, null), 'value') as $granularity) {
                $combinations[] = [$period, $granularity];
            }
        }

        return $combinations;
    }

    private function createProductWithVariant(string $sku): ProductVariant
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => 'Jendela Sejajar Kontrak',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        return ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-V1',
            'price' => 1_000_000,
            'stock' => 5,
            'status' => 'active',
        ]);
    }

    private function createOrder(string $orderNumber, ProductVariant $variant): Order
    {
        $order = Order::create([
            'order_number' => $orderNumber,
            'customer_name' => 'Pelanggan Sejajar',
            'customer_phone' => '081200000011',
            'shipping_address_line1' => 'Jl Sejajar No 1',
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

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $variant->product_id,
            'parent_sku' => 'SEJAJAR-PARENT',
            'variant_sku' => $variant->variant_sku,
            'name' => 'Jendela Sejajar',
            'unit_price' => 1_000_000,
            'quantity' => 1,
            'line_subtotal' => 1_000_000,
            'line_discount' => 0,
            'line_total' => 1_000_000,
        ]);

        return $order;
    }

    public function test_jumlah_titik_kedua_seri_selalu_sama(): void
    {
        $variant = $this->createProductWithVariant('SEJAJAR-A');
        $this->createOrder('RA-SEJAJAR-0001', $variant);

        foreach ($this->reachableCombinations() as [$period, $granularity]) {
            $report = $this->service()->build($period, null, null, $granularity);

            foreach ($report['charts'] as $chart) {
                $this->assertCount(
                    count($chart['previous_series']),
                    $chart['series'],
                    'titik seri ' . $chart['key'] . ' pada ' . $period.' + '.$granularity
                        .' harus sama banyak dengan seri pembandingnya, karena halaman'
                        .' memasangkan keduanya berdasarkan indeks'
                );
            }
        }
    }

    public function test_tidak_ada_label_yang_muncul_di_kedua_seri(): void
    {
        $variant = $this->createProductWithVariant('SEJAJAR-B');
        $this->createOrder('RA-SEJAJAR-0002', $variant);

        foreach ($this->reachableCombinations() as [$period, $granularity]) {
            $report = $this->service()->build($period, null, null, $granularity);
            $resolved = $report['range']['granularity'];

            // Skala Per Jam sengaja membandingkan jam yang sama di hari berbeda,
            // jadi label kedua seri memang sama; yang wajib adalah label
            // pembandingnya memuat tanggal supaya tooltip tidak ambigu.
            if ($resolved === 'hour') {
                foreach ($report['charts'] as $chart) {
                    foreach ($chart['previous_series'] as $point) {
                        $this->assertMatchesRegularExpression(
                            '/\d{1,2} \w+ \d{2}:\d{2}/',
                            (string) $point['label'],
                            'label pembanding Per Jam harus memuat tanggal pada '.$period
                        );
                    }
                }

                continue;
            }

            foreach ($report['charts'] as $chart) {
                $labelSekarang = array_column($chart['series'], 'label');
                $labelPembanding = array_column($chart['previous_series'], 'label');

                $this->assertSame(
                    [],
                    array_values(array_intersect($labelSekarang, $labelPembanding)),
                    'label chart '.$chart['key'].' pada '.$period.' + '.$granularity
                        .' tidak boleh muncul di kedua seri, karena pembaca akan'
                        .' mengira keduanya periode yang sama'
                );
            }
        }
    }

    public function test_total_dan_pembanding_cocok_untuk_chart_yang_dijumlahkan(): void
    {
        $variant = $this->createProductWithVariant('SEJAJAR-C');
        $this->createOrder('RA-SEJAJAR-0003', $variant);

        foreach ($this->reachableCombinations() as [$period, $granularity]) {
            $report = $this->service()->build($period, null, null, $granularity);

            foreach ($report['charts'] as $chart) {
                if (($chart['total_basis'] ?? null) !== 'sum') {
                    continue;
                }

                $jumlahTitik = array_sum(array_column($chart['series'], 'value'));
                $jumlahPembanding = array_sum(array_column($chart['previous_series'], 'value'));

                if (abs((float) $chart['total']) > 0.001) {
                    $this->assertEqualsWithDelta(
                        (float) $chart['total'],
                        (float) $jumlahTitik,
                        0.01,
                        'Total chart '.$chart['key'].' pada '.$period.' + '.$granularity
                            .' harus sama dengan jumlah titik serinya'
                    );
                }

                if (abs((float) $chart['previous_total']) > 0.001) {
                    $this->assertEqualsWithDelta(
                        (float) $chart['previous_total'],
                        (float) $jumlahPembanding,
                        0.01,
                        'Pembanding chart '.$chart['key'].' pada '.$period.' + '.$granularity
                            .' harus sama dengan jumlah titik seri pembandingnya'
                    );
                }
            }
        }
    }

    public function test_setiap_chart_menyatakan_dasar_hitungan_totalnya(): void
    {
        $report = $this->service()->build('last_7');

        $dikenal = ['sum', 'unique_period', 'unique_daily', 'ratio'];

        foreach ($report['charts'] as $chart) {
            $this->assertArrayHasKey(
                'total_basis',
                $chart,
                'chart '.$chart['key'].' harus menyatakan dasar hitungan Total, supaya'
                    .' angka Total tidak tampak tidak cocok dengan grafiknya'
            );
            $this->assertContains($chart['total_basis'], $dikenal);
        }
    }

    public function test_label_bucket_hari_memuat_tahun_bila_lintas_tahun(): void
    {
        $report = $this->service()->build('all', null, null, 'day');
        $chart = collect($report['charts'])->firstWhere('key', 'orders');

        $tahun = [];
        foreach ($chart['series'] as $point) {
            $tahun[] = substr((string) $point['bucket'], 0, 4);
        }
        $tahun = array_unique($tahun);

        if (count($tahun) < 2) {
            $this->markTestSkipped('data belum mencakup dua tahun kalender');
        }

        foreach ($chart['series'] as $point) {
            $this->assertMatchesRegularExpression(
                '/\d{4}$/',
                (string) $point['label'],
                'label hari pada grid lintas tahun harus memuat tahun'
            );
        }
    }

    public function test_label_minggu_selalu_memuat_tahun(): void
    {
        $report = $this->service()->build('this_year', null, null, 'week');
        $chart = collect($report['charts'])->firstWhere('key', 'orders');

        foreach ($chart['series'] as $point) {
            $this->assertMatchesRegularExpression(
                '/Minggu \d{1,2} \d{4}/',
                (string) $point['label'],
                'label minggu harus memuat tahun supaya tidak bertabrakan dengan seri pembanding'
            );
        }
    }
}
