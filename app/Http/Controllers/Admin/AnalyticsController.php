<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ImportJob;
use App\Services\StorePerformanceService;
use App\Support\ExportSafety;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
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

        $payload = $this->injectConversionDetail($payload);

        return Inertia::render('Admin/Analytics/StorePerformance', [
            'title' => 'Performa Toko',
            'description' => 'Pantau dan analisis basis data performa toko Anda dalam satu antarmuka — pembukuan penjualan, produk, dan operasional.',
            'filters' => [
                'period' => $payload['range']['period'],
                'from' => $payload['range']['from_date_iso'] ?? $payload['range']['from_date'],
                'to' => $payload['range']['to_date_iso'] ?? $payload['range']['to_date'],
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
                ['value' => 'year', 'label' => 'Per Tahun'],
            ],
            'report' => $payload,
            'exportUrl' => route('admin.analytics.store-performance.export', [
                'period' => $payload['range']['period'],
                'from' => $payload['range']['from_date_iso'] ?? $payload['range']['from_date'],
                'to' => $payload['range']['to_date_iso'] ?? $payload['range']['to_date'],
                'granularity' => $payload['range']['granularity'],
            ]),
        ]);
    }

    /**
     * Tambahkan breakdown konkret "N dari N pengunjung" untuk KPI conversion
     * HANYA di halaman analytics (bukan dashboard) — dashboard kontrak ketat 6 key
     * tetap terjaga karena service tidak menyentuh detail.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function injectConversionDetail(array $payload): array
    {
        $sections = collect($payload['sections'] ?? []);

        $orders = (int) collect($sections->firstWhere('key', 'sales')['kpis'] ?? [])
            ->firstWhere('key', 'orders')['value'] ?? 0;
        $visitors = (int) collect($sections->firstWhere('key', 'traffic')['kpis'] ?? [])
            ->firstWhere('key', 'visitors')['value'] ?? 0;

        $detail = ($orders > 0 || $visitors > 0)
            ? sprintf('%s dari %s pengunjung', number_format($orders, 0, ',', '.'), number_format($visitors, 0, ',', '.'))
            : null;

        $payload['sections'] = $sections->map(function (array $section) use ($detail) {
            if (($section['key'] ?? null) !== 'traffic') {
                return $section;
            }

            $section['kpis'] = collect($section['kpis'])->map(function (array $kpi) use ($detail) {
                if (($kpi['key'] ?? null) === 'conversion' && $detail !== null) {
                    $kpi['detail'] = $detail;
                }

                return $kpi;
            })->all();

            return $section;
        })->all();

        return $payload;
    }

    public function exportStorePerformance(Request $request): \Illuminate\Http\Response
    {
        $period = (string) $request->input('period', 'today');
        $payload = $this->performance->build(
            period: $period,
            from: is_string($request->input('from')) ? $request->input('from') : null,
            to: is_string($request->input('to')) ? $request->input('to') : null,
            granularity: is_string($request->input('granularity')) ? $request->input('granularity') : null,
        );

        $filename = 'performa-toko-'.$payload['range']['from_date'].'_'.$payload['range']['to_date'].'.xlsx';

        ExportSafety::assertPerformancePayloadWithinLimit($payload);


        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Performa Toko');

        $row = 1;
        $sheet->setCellValue('A'.$row, 'Performa Toko');
        $sheet->setCellValue('B'.$row, $payload['range']['label']);
        $row++;
        $sheet->setCellValue('A'.$row, 'Dari');
        $sheet->setCellValue('B'.$row, $payload['range']['from_date']);
        $sheet->setCellValue('C'.$row, 'Sampai');
        $sheet->setCellValue('D'.$row, $payload['range']['to_date']);
        $row += 2;

        // Task 4: ringkasan financial utama (gross/net/refund) sebelum tabel KPI.
        $sheet->setCellValue('A'.$row, 'Financial');
        $sheet->getStyle('A'.$row)->getFont()->setBold(true);
        $row++;
        $fin = $payload['financial'] ?? [];
        $finRows = [
            ['Penjualan (Gross)', $fin['gross_revenue'] ?? 0],
            ['Penjualan Bersih', $fin['net_revenue'] ?? 0],
            ['Refund Diberikan', $fin['refund_adjustments'] ?? 0],
        ];
        foreach ($finRows as $fr) {
            $sheet->fromArray(['Financial', $fr[0], $fr[1], '', ''], null, 'A'.$row);
            $row++;
        }
        $row++;

        $headers = ['Bagian', 'Metrik', 'Nilai', 'Periode sebelumnya', 'Perubahan %'];
        $sheet->fromArray($headers, null, 'A'.$row);
        $headerRow = $row;
        $row++;
        foreach ($payload['sections'] as $section) {
            foreach ($section['kpis'] as $kpi) {
                $sheet->fromArray([
                    $section['title'],
                    $kpi['label'],
                    $kpi['value'],
                    $kpi['previous'],
                    $kpi['change_percent'] === null ? 'Baru pada periode ini' : $kpi['change_percent'],
                ], null, 'A'.$row);
                $row++;
            }
        }
        $sheet->getStyle('A'.$headerRow.':E'.$headerRow)->getFont()->setBold(true);

        $row++;
        $sheet->setCellValue('A'.$row, 'Produk terlaris')->getStyle('A'.$row)->getFont()->setBold(true);
        $row++;
        $sheet->fromArray(['SKU', 'Nama', 'Unit', 'Omzet', 'Jumlah order'], null, 'A'.$row);
        $row++;
        foreach ($payload['top_products'] as $product) {
            $sheet->fromArray([
                $product['parent_sku'],
                $product['name'],
                $product['units'],
                $product['revenue'],
                $product['order_count'],
            ], null, 'A'.$row);
            $row++;
        }

        $row++;
        $sheet->setCellValue('A'.$row, 'Customer')->getStyle('A'.$row)->getFont()->setBold(true);
        $row++;
        $sheet->fromArray(['Nama', 'Telepon', 'Frekuensi', 'Total belanja', 'Order terakhir'], null, 'A'.$row);
        $row++;
        foreach ($payload['customers'] as $customer) {
            $sheet->fromArray([
                $customer['customer_name'],
                $customer['customer_phone'],
                $customer['order_count'],
                $customer['total_spent'],
                $customer['last_order_at'],
            ], null, 'A'.$row);
            $row++;
        }

        foreach ($payload['charts'] as $chart) {
            $row++;
            $sheet->setCellValue('A'.$row, $chart['title'])->getStyle('A'.$row)->getFont()->setBold(true);
            $row++;
            $sheet->fromArray(['Bucket', 'Label', 'Nilai'], null, 'A'.$row);
            $row++;
            foreach ($chart['series'] as $point) {
                $sheet->fromArray([$point['bucket'], $point['label'], $point['value']], null, 'A'.$row);
                $row++;
            }
        }

        foreach (range('A', 'E') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        ob_start();
        $writer = new Xlsx($spreadsheet);
        $writer->save('php://output');
        $xls = ob_get_clean();
        $spreadsheet->disconnectWorksheets();

        return response($xls)->withHeaders([
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
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
