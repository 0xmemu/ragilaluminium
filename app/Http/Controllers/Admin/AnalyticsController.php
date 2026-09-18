<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ImportJob;
use App\Services\StorePerformanceService;
use App\Support\ExportSafety;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\StorePerformanceExport;
use Illuminate\Http\RedirectResponse;
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
        $from = is_string($request->input('from')) ? $request->input('from') : null;
        $to = is_string($request->input('to')) ? $request->input('to') : null;
        $rawGranularity = $request->input('granularity');

        // Resolve range to check valid allowed granularities for this period/span
        $range = $this->performance->resolveRange(
            period: $period,
            from: $from,
            to: $to,
        );
        $allowedOptions = $this->allowedGranularity(['range' => [
            'from_date_iso' => $range['from']->toDateString(),
            'to_date_iso' => $range['to']->toDateString(),
        ]], from: $from, to: $to);
        $allowedValues = array_column($allowedOptions, 'value');

        // If requested granularity is not allowed for this range, fallback to null (auto)
        $granularity = is_string($rawGranularity) && in_array($rawGranularity, $allowedValues, true)
            ? $rawGranularity
            : null;

        $payload = $this->performance->build(
            period: $period,
            from: $from,
            to: $to,
            granularity: $granularity,
        );

        return Inertia::render('Admin/Analytics/StorePerformance', [
            'title' => 'Performa Toko',
            'description' => 'Ringkasan bisnis toko: penjualan, pengunjung, operasional, dan pembayaran pada periode terpilih.',
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
            'granularityOptions' => $this->allowedGranularity($payload, from: is_string($from) ? $from : null, to: is_string($to) ? $to : null),
            'report' => $payload,
            'exportUrl' => route('admin.analytics.store-performance.export', [
                'period' => $payload['range']['period'],
                'from' => $payload['range']['from_date_iso'] ?? $payload['range']['from_date'],
                'to' => $payload['range']['to_date_iso'] ?? $payload['range']['to_date'],
                'granularity' => $payload['range']['granularity'],
            ]),
        ]);
    }

    public function exportStorePerformance(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $period = (string) $request->input('period', 'today');
        $from = is_string($request->input('from')) ? $request->input('from') : null;
        $to = is_string($request->input('to')) ? $request->input('to') : null;
        $granularity = is_string($request->input('granularity')) ? $request->input('granularity') : null;

        // Rentang & granularitas KHUSUS export (independen dari filter layar);
        // fallback ke filter layar bila tidak diisi.
        $exportFrom = is_string($request->input('export_from')) && $request->input('export_from') !== '' ? $request->input('export_from') : $from;
        $exportTo = is_string($request->input('export_to')) && $request->input('export_to') !== '' ? $request->input('export_to') : $to;
        $rawExportGranularity = is_string($request->input('export_granularity')) && $request->input('export_granularity') !== '' ? $request->input('export_granularity') : $granularity;

        $exportRange = $this->performance->resolveRange(period: $period, from: $exportFrom, to: $exportTo);
        $exportAllowed = $this->allowedGranularity(['range' => [
            'from_date_iso' => $exportRange['from']->toDateString(),
            'to_date_iso' => $exportRange['to']->toDateString(),
        ]], from: $exportFrom, to: $exportTo);
        $exportAllowedValues = array_column($exportAllowed, 'value');

        $exportGranularity = is_string($rawExportGranularity) && in_array($rawExportGranularity, $exportAllowedValues, true)
            ? $rawExportGranularity
            : null;

        $payload = $this->performance->build(
            period: $period,
            from: $exportFrom,
            to: $exportTo,
            granularity: $exportGranularity,
        );

        // Sheet Income Detail + Item Terjual: data baris per pesanan/item pada rentang
        // yang SAMA dengan payload performa (range.from/to), sesuai kontrak export.
        $payload['income_detail'] = \App\Support\IncomeDetailQuery::orders($payload['range']['from_date_iso'], $payload['range']['to_date_iso']);
        $payload['sold_items'] = \App\Support\IncomeDetailQuery::items($payload['range']['from_date_iso'], $payload['range']['to_date_iso']);

        ExportSafety::assertPerformancePayloadWithinLimit($payload);

        // Span > 31 hari: pecah per bulan kalender -> satu file, set sheet
        // lengkap per bulan (nama sheet ber-suffix nama bulan).
        $fromDate = \Carbon\Carbon::parse($payload['range']['from_date_iso']);
        $toDate = \Carbon\Carbon::parse($payload['range']['to_date_iso']);
        $spanDays = $fromDate->diffInDays($toDate) + 1;

        if ($spanDays > 31) {
            $sheets = [];
            $cursor = $fromDate->copy()->startOfDay();
            while ($cursor->lte($toDate)) {
                $monthFrom = $cursor->copy()->startOfMonth();
                $monthTo = $cursor->copy()->endOfMonth()->min($toDate)->endOfDay();
                $monthPayload = $this->performance->build(
                    period: 'custom',
                    from: $monthFrom->toDateString(),
                    to: $monthTo->toDateString(),
                    granularity: $exportGranularity,
                );

                // Kontrak export: rincian baris wajib ikut rentang payload
                // bulan ini. Tanpa ini, sheet Rincian Pesanan & Item Terjual
                // tiap bulan kosong padahal angka finansialnya ada (bug 2026-09-11).
                $monthPayload['income_detail'] = \App\Support\IncomeDetailQuery::orders($monthPayload['range']['from_date_iso'], $monthPayload['range']['to_date_iso']);
                $monthPayload['sold_items'] = \App\Support\IncomeDetailQuery::items($monthPayload['range']['from_date_iso'], $monthPayload['range']['to_date_iso']);

                ExportSafety::assertPerformancePayloadWithinLimit($monthPayload);
                $suffix = $monthFrom->translatedFormat('M Y');
                $sheets = array_merge($sheets, (new StorePerformanceExport($monthPayload, $suffix))->sheets());
                $cursor = $monthTo->copy()->addDay()->startOfDay();
            }

            return Excel::download(
                new \App\Exports\StorePerformanceMonthlyExport($sheets),
                'performa-toko-'.$payload['range']['from_date'].'_'.$payload['range']['to_date'].'.xlsx',
            );
        }

        return Excel::download(new StorePerformanceExport($payload), 'performa-toko-'.$payload['range']['from_date'].'_'.$payload['range']['to_date'].'.xlsx');
    }

    public function importPerformance(): RedirectResponse
    {
        // Semua metrik performa import kini tersaji langsung di daftar import
        // (KPI kartu + kolom Hasil Import). Halaman analitik terpisah hanya
        // menduplikasi informasi yang sama, jadi dialihkan ke sumber utamanya.
        return redirect()->route('admin.imports.index');
    }

    /**
     * Opsi granularitas tren yang masuk akal untuk rentang yang dipilih.
     * Daftarnya berasal dari StorePerformanceService supaya default otomatis
     * yang dipakai grafik selalu ada di dalam pilihan yang ditampilkan.
     *
     * @param  array<string, mixed>  $payload
     * @return array<int, array{value: string, label: string}>
     */
    protected function allowedGranularity(array $payload, ?string $from = null, ?string $to = null): array
    {
        $fromDate = $payload['range']['from_date_iso'] ?? $from;
        $toDate = $payload['range']['to_date_iso'] ?? $to;

        if (! $fromDate || ! $toDate) {
            return $this->performance->granularityOptions(now()->startOfDay(), now()->endOfDay());
        }

        try {
            return $this->performance->granularityOptions(
                \Carbon\Carbon::parse($fromDate)->startOfDay(),
                \Carbon\Carbon::parse($toDate)->endOfDay(),
            );
        } catch (\Throwable $e) {
            return $this->performance->granularityOptions(now()->startOfDay(), now()->endOfDay());
        }
    }
}
