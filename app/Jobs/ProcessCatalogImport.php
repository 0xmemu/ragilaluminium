<?php

namespace App\Jobs;

use App\Imports\CatalogProductsImport;
use App\Imports\ImportMediaUpdate;
use App\Imports\ImportStockPriceUpdate;
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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;

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
        ImportFailureNotifier::notify($this->jobId, 'Job gagal: '.$e->getMessage());
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
            ImportFailureNotifier::notify($this->jobId, 'Berkas sumber tidak ditemukan.');

            throw new \RuntimeException('Berkas sumber impor tidak ditemukan.');
        }

        try {
            // Progress denominator: job lama (sebelum 2026-09-01) tidak punya
            // total_rows. Backfill sekali dari file sumber supaya halaman
            // detail bisa menampilkan progres berjalan.
            if (empty($job->total_rows)) {
                $previewRows = \Maatwebsite\Excel\Facades\Excel::toArray(
                    new \App\Imports\InternalCatalogPreviewImport(),
                    $path
                )[0] ?? [];
                $counted = count(array_filter($previewRows, fn ($r) => ! empty(trim((string) ($r['name'] ?? ''))) || ! empty(trim((string) ($r['parent_sku'] ?? '')))));
                $job->update(['total_rows' => $counted]);

                $distinctProducts = collect($previewRows)->map(function ($r) {
                    $name = trim((string) ($r['name'] ?? ''));
                    $idKey = trim((string) ($r['id_key'] ?? ''));
                    $parentSku = trim((string) ($r['parent_sku'] ?? ''));
                    return $idKey !== '' ? 'id_key:'.$idKey : ($name !== '' ? 'name:'.$name : ($parentSku !== '' ? 'sku:'.$parentSku : null));
                })->filter()->unique()->count();
                \Illuminate\Support\Facades\Cache::put("import_total_products_{$job->id}", $distinctProducts, 86400);
            }

            // Auto-detect Shopee dihapus (owner 2026-08-25): semua file diproses
            // sebagai format internal. File ekspor Shopee lama gagal baris
            // (parent_sku kosong) - BREAKING, lihat laporan task import-katalog.

            // Lapis kedua all-or-nothing (kontrak owner 09-05): jenis update
            // diverifikasi ulang sebelum eksekusi. UI sudah wajib Periksa file;
            // ini pengaman bila file berubah / jalur lain.
            if (in_array($job->type, ['stock_price_update', 'media_update'], true)) {
                $updateRows = \Maatwebsite\Excel\Facades\Excel::toArray(
                    new \App\Imports\InternalCatalogPreviewImport(),
                    $path
                )[0] ?? [];
                $manualStock = $job->stock_mode === 'manual' ? (int) $job->manual_stock : null;
                $result = \App\Support\UpdateImportVerifier::verify(
                    array_slice($updateRows, 0, 2000),
                    $job->type,
                    $manualStock
                );
                if ($result['errors'] !== []) {
                    throw new \RuntimeException('File gagal verifikasi: '
                        .implode(' | ', array_slice($result['errors'], 0, 8))
                        .(count($result['errors']) > 8 ? ' … dan '.(count($result['errors']) - 8).' lainnya.' : ''));
                }
            }

            $importer = match ($job->type) {
                'stock_price_update' => new ImportStockPriceUpdate($this->jobId),
                'media_update' => new ImportMediaUpdate($this->jobId),
                default => new CatalogProductsImport($this->jobId, $path),
            };

            // 8 SCOPE (design-thinking): eksekusi dalam satu transaction.
            // Kontrak all-or-nothing owner: error runtime di tengah eksekusi
            // (bukan hanya error struktur yang tertangkap pre-pass) harus
            // membatalkan SELURUH batch, bukan menyisakan data parsial.
            // Commit = sukses; throw = rollback struktural.
            \Illuminate\Support\Facades\Cache::put("import_progress_{$this->jobId}", 0, 600);
            DB::transaction(function () use ($importer, $path): void {
                Excel::import($importer, $path);
            });

            // Import katalog memperkenalkan pasangan kategori + model baru.
            // Sinkronkan CMS Model Produk setelah transaksi katalog committed,
            // supaya kartu/menu publik langsung mengenali pasangan tersebut
            // tanpa langkah manual admin dan tanpa membaca data yang belum commit.
            app(\App\Services\ModelProductService::class)
                ->syncFromCatalog($job->triggered_by_user_id ? (int) $job->triggered_by_user_id : null);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Cache::forget("import_progress_{$this->jobId}");
            $job->update([
                'status' => 'failed',
                'global_error_message' => $e->getMessage(),
                'completed_at' => now(),
            ]);
            ImportFailureNotifier::notify($this->jobId, $e->getMessage());

            throw $e;
        }

        \Illuminate\Support\Facades\Cache::forget("import_progress_{$this->jobId}");
        $job->refresh();
        if (in_array($job->status, ['pending', 'running'])) {
            $job->update(['status' => 'completed', 'completed_at' => now()]);
        }

        CatalogTaxonomy::forgetCache();
    }
}