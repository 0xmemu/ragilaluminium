<?php

namespace App\Http\Controllers\Admin;

use App\Exports\MediaUpdateTemplateExport;
use App\Exports\ProductImportTemplateExport;
use App\Exports\ProductUpdateTemplateExport;
use App\Http\Controllers\Controller;
use App\Jobs\ProcessCatalogImport;
use App\Support\MediaNamer;
use App\Models\ImportJob;
use App\Services\ActivityLogService;
use App\Support\CatalogDownloadFilter;
use App\Support\ExportSafety;
use App\Support\InertiaAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ImportJobController extends Controller
{
    public static function typeLabel(string $type): string
    {
        return match ($type) {
            'catalog_import' => 'Import Produk',
            'stock_price_update' => 'Update Produk',
            'media_update' => 'Update Media',
            'shopee_mass_upload' => 'Shopee Mass Upload (historis)',
            'shopee_mass_update' => 'Shopee Mass Update (historis)',
            'internal_bulk_update' => 'Internal Bulk Update (historis)',
            default => $type,
        };
    }

    public function index(Request $request): Response
    {
        $status = trim((string) $request->input('status', 'all'));
        $type = trim((string) $request->input('type', 'all'));
        $q = trim((string) $request->input('q', ''));

        // Ringkasan Eksekutif Batch Import
        $allJobs = ImportJob::query()->get(['status', 'success_rows', 'failed_rows', 'type']);

        $totalJobs = $allJobs->count();
        $totalCompleted = $allJobs->where('status', 'completed')->count();
        $totalFailed = $allJobs->where('status', 'failed')->count();
        $totalRunning = $allJobs->whereIn('status', ['running', 'pending'])->count();
        $totalSuccessRows = (int) $allJobs->sum('success_rows');
        $totalFailedRows = (int) $allJobs->sum('failed_rows');

        $summary = [
            'total_jobs' => $totalJobs,
            'total_completed' => $totalCompleted,
            'total_failed' => $totalFailed,
            'total_running' => $totalRunning,
            'total_success_rows' => $totalSuccessRows,
            'total_failed_rows' => $totalFailedRows,
        ];

        // Tabs status import
        $tabs = [
            ['key' => 'all', 'label' => 'Semua', 'count' => $totalJobs],
            ['key' => 'completed', 'label' => 'Selesai', 'count' => $totalCompleted],
            ['key' => 'running', 'label' => 'Diproses', 'count' => $totalRunning],
            ['key' => 'failed', 'label' => 'Gagal', 'count' => $totalFailed],
        ];

        // Query tabel batch import
        $query = ImportJob::with('triggeredBy')
            ->when($status !== '' && $status !== 'all', function ($sub) use ($status) {
                if ($status === 'running') {
                    $sub->whereIn('status', ['running', 'pending']);
                } else {
                    $sub->where('status', $status);
                }
            })
            ->when($type !== '' && $type !== 'all', fn ($sub) => $sub->where('type', $type))
            ->when($q !== '', function ($sub) use ($q) {
                $sub->where(function ($nested) use ($q) {
                    $cleanId = ltrim($q, '#');
                    if (is_numeric($cleanId)) {
                        $nested->where('id', (int) $cleanId);
                    }
                    $nested->orWhere('source_file_name', 'like', "%{$q}%")
                        ->orWhereHas('triggeredBy', fn ($userSub) => $userSub->where('name', 'like', "%{$q}%"));
                });
            })
            ->latest('id');

        $paginated = $query->paginate(15)->withQueryString();

        $productCounts = \Illuminate\Support\Facades\DB::table('import_job_rows')
            ->select('import_job_id')
            ->selectRaw('COUNT(DISTINCT linked_product_id) as products')
            ->whereIn('import_job_id', $paginated->getCollection()->pluck('id'))
            ->whereNotNull('linked_product_id')
            ->groupBy('import_job_id')
            ->pluck('products', 'import_job_id');

        $mappedData = $paginated->getCollection()->map(function (ImportJob $j) use ($productCounts): array {
            return [
                'id' => $j->id,
                'type' => $j->type,
                'type_label' => self::typeLabel($j->type),
                'source_file_name' => $j->source_file_name,
                'status' => $j->status,
                'total_rows' => (int) ($j->total_rows ?? 0),
                'processed_rows' => (int) ($j->processed_rows ?? 0),
                'success_rows' => (int) ($j->success_rows ?? 0),
                'failed_rows' => (int) ($j->failed_rows ?? 0),
                'product_count' => (int) ($productCounts[$j->id] ?? 0),
                'triggered_by' => $j->triggeredBy?->name ?? 'System',
                'started_at' => optional($j->started_at)?->toIso8601String(),
                'completed_at' => optional($j->completed_at)?->toIso8601String(),
                'created_at' => optional($j->created_at)?->toIso8601String() ?? now()->toIso8601String(),
                'href' => route('admin.imports.show', $j),
                'failed_rows_href' => ((int) ($j->failed_rows ?? 0) > 0) ? route('admin.imports.failed-rows', $j) : null,
            ];
        });

        return Inertia::render('Admin/Imports/Index', [
            'title' => 'Import',
            'description' => 'Riwayat proses import katalog, pembaruan harga & stok masal, serta penambahan media produk.',
            'summary' => $summary,
            'tabs' => $tabs,
            'activeStatus' => $status,
            'activeType' => $type,
            'searchQuery' => $q,
            'createHref' => route('admin.imports.create'),
            'jobs' => [
                'data' => $mappedData->all(),
                'links' => $paginated->linkCollection()->toArray(),
                'from' => $paginated->firstItem(),
                'to' => $paginated->lastItem(),
                'total' => $paginated->total(),
                'per_page' => $paginated->perPage(),
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/ImportCreate', [
            'backUrl' => route('admin.imports.index'),
            'submitUrl' => route('admin.imports.store'),
            'previewUrl' => route('admin.imports.preview-catalog'),
            'previewUpdateUrl' => route('admin.imports.preview-update'),
            'csrf' => csrf_token(),
            'productImportTemplateUrl' => route('admin.imports.product-import-template'),
            'stockPriceTemplateUrl' => route('admin.imports.stock-price-template'),
            'mediaUpdateTemplateUrl' => route('admin.imports.media-update-template'),
            // Pilihan filter unduhan. Endpoint update menerima parameter ini
            // sehingga admin dapat mengunduh hanya bagian yang dibutuhkan.
            'downloadFilters' => [
                'kategori' => self::distinctProductValues('product_category'),
                'model' => self::distinctProductValues('product_model'),
                'sub_model' => self::distinctProductValues('design_variant'),
            ],
            // Label mengikuti nama template v2 supaya admin melihat sebutan yang
            // sama di tombol unduh dan di pilihan tipe.
            'types' => [
                ['value' => 'catalog_import', 'label' => 'Import Produk (produk dan varian baru)'],
                ['value' => 'stock_price_update', 'label' => 'Update Produk (harga, stok, deskripsi, spesifikasi)'],
                ['value' => 'media_update', 'label' => 'Update Media (foto produk dan varian)'],
            ],
        ]);
    }

    /**
     * Nilai unik sebuah kolom produk untuk pilihan filter unduhan.
     *
     * Dibaca dari database, bukan daftar tetap, supaya kategori, model, atau
     * sub model baru langsung muncul di pilihan tanpa mengubah kode.
     *
     * @return list<string>
     */
    private static function distinctProductValues(string $column): array
    {
        return \App\Models\Product::query()
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->map(static fn ($v): string => (string) $v)
            ->values()
            ->all();
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'in:catalog_import,stock_price_update,media_update'],
            'file' => ['required', 'file', 'mimes:xls,xlsx,xlsm,csv', 'max:51200'],
        ]);

        $file = $request->file('file');

        $rowData = \Maatwebsite\Excel\Facades\Excel::toArray(new \App\Imports\InternalCatalogPreviewImport(), $file);
        $rows = $rowData[0] ?? [];
        // Skema dua-sheet (template baru): baris produk = punya option_1 atau
        // name/parent_sku. Skema lama: cukup name/parent_sku.
        // Hitungan baris harus mengikuti format berkas. Format v2 memakai
        // nama_produk/opsi_variasi_1, format lama memakai
        // name/parent_sku/option_1. Memakai kolom lama membuat berkas v2
        // tercatat 0 baris sehingga progres job tidak pernah benar.
        $isV2 = \App\Support\CatalogTemplateV2Detector::isV2($rows);

        $rowCount = count(array_filter($rows, function ($r) use ($isV2): bool {
            if ($isV2) {
                return trim((string) ($r["nama_produk"] ?? "")) !== ""
                    || trim((string) ($r["opsi_variasi_1"] ?? "")) !== "";
            }

            return trim((string) ($r["name"] ?? "")) !== ""
                || trim((string) ($r["parent_sku"] ?? "")) !== ""
                || trim((string) ($r["option_1"] ?? "")) !== "";
        }));
        // Batas baris dinaikkan untuk katalog besar: 10.000 produk x 4 varian
        // = 40.000 baris. Proses tetap chunk 1.000 baris + job background.
        $rowLimit = 50000;
        if ($rowCount > $rowLimit) {
            return redirect()->back()->withErrors([
                'file' => 'Jumlah baris ('.$rowCount.') melebihi batas maksimal ('.$rowLimit.').',
            ]);
        }

        $fileName = $file->getClientOriginalName();
        $name = MediaNamer::onDisk('import', $file->getClientOriginalExtension() ?: 'xlsx', 'imports', 'catalog');
        $storedPath = $file->storeAs('catalog', $name, 'imports');

        $job = ImportJob::create([
            'type' => $validated['type'],
            'source_file_name' => $fileName,
            'source_file_path' => $storedPath,
            'total_rows' => $rowCount,
            // Stok SELALU dari berkas. Pilihan mode manual dihapus dari UI
            // karena template sudah menyediakan kolom stok, dan dua jalur stok
            // hanya menambah kebingungan tanpa manfaat.
            'stock_mode' => 'file',
            'manual_stock' => null,
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

        $totalProducts = (int) (\Illuminate\Support\Facades\Cache::get("import_total_products_{$import_job->id}")
            ?? $import_job->rows()->whereNotNull('linked_product_id')->distinct('linked_product_id')->count('linked_product_id'));

        $processedProducts = $import_job->status === 'completed'
            ? $totalProducts
            : (int) (\Illuminate\Support\Facades\Cache::get("import_processed_products_{$import_job->id}") ?? 0);

        $successProducts = $import_job->status === 'completed'
            ? ($totalProducts ?: $import_job->rows()->whereNotNull('linked_product_id')->distinct('linked_product_id')->count('linked_product_id'))
            : (int) (\Illuminate\Support\Facades\Cache::get("import_processed_products_{$import_job->id}") ?? 0);

        return Inertia::render('Admin/ImportShow', [
            'importJob' => [
                'id' => $import_job->id,
                'type' => static::typeLabel($import_job->type),
                'file' => $import_job->source_file_name,
                'status' => $import_job->status,
                // Import BARU selalu membaca stok dari berkas karena pilihan
                // mode manual sudah dihapus dari UI. Job LAMA yang terlanjur
                // memakai mode manual tetap ditampilkan apa adanya supaya
                // riwayat tidak berbohong.
                'stock_source' => $import_job->stock_mode === 'manual'
                    ? 'Manual ('.$import_job->manual_stock.')'
                    : 'Dari berkas',
                'total_products' => $totalProducts,
                'processed_products' => $processedProducts,
                'success_products' => $successProducts,
                'total_rows' => (int) $import_job->total_rows,
                'processed_rows' => (static function () use ($import_job): int {
                    $cached = \Illuminate\Support\Facades\Cache::get("import_progress_{$import_job->id}");
                    return ($import_job->status === 'completed' || $cached === null)
                        ? (int) $import_job->processed_rows
                        : (int) $cached;
                })(),
                'success_rows' => (int) $import_job->success_rows,
                'failed_rows' => (int) $import_job->failed_rows,
                'started_at' => optional($import_job->started_at)?->toDateTimeString(),
                'completed_at' => optional($import_job->completed_at)?->toDateTimeString(),
                'error_message' => $import_job->global_error_message,
                'rows' => $import_job->rows->map(fn ($r) => [
                    'row_number' => (int) $r->row_number,
                    'status' => $r->status,
                    'reason' => (string) ($r->error_reason
                        ?? (($r->raw_data['_activation_status'] ?? null) === 'archived'
                            ? 'Diarsipkan: '.implode(', ', (array) ($r->raw_data['_activation_reasons'] ?? []))
                            : '-')),
                ])->values()->all(),

                // Produk yang tersimpan sebagai arsip beserta alasan spesifiknya
                // (kelengkapan bisnis): nama, SKU, baris, dan daftar kekurangan.
                'incomplete_products' => (static function () use ($import_job): array {
                    $byProduct = [];
                    foreach ($import_job->rows as $r) {
                        $raw = is_string($r->raw_data) ? json_decode($r->raw_data, true) : (array) $r->raw_data;
                        $reasons = $raw['_activation_reasons'] ?? null;
                        if ($reasons === null || $reasons === []) { continue; }
                        $pid = $r->linked_product_id;
                        if (! $pid) { continue; }
                        if (! isset($byProduct[$pid])) {
                            $p = \App\Models\Product::find($pid);
                            $byProduct[$pid] = [
                                'product_id' => $pid,
                                'name' => $p?->name ?? '(produk terhapus)',
                                'sku' => $p?->parent_sku ?? '-',
                                'edit_url' => $p ? route('admin.products.edit', $p) : null,
                                'rows' => [],
                                'reasons' => [],
                            ];
                        }
                        $byProduct[$pid]['rows'][] = $r->row_number;
                        foreach ((array) $reasons as $reason) {
                            if (! in_array($reason, $byProduct[$pid]['reasons'], true)) {
                                $byProduct[$pid]['reasons'][] = $reason;
                            }
                        }
                    }
                    return array_values($byProduct);
                })(),
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

    public function downloadCorrectionFile(ImportJob $import_job): BinaryFileResponse
    {
        $failedQuery = $import_job->failedRows();
        ExportSafety::assertQueryWithinLimit($failedQuery);
        $failed = $failedQuery->get();

        return Excel::download(new \App\Exports\CorrectionFileExport($failed), 'correction-'.$import_job->id.'.xlsx');
    }

    /**
     * Preview ringan untuk Import Katalog: klaim klasifikasi URL gambar per
     * baris (internal = aset media sendiri yang siap pakai, eksternal = akan
     * diunduh saat import, tidak valid = tidak bisa diproses). Read-only.
     */
    public function previewCatalog(Request $request)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:xls,xlsx,xlsm,csv', 'max:51200'],
        ]);
        $file = $request->file('file');

        $allRows = \Maatwebsite\Excel\Facades\Excel::toArray(
            new \App\Imports\InternalCatalogPreviewImport(),
            $file
        )[0] ?? [];
        $totalRawRows = count($allRows);

        // Format v2 memakai jalur preview sendiri: kolomnya berbeda seluruhnya
        // (header Bahasa Indonesia, satu baris satu varian).
        if (\App\Support\CatalogTemplateV2Detector::isV2($allRows)) {
            return $this->previewCatalogV2($allRows);
        }

        $totalRawProducts = collect($allRows)->map(function ($r) {
            $name = trim((string) ($r['name'] ?? ''));
            $idKey = trim((string) ($r['id_key'] ?? ''));
            $parentSku = trim((string) ($r['parent_sku'] ?? ''));
            return $idKey !== '' ? 'id_key:'.$idKey : ($name !== '' ? 'name:'.$name : ($parentSku !== '' ? 'sku:'.$parentSku : null));
        })->filter()->unique()->count();
        $rows = array_slice($allRows, 0, 1000);

        // Skema baru: gabungkan gambar per opsi dari sheet Varian (jika ada).
        $variantImages = [];
        try {
            $variantSheet = \App\Support\VariantSheetParser::extractVariantRows($file->getRealPath());
            if ($variantSheet !== null) {
                $parsed = \App\Support\VariantSheetParser::parse($variantSheet['rows']);
                $variantImages = \App\Support\VariantSheetParser::optionImageMap($parsed['variants'])['images'];
            }
        } catch (\Throwable) {
            $variantImages = [];
        }

        $resolver = app(\App\Services\MediaAssetResolver::class);
        $diffs = [];
        $lastSeenName = '';
        $mediaUrlCache = [];
        foreach ($rows as $index => $row) {
            $rowName = trim((string) ($row['name'] ?? ''));
            $hasOptions = trim((string) ($row['option_1'] ?? '')) !== '';
            if ($rowName === '' && trim((string) ($row['parent_sku'] ?? '')) === '' && ! $hasOptions) {
                continue;
            }
            if ($rowName === '' && $hasOptions && $lastSeenName !== '') {
                $rowName = $lastSeenName; // baris lanjutan: identitas diwarisi
            }
            if ($rowName !== '') {
                $lastSeenName = $rowName;
            }

            $imageUrls = [];
            foreach (range(1, 9) as $n) {
                $u = trim((string) ($row['image_'.$n] ?? ''));
                if ($u !== '') {
                    $imageUrls[] = $u;
                }
            }
            // Skema baru: gambar per opsi dari sheet Varian, diurut sesuai opsi baris.
            if ($imageUrls === [] && $variantImages !== []) {
                for ($n = 1; $n <= 5; $n++) {
                    $opt = trim((string) ($row['option_'.$n] ?? ''));
                    if ($opt === '') {
                        continue;
                    }
                    $u = $variantImages[\App\Support\VariantSheetParser::optionKey($opt)] ?? null;
                    if ($u !== null) {
                        $imageUrls[] = $u;
                    }
                }
            }

            $mediaStats = ['internal' => 0, 'external' => 0, 'invalid' => 0];
            $mediaDetail = [];
            foreach ($imageUrls as $u) {
                if (isset($mediaUrlCache[$u])) {
                    $cls = $mediaUrlCache[$u];
                    $mediaStats[$cls]++;
                    $mediaDetail[] = ['url' => $u, 'class' => $cls];
                    continue;
                }

                $objKey = null;
                try {
                    $objKey = $resolver->internalObjectKeyPublic($u);
                } catch (\Throwable) {
                    $objKey = null;
                }
                if ($objKey !== null) {
                    $cls = 'internal';
                    $mediaStats['internal']++;
                } else {
                    $valid = filter_var($u, FILTER_VALIDATE_URL) && (bool) parse_url($u, PHP_URL_HOST);
                    $cls = $valid ? 'external' : 'invalid';
                    $mediaStats[$cls]++;
                }
                $mediaUrlCache[$u] = $cls;
                $mediaDetail[] = ['url' => $u, 'class' => $cls];
            }

            $diffs[] = [
                'row' => $index + 2,
                'name' => trim((string) ($row['name'] ?? '')),
                'parent_sku' => trim((string) ($row['parent_sku'] ?? '')),
                'price' => $row['price'] ?? null,
                'stock' => $row['stock'] ?? null,
                'media' => $mediaDetail,
                'media_stats' => $mediaStats,
            ];
        }

        // VERIFIKASI PRE-PASS: laporkan pelanggaran tanpa menulis apa pun.
        $verify = \App\Support\CatalogImportVerifier::verify($rows);

        return response()->json([
            'contract' => 'preview-only; tidak menulis data',
            'verify_errors' => $verify,
            'rows' => $diffs,
            'total' => $totalRawRows,
            'total_products' => $totalRawProducts,
        ]);
    }

    /** Template Import Produk v2: produk dan varian baru. */
    public function downloadProductImportTemplate(): BinaryFileResponse
    {
        return Excel::download(new ProductImportTemplateExport(), 'template-import-produk.xlsx');
    }

    /**
     * Template Update Produk v2: harga, stok, deskripsi, spesifikasi.
     *
     * Menerima filter yang sama dengan menu import, sehingga admin dapat
     * mengunduh hanya bagian yang dia butuhkan (mis. satu model produk).
     */
    public function downloadStockPriceTemplate(Request $request): BinaryFileResponse
    {
        $filter = CatalogDownloadFilter::fromRequest($request->query());

        return Excel::download(
            new ProductUpdateTemplateExport($filter),
            $this->downloadFileName('update-produk', $filter)
        );
    }

    /** Template Update Media v2: foto produk dan varian. */
    public function downloadMediaUpdateTemplate(Request $request): BinaryFileResponse
    {
        $filter = CatalogDownloadFilter::fromRequest($request->query());

        return Excel::download(
            new MediaUpdateTemplateExport($filter),
            $this->downloadFileName('update-media', $filter)
        );
    }

    /**
     * Nama berkas unduhan memuat penanda filter supaya admin yang mengunduh
     * beberapa bagian sekaligus tidak menimpa berkas satu sama lain.
     */
    private function downloadFileName(string $jenis, CatalogDownloadFilter $filter): string
    {
        $suffix = $filter->fileSuffix();

        return 'template-'.$jenis.($suffix !== '' ? '-'.$suffix : '').'.xlsx';
    }
    /**
     * Preview ringan format v2: klasifikasi URL media dan validasi aturan.
     *
     * Read-only, tidak menulis apa pun. Aturannya sama persis dengan verifier
     * yang dipakai importer, sehingga hasil Periksa file mencerminkan apa yang
     * akan terjadi saat import.
     */
    protected function previewCatalogV2(array $allRows)
    {
        $errors = \App\Support\CatalogImportVerifierV2::verify($allRows);

        // Baris template yang masih kosong (200 baris siap isi dengan dropdown)
        // TIDAK dihitung sebagai baris data. Memakai count($allRows) membuat
        // total selalu 199-200 walau admin hanya mengisi satu baris, dan itu
        // menyesatkan saat memeriksa berkas.
        $terisi = array_values(array_filter($allRows, static function ($row): bool {
            return trim((string) ($row["nama_produk"] ?? "")) !== ""
                || trim((string) ($row["opsi_variasi_1"] ?? "")) !== "";
        }));

        $rows = array_slice($terisi, 0, 1000);

        $resolver = app(\App\Services\MediaAssetResolver::class);
        $cache = [];
        $diffs = [];
        $lastName = '';

        foreach ($rows as $row) {
            $name = trim((string) ($row['nama_produk'] ?? ''));
            if ($name === '') {
                $name = $lastName;
            }
            if ($name !== '') {
                $lastName = $name;
            }

            $urls = [];
            foreach ([
                'gambar_per_varian', 'gambar_1_utama', 'gambar_2',
                'media_bersama_1', 'media_bersama_2',
                'gambar_hasil_pemasangan_1', 'gambar_hasil_pemasangan_2',
            ] as $key) {
                $url = trim((string) ($row[$key] ?? ''));
                if ($url !== '') {
                    $urls[] = $url;
                }
            }

            $stats = ['internal' => 0, 'external' => 0, 'invalid' => 0];
            $media = [];
            foreach ($urls as $url) {
                if (! isset($cache[$url])) {
                    $objectKey = null;
                    try {
                        $objectKey = $resolver->internalObjectKeyPublic($url);
                    } catch (\Throwable) {
                        $objectKey = null;
                    }
                    if ($objectKey !== null) {
                        $cache[$url] = 'internal';
                    } else {
                        $valid = filter_var($url, FILTER_VALIDATE_URL) && (bool) parse_url($url, PHP_URL_HOST);
                        $cache[$url] = $valid ? 'external' : 'invalid';
                    }
                }
                $stats[$cache[$url]]++;
                $media[] = ['url' => $url, 'class' => $cache[$url]];
            }

            $diffs[] = [
                'row' => count($diffs) + 2,
                'name' => $name,
                'parent_sku' => '',
                'price' => $row['harga'] ?? null,
                'stock' => $row['stok'] ?? null,
                'media' => $media,
                'media_stats' => $stats,
            ];
        }

        $totalProducts = collect($allRows)
            ->map(fn ($r) => trim((string) ($r['no_id'] ?? '')) ?: trim((string) ($r['nama_produk'] ?? '')))
            ->filter()
            ->unique()
            ->count();

        // BENTUK RESPONS WAJIB SAMA dengan preview format lain.
        // Frontend membaca verify_errors dan total; mengirim kunci lain
        // (errors, ok, total_rows) membuat halaman gagal merender setelah
        // server menjawab 200, sehingga admin melihat layar gangguan
        // sementara padahal server sukses.
        return response()->json([
            'contract' => 'preview-only; tidak menulis data',
            'template' => 'v2',
            'verify_errors' => array_slice($errors, 0, 20),
            'rows' => $diffs,
            'total' => count($terisi),
            'total_products' => $totalProducts,
        ]);
    }

    public function previewInternal(Request $request)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:xls,xlsx,xlsm,csv', 'max:51200'],
        ]);
        $rows = \Maatwebsite\Excel\Facades\Excel::toArray(
            new \App\Imports\InternalCatalogPreviewImport(),
            $validated['file']
        )[0] ?? [];
        $rows = array_slice($rows, 0, 1000);
        $diffs = [];

        foreach ($rows as $index => $row) {
            $parentSku = trim((string) ($row['parent_sku'] ?? ''));
            $variantSku = trim((string) ($row['variant_sku'] ?? ''));
            $variant = $variantSku !== ''
                ? \App\Models\ProductVariant::with('product')->where('variant_sku', $variantSku)->first()
                : null;
            if (! $variant || $variant->product->parent_sku !== $parentSku) {
                $diffs[] = ['row' => $index + 2, 'status' => 'error', 'message' => 'parent_sku/variant_sku tidak ditemukan atau tidak cocok'];
                continue;
            }

            $changes = [];
            $fields = [
                'name' => $variant->product->name,
                'description' => $variant->product->description,
                'variation_1_name' => $variant->variation_1_name,
                'variation_1_option' => $variant->variation_1_option,
                'variation_2_name' => $variant->variation_2_name,
                'variation_2_option' => $variant->variation_2_option,
                'price' => $variant->price,
                'stock' => $variant->stock,
                'weight_kg' => $variant->weight_kg,
                'height_cm' => $variant->height_cm,
                'width_cm' => $variant->width_cm,
                'depth_cm' => $variant->depth_cm,
                'status' => $variant->status,
            ];
            foreach ($fields as $field => $before) {
                if (! array_key_exists($field, $row) || $row[$field] === '' || (string) $row[$field] === (string) $before) {
                    continue;
                }
                $changes[$field] = ['before' => $before, 'after' => $row[$field]];
            }
            $diffs[] = [
                'row' => $index + 2,
                'status' => 'changed',
                'parent_sku' => $parentSku,
                'variant_sku' => $variantSku,
                'changes' => $changes,
            ];
        }

        return response()->json([
            'contract' => 'preview-only; tidak menulis data',
            'rows' => $diffs,
            'total' => count($rows),
        ]);
    }


    /**
     * Preview (Periksa file) utk stock_price_update & media_update:
     * verifikasi pre-pass (SKU unknown, duplikat, nilai invalid) +
     * ringkasan baris. All-or-nothing: errors > 0 = import ditolak UI.
     */
    public function previewUpdate(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:stock_price_update,media_update'],
            'file' => ['required', 'file', 'mimes:xls,xlsx,xlsm,csv', 'max:51200'],
        ]);

        $rows = \Maatwebsite\Excel\Facades\Excel::toArray(
            new \App\Imports\InternalCatalogPreviewImport(),
            $validated['file']
        )[0] ?? [];
        $rows = array_slice($rows, 0, 2000);

        // Stok selalu dari berkas, sehingga tidak ada stok manual yang perlu
        // dioper ke verifier.
        $result = \App\Support\UpdateImportVerifier::verify(
            $rows,
            $validated['type'],
            null
        );

        // Diff nyata per baris (owner 09-06): tampilkan apa yang AKAN berubah
        // sebelum admin menekan Mulai Import. Tidak ada penulisan data di sini.
        $changes = \App\Support\UpdatePreviewDiff::compute(
            $rows,
            $validated['type'],
            $manualStock
        );

        return response()->json([
            'contract' => 'preview-only; tidak menulis data',
            'verify_errors' => $result['errors'],
            'skipped_rows' => $result['skipped'],
            'total' => count($rows),
            'changes' => $changes['changes'],
            'changed_rows' => $changes['changed_rows'],
            'unchanged_rows' => $changes['unchanged_rows'],
        ]);
    }
}
