<?php

namespace App\Console\Commands;

use App\Imports\ShopeeCatalogExport;
use App\Imports\ShopeeMediaExport;
use App\Jobs\ProcessCatalogImport;
use App\Models\ImportJob;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;

class ImportShopeeCatalog extends Command
{
    protected $signature = 'catalog:import-shopee
        {--sync : Run imports synchronously instead of dispatching to the queue}';

    protected $description = 'Import all Shopee XLSX exports from xlsx/ into the catalog (products, variants, media).';

    public function handle(): int
    {
        $xlsxDir = base_path('xlsx');
        if (! is_dir($xlsxDir)) {
            $this->error("Folder xlsx/ tidak ditemukan di root project.");

            return self::FAILURE;
        }

        $variationFiles = [];
        $mediaFile = null;

        foreach (File::files($xlsxDir) as $file) {
            if (strtolower($file->getExtension()) !== 'xlsx') {
                continue;
            }
            $name = $file->getFilename();
            if (str_starts_with($name, 'mass_update_media_info') || str_contains($name, 'media_info')) {
                $mediaFile = $file;

                continue;
            }
            if (str_starts_with($name, 'template_master')) {
                $this->info("Lewati $name (template header-only).");

                continue;
            }
            if (str_starts_with($name, 'shopee nama full')) {
                $this->info("Lewati $name (redundan dengan 1-9, tidak ada product_id baru).");

                continue;
            }
            $variationFiles[] = $file;
        }

        if (empty($variationFiles)) {
            $this->warn('Tidak ada file variasi ditemukan di xlsx/.');
        }

        // 1) Variation exports -> products + variants
        sort($variationFiles);
        foreach ($variationFiles as $file) {
            $this->runCatalogFile($file);
        }

        // 2) Media export -> product_media (needs products to exist first)
        if ($mediaFile) {
            $this->runMediaFile($mediaFile);
        } else {
            $this->warn('Tidak ada file media (mass_update_media_info) ditemukan di xlsx/.');
        }

        $this->info('Selesai. Cek tabel products / product_variants / product_media.');

        return self::SUCCESS;
    }

    protected function runCatalogFile(\SplFileInfo $file): void
    {
        $this->info("Import katalog: {$file->getFilename()}");
        $storedPath = $this->stageFile($file);
        $job = ImportJob::create([
            'type' => 'shopee_mass_upload',
            'source_file_name' => $file->getFilename(),
            'source_file_path' => $storedPath,
            'status' => 'pending',
        ]);

        if ($this->option('sync')) {
            Excel::import(new ShopeeCatalogExport($job->id), Storage::disk('imports')->path($storedPath));
            $job->refresh();
            if (in_array($job->status, ['pending', 'running'])) {
                $job->update(['status' => 'completed', 'completed_at' => now()]);
            }
        } else {
            ProcessCatalogImport::dispatch($job->id, $storedPath, 'catalog');
        }

        $job->refresh();
        $this->line("  -> job #{$job->id} status={$job->status} success={$job->success_rows} failed={$job->failed_rows}");
    }

    protected function runMediaFile(\SplFileInfo $file): void
    {
        $this->info("Import media: {$file->getFilename()}");
        $storedPath = $this->stageFile($file);
        $job = ImportJob::create([
            'type' => 'shopee_mass_upload',
            'source_file_name' => $file->getFilename(),
            'source_file_path' => $storedPath,
            'status' => 'pending',
        ]);

        if ($this->option('sync')) {
            Excel::import(new ShopeeMediaExport($job->id), Storage::disk('imports')->path($storedPath));
            $job->refresh();
            if (in_array($job->status, ['pending', 'running'])) {
                $job->update(['status' => 'completed', 'completed_at' => now()]);
            }
        } else {
            ProcessCatalogImport::dispatch($job->id, $storedPath, 'media');
        }

        $job->refresh();
        $this->line("  -> job #{$job->id} status={$job->status} success={$job->success_rows} failed={$job->failed_rows}");
    }

    protected function stageFile(\SplFileInfo $file): string
    {
        $targetDir = 'catalog';
        $storedName = date('Y-m-d-').uniqid().'-'.$file->getFilename();
        Storage::disk('imports')->putFileAs($targetDir, $file->getPathname(), $storedName);

        return $targetDir.'/'.$storedName;
    }
}
