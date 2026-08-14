<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessCatalogImport;
use App\Support\MediaNamer;
use App\Models\ImportJob;
use App\Services\ActivityLogService;
use App\Support\ExportSafety;
use App\Support\InertiaAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportJobController extends Controller
{
    public function index(Request $request): Response
    {
        $jobs = ImportJob::with('triggeredBy')
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->type))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/ResourceIndex', [
            'title' => 'Import',
            'description' => 'Bulk update katalog (Shopee/internal). Bagian dari menu Produk.',
            'createHref' => route('admin.imports.create'),
            'toolbarLinks' => [
                [
                    'label' => 'Performa Import',
                    'href' => route('admin.analytics.import-performance'),
                ],
            ],
            'columns' => [
                ['key' => 'id', 'label' => 'ID', 'hrefKey' => 'href'],
                ['key' => 'type', 'label' => 'Tipe'],
                ['key' => 'source_file_name', 'label' => 'File'],
                ['key' => 'status', 'label' => 'Status'],
                ['key' => 'rows_summary', 'label' => 'Baris'],
                ['key' => 'triggered_by', 'label' => 'Oleh'],
            ],
            'rows' => $jobs->getCollection()->map(function (ImportJob $j) {
                $actions = [
                    [
                        'label' => 'Detail',
                        'method' => 'get',
                        'href' => route('admin.imports.show', $j),
                    ],
                ];
                if ((int) ($j->failed_rows ?? 0) > 0) {
                    $actions[] = [
                        'label' => 'Baris gagal',
                        'method' => 'get',
                        'href' => route('admin.imports.failed-rows', $j),
                    ];
                }
                if (in_array($j->status, ['failed', 'completed', 'pending'], true)) {
                    $actions[] = [
                        'label' => 'Jalankan ulang',
                        'method' => 'post',
                        'url' => route('admin.imports.retry', $j),
                        'confirm' => 'Jalankan ulang import #'.$j->id.'?',
                    ];
                }

                return [
                    'id' => $j->id,
                    'type' => $j->type,
                    'source_file_name' => $j->source_file_name,
                    'status' => $j->status,
                    'rows_summary' => ($j->success_rows ?? 0).' ok / '.($j->failed_rows ?? 0).' gagal',
                    'triggered_by' => $j->triggeredBy?->name ?? '-',
                    'href' => route('admin.imports.show', $j),
                    'actions' => $actions,
                ];
            })->all(),
            'pagination' => InertiaAdmin::pagination($jobs),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/ImportCreate', [
            'submitUrl' => route('admin.imports.store'),
            'types' => [
                ['value' => 'shopee_mass_upload', 'label' => 'Shopee Mass Upload'],
                ['value' => 'shopee_mass_update', 'label' => 'Shopee Mass Update'],
                ['value' => 'internal_bulk_update', 'label' => 'Internal Bulk Update'],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'in:shopee_mass_upload,shopee_mass_update,internal_bulk_update'],
            'file' => ['required', 'file', 'mimes:xls,xlsx,xlsm,csv', 'max:51200'],
            'stock_mode' => ['required', 'in:file,manual'],
            'manual_stock' => ['nullable', 'required_if:stock_mode,manual', 'integer', 'min:0'],
        ]);

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $name = MediaNamer::onDisk('import', $file->getClientOriginalExtension() ?: 'xlsx', 'imports', 'catalog');
        $storedPath = $file->storeAs('catalog', $name, 'imports');

        $job = ImportJob::create([
            'type' => $validated['type'],
            'source_file_name' => $fileName,
            'source_file_path' => $storedPath,
            'stock_mode' => $validated['stock_mode'],
            'manual_stock' => $validated['stock_mode'] === 'manual'
                ? (int) $validated['manual_stock']
                : null,
            'status' => 'pending',
            'triggered_by_user_id' => $request->user()->id,
        ]);

        ProcessCatalogImport::dispatch($job->id, $storedPath);

        ActivityLogService::record(
            'import.started',
            'import_job',
            (int) $job->id,
            [
                'type' => $job->type,
                'file' => $fileName,
            ],
            (int) $request->user()->id,
        );

        return redirect()->route('admin.imports.show', $job)
            ->with('success', 'Import dimulai, sedang diproses di antrean.');
    }

    public function show(ImportJob $import_job): Response
    {
        $import_job->load(['rows' => fn ($q) => $q->latest()->limit(50)]);

        return Inertia::render('Admin/ResourceShow', [
            'title' => 'Import #'.$import_job->id,
            'subtitle' => $import_job->source_file_name,
            'fields' => [
                ['label' => 'Tipe', 'value' => $import_job->type],
                ['label' => 'File', 'value' => $import_job->source_file_name],
                ['label' => 'Sumber Stok', 'value' => $import_job->stock_mode === 'manual'
                    ? 'Manual ('.$import_job->manual_stock.')'
                    : 'Dari file'],
                ['label' => 'Status', 'value' => $import_job->status],
                ['label' => 'Berhasil', 'value' => $import_job->success_rows],
                ['label' => 'Gagal', 'value' => $import_job->failed_rows],
                ['label' => 'Total Baris', 'value' => $import_job->total_rows],
                ['label' => 'Dimulai', 'value' => optional($import_job->started_at)?->toDateTimeString()],
                ['label' => 'Selesai', 'value' => optional($import_job->completed_at)?->toDateTimeString()],
            ],
            'sections' => [
                [
                    'title' => 'Baris Terakhir',
                    'rows' => $import_job->rows->map(fn ($r) => [
                        'label' => 'Row '.$r->row_number.' · '.$r->status,
                        'value' => (string) ($r->error_reason ?? '-'),
                    ])->values()->all(),
                ],
            ],
        ]);
    }

    public function failedRows(ImportJob $import_job): Response
    {
        $rows = $import_job->failedRows()->latest()->paginate(50);

        return Inertia::render('Admin/ResourceIndex', [
            'title' => 'Baris Gagal · Import #'.$import_job->id,
            'createHref' => null,
            'columns' => [
                ['key' => 'row_number', 'label' => 'Row'],
                ['key' => 'status', 'label' => 'Status'],
                ['key' => 'error_reason', 'label' => 'Error'],
            ],
            'rows' => $rows->getCollection()->map(fn ($r) => [
                'row_number' => $r->row_number,
                'status' => $r->status,
                'error_reason' => $r->error_reason,
            ])->all(),
            'pagination' => InertiaAdmin::pagination($rows),
        ]);
    }

    public function downloadCorrectionFile(ImportJob $import_job): StreamedResponse
    {
        $failedQuery = $import_job->failedRows();
        ExportSafety::assertQueryWithinLimit($failedQuery);
        $failed = $failedQuery->get();

        return Excel::download(new \App\Exports\CorrectionFileExport($failed), 'correction-'.$import_job->id.'.xlsx');
    }

    public function retry(ImportJob $import_job): RedirectResponse
    {
        if ($import_job->source_file_path && Storage::disk('imports')->exists($import_job->source_file_path)) {
            $import_job->update(['status' => 'pending', 'started_at' => null, 'completed_at' => null]);
            ProcessCatalogImport::dispatch($import_job->id, $import_job->source_file_path);

            ActivityLogService::record(
                'import.retried',
                'import_job',
                (int) $import_job->id,
                ['type' => $import_job->type],
                (int) request()->user()?->id,
            );

            return redirect()->route('admin.imports.show', $import_job)
                ->with('success', 'Import dijalankan ulang.');
        }

        return redirect()->back()->withErrors('Berkas sumber tidak ditemukan, tidak bisa menjalankan ulang.');
    }
}
