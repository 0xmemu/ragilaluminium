<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ImportJob;
use App\Services\StorePerformanceService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AnalyticsController extends Controller
{
    public function __construct(protected StorePerformanceService $performance)
    {
    }

    public function storePerformance(Request $request): Response
    {
        $period = (string) $request->input('period', 'today');
        $granularity = $request->input('granularity');
        $from = $request->input('from');
        $to = $request->input('to');

        $payload = $this->performance->build(
            period: $period,
            from: is_string($from) ? $from : null,
            to: is_string($to) ? $to : null,
            granularity: is_string($granularity) ? $granularity : null,
        );

        return Inertia::render('Admin/Analytics/StorePerformance', [
            'title' => 'Performa Toko',
            'description' => 'Pantau dan analisis basis data performa toko Anda dalam satu antarmuka — pembukuan penjualan, produk, dan operasional.',
            'filters' => [
                'period' => $payload['range']['period'],
                'from' => $payload['range']['from_date'],
                'to' => $payload['range']['to_date'],
                'granularity' => $payload['range']['granularity'],
            ],
            'periodOptions' => [
                ['value' => 'today', 'label' => 'Hari ini'],
                ['value' => 'yesterday', 'label' => 'Kemarin'],
                ['value' => 'last_7', 'label' => '7 Hari'],
                ['value' => 'last_30', 'label' => '30 Hari'],
                ['value' => 'this_month', 'label' => 'Bulan ini'],
                ['value' => 'this_year', 'label' => 'Tahun ini'],
                ['value' => 'all', 'label' => 'Semua'],
                ['value' => 'custom', 'label' => 'Kustom'],
            ],
            'granularityOptions' => [
                ['value' => 'hour', 'label' => 'Per Jam'],
                ['value' => 'day', 'label' => 'Per Hari'],
                ['value' => 'week', 'label' => 'Per Minggu'],
                ['value' => 'month', 'label' => 'Per Bulan'],
            ],
            'report' => $payload,
            'exportUrl' => route('admin.analytics.store-performance.export', [
                'period' => $payload['range']['period'],
                'from' => $payload['range']['from_date'],
                'to' => $payload['range']['to_date'],
                'granularity' => $payload['range']['granularity'],
            ]),
        ]);
    }

    public function exportStorePerformance(Request $request): StreamedResponse
    {
        $period = (string) $request->input('period', 'today');
        $payload = $this->performance->build(
            period: $period,
            from: is_string($request->input('from')) ? $request->input('from') : null,
            to: is_string($request->input('to')) ? $request->input('to') : null,
            granularity: is_string($request->input('granularity')) ? $request->input('granularity') : null,
        );

        $filename = 'performa-toko-'.$payload['range']['from_date'].'_'.$payload['range']['to_date'].'.csv';

        return response()->streamDownload(function () use ($payload) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, ['Performa Toko', $payload['range']['label']]);
            fputcsv($out, ['Dari', $payload['range']['from_date'], 'Sampai', $payload['range']['to_date']]);
            fputcsv($out, []);
            fputcsv($out, ['Bagian', 'Metrik', 'Nilai', 'Periode sebelumnya', 'Perubahan %']);

            foreach ($payload['sections'] as $section) {
                foreach ($section['kpis'] as $kpi) {
                    fputcsv($out, [
                        $section['title'],
                        $kpi['label'],
                        $kpi['value'],
                        $kpi['previous'],
                        $kpi['change_percent'],
                    ]);
                }
            }

            fputcsv($out, []);
            fputcsv($out, ['Produk terlaris']);
            fputcsv($out, ['SKU', 'Nama', 'Unit', 'Omzet', 'Jumlah order']);
            foreach ($payload['top_products'] as $product) {
                fputcsv($out, [
                    $product['parent_sku'],
                    $product['name'],
                    $product['units'],
                    $product['revenue'],
                    $product['order_count'],
                ]);
            }

            fputcsv($out, []);
            fputcsv($out, ['Customer']);
            fputcsv($out, ['Nama', 'Telepon', 'Frekuensi', 'Total belanja', 'Order terakhir']);
            foreach ($payload['customers'] as $customer) {
                fputcsv($out, [
                    $customer['customer_name'],
                    $customer['customer_phone'],
                    $customer['order_count'],
                    $customer['total_spent'],
                    $customer['last_order_at'],
                ]);
            }

            foreach ($payload['charts'] as $chart) {
                fputcsv($out, []);
                fputcsv($out, [$chart['title']]);
                fputcsv($out, ['Bucket', 'Label', 'Nilai']);
                foreach ($chart['series'] as $point) {
                    fputcsv($out, [$point['bucket'], $point['label'], $point['value']]);
                }
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function importPerformance(): Response
    {
        $jobs = ImportJob::latest()->limit(50)->get();

        $total = ImportJob::count();
        $completed = ImportJob::where('status', 'completed')->count();
        $failed = ImportJob::where('status', 'failed')->count();
        $totalRows = (int) ImportJob::sum('total_rows');
        $failedRows = (int) ImportJob::sum('failed_rows');
        $rowFailureRate = $totalRows > 0 ? round(($failedRows / $totalRows) * 100, 2) : 0;

        return Inertia::render('Admin/ResourceShow', [
            'title' => 'Performa Import',
            'subtitle' => '50 job terbaru',
            'fields' => [
                ['label' => 'Total Job', 'value' => $total],
                ['label' => 'Completed', 'value' => $completed],
                ['label' => 'Failed', 'value' => $failed],
                ['label' => 'Row Failure Rate', 'value' => $rowFailureRate.'%'],
            ],
            'sections' => [
                [
                    'title' => 'Job Terbaru',
                    'rows' => $jobs->map(fn (ImportJob $j) => [
                        'label' => '#'.$j->id.' · '.$j->type,
                        'value' => $j->status.' · '.($j->success_rows ?? 0).' ok / '.($j->failed_rows ?? 0).' gagal',
                    ])->values()->all(),
                ],
            ],
        ]);
    }
}
