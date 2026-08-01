<?php

namespace App\Console\Commands;

use App\Imports\ShopeeMediaExport;
use App\Jobs\DownloadProductMedia;
use App\Models\ImportJob;
use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Re-sync product_media covers from a Shopee mass_update_media_info XLSX.
 * Fixes storefront cards that still show stale/wrong Shopee URLs as main image.
 */
class ResyncShopeeMedia extends Command
{
    protected $signature = 'catalog:resync-shopee-media
        {path? : Path to mass_update_media_info.xlsx (absolute or under storage/app/imports)}
        {--download : Download pending/failed mains inline after sync}
        {--limit=0 : Max products to download inline (0 = all pending mains touched)}';

    protected $description = 'Sync catalog product covers from Shopee mass_update_media_info.xlsx';

    public function handle(): int
    {
        $path = $this->resolvePath($this->argument('path'));
        if ($path === null) {
            $this->error('File media tidak ditemukan. Berikan path ke mass_update_media_info.xlsx');

            return self::FAILURE;
        }

        $this->info('Sync media dari: '.$path);

        $relative = $this->storeImportCopy($path);

        $job = ImportJob::create([
            'type' => 'shopee_mass_update',
            'source_file_name' => basename($path),
            'source_file_path' => $relative,
            'stock_mode' => 'file',
            'status' => 'pending',
            'processed_rows' => 0,
            'success_rows' => 0,
            'failed_rows' => 0,
        ]);

        Excel::import(new ShopeeMediaExport($job->id), $path);

        $job->refresh();
        if (in_array($job->status, ['pending', 'running'], true)) {
            $job->update(['status' => 'completed', 'completed_at' => now()]);
        }

        $this->info("Job #{$job->id}: success={$job->success_rows} failed={$job->failed_rows}");

        if ($this->option('download')) {
            $this->downloadPendingMains((int) $this->option('limit'));
        }

        return self::SUCCESS;
    }

    protected function resolvePath(?string $path): ?string
    {
        if (is_string($path) && $path !== '' && is_file($path)) {
            return $path;
        }

        if (is_string($path) && $path !== '') {
            $candidates = [
                storage_path('app/imports/'.$path),
                storage_path('app/imports/catalog/'.$path),
                base_path($path),
            ];
            foreach ($candidates as $candidate) {
                if (is_file($candidate)) {
                    return $candidate;
                }
            }
        }

        $defaults = glob(storage_path('app/imports/catalog/*mass_update_media_info*.xlsx')) ?: [];
        if ($defaults === []) {
            $defaults = glob(storage_path('app/imports/*mass_update_media_info*.xlsx')) ?: [];
        }
        if ($defaults === []) {
            $defaults = glob(base_path('xlsx/*mass_update_media_info*.xlsx')) ?: [];
        }

        rsort($defaults);

        return $defaults[0] ?? null;
    }

    protected function storeImportCopy(string $absolutePath): string
    {
        $relative = 'catalog/resync-'.now()->format('YmdHis').'-'.basename($absolutePath);
        if (! Storage::disk('imports')->exists($relative)) {
            Storage::disk('imports')->put($relative, file_get_contents($absolutePath));
        }

        return $relative;
    }

    protected function downloadPendingMains(int $limit): void
    {
        $query = ProductMedia::query()
            ->where('is_main_image', true)
            ->whereIn('status', ['pending', 'failed'])
            ->whereNotNull('source_url')
            ->orderBy('id');

        if ($limit > 0) {
            $query->limit($limit);
        }

        $ids = $query->pluck('id');
        $this->info('Download inline main images: '.$ids->count());

        $derivatives = app(MediaDerivativeService::class);
        foreach ($ids as $id) {
            try {
                (new DownloadProductMedia((int) $id))->handle($derivatives);
                $this->line('  ok media #'.$id);
            } catch (\Throwable $e) {
                $this->warn('  fail media #'.$id.': '.$e->getMessage());
            }
        }
    }
}
