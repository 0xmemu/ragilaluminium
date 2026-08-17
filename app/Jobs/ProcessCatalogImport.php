<?php

namespace App\Jobs;

use App\Imports\CatalogProductsImport;
use App\Imports\ShopeeCatalogExport;
use App\Imports\ShopeeMediaExport;
use App\Models\ImportJob;
use App\Support\CatalogTaxonomy;
use App\Support\ImportFailureNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ProcessCatalogImport implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1; // impor tidak idempoten penuh; hindari re-run ganda

    public int $uniqueFor = 1860;

    public int $timeout = 1800; // 30 menit untuk file besar

    public function __construct(public int $jobId, public string $storedPath, public string $kind = 'catalog')
    {
        $this->onQueue('imports');
    }

    public function uniqueId(): string
    {
        return $this->kind.':'.$this->jobId;
    }

    /**
     * @return list<WithoutOverlapping>
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping('catalog-import:'.$this->uniqueId()))
                ->expireAfter($this->timeout + 60)
                ->dontRelease(),
        ];
    }

    /** Dipanggil bila job gagal permanen (mis. timeout / exception tak tertangani). */
    public function failed(\Throwable $e): void
    {
        ImportJob::whereKey($this->jobId)->update([
            'status' => 'failed',
            'global_error_message' => 'Job gagal: '.$e->getMessage(),
            'completed_at' => now(),
        ]);
        ImportFailureNotifier::notify($this->jobId, "Job gagal: ".$e->getMessage());
    }

    public function handle(): void
    {
        $job = ImportJob::find($this->jobId);

        if (! $job) {
            return;
        }

        $path = Storage::disk('imports')->path($this->storedPath);

        if (! file_exists($path)) {
            $job->update([
                'status' => 'failed',
                'global_error_message' => 'Berkas sumber tidak ditemukan.',
                'completed_at' => now(),
            ]);
            ImportFailureNotifier::notify($this->jobId, "Berkas sumber tidak ditemukan.");

            throw new \RuntimeException('Berkas sumber impor tidak ditemukan.');
        }

        try {
            if ($this->kind === 'media') {
                Excel::import(new ShopeeMediaExport($this->jobId), $path);
            } else {
                $importer = $this->resolveCatalogImporter($path);
                Excel::import($importer, $path);
            }
        } catch (\Throwable $e) {
            $job->update([
                'status' => 'failed',
                'global_error_message' => $e->getMessage(),
                'completed_at' => now(),
            ]);
            ImportFailureNotifier::notify($this->jobId, $e->getMessage());

            throw $e;
        }

        $job->refresh();
        if (in_array($job->status, ['pending', 'running'])) {
            $job->update(['status' => 'completed', 'completed_at' => now()]);
        }

        CatalogTaxonomy::forgetCache();
    }

    /**
     * Pick the catalog importer based on the spreadsheet's first heading row.
     * Real Shopee exports use "et_title_*" headers and no populated SKU columns,
     * so they route to ShopeeCatalogExport. The simple dummy format routes to
     * CatalogProductsImport.
     */
    protected function resolveCatalogImporter(string $path): object
    {
        $headingRow = $this->firstHeadingRow($path);

        $isShopee = collect($headingRow)->contains(
            fn ($c) => is_string($c) && str_starts_with($c, 'et_title_')
        );

        return $isShopee
            ? new ShopeeCatalogExport($this->jobId)
            : new CatalogProductsImport($this->jobId);
    }

    protected function firstHeadingRow(string $path): array
    {
        $ss = IOFactory::load($path);
        $ws = $ss->getActiveSheet();
        $row = $ws->getRowIterator(1, 1)->current();
        $cells = [];
        foreach ($row->getCellIterator() as $cell) {
            $cells[] = $cell->getValue();
        }

        return $cells;
    }
}
