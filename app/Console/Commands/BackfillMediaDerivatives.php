<?php

namespace App\Console\Commands;

use App\Jobs\DownloadProductMedia;
use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use Illuminate\Console\Command;

class BackfillMediaDerivatives extends Command
{
    protected $signature = 'media:backfill-derivatives
                            {--chunk=100 : Rows per chunk}
                            {--queue : Dispatch DownloadProductMedia jobs instead of running inline}
                            {--missing-only : Only rows with empty derivatives (default true)}';

    protected $description = 'Generate WebP thumb/card/pdp for product_media that already have a stored original';

    public function handle(MediaDerivativeService $derivatives): int
    {
        $chunk = max(1, (int) $this->option('chunk'));
        $useQueue = (bool) $this->option('queue');

        $query = ProductMedia::query()
            ->where('status', 'downloaded')
            ->whereNotNull('stored_path')
            ->where(function ($q) {
                $q->whereNull('derivatives')
                    ->orWhere('derivatives', '')
                    ->orWhere('derivatives', '[]')
                    ->orWhere('derivatives', '{}');
            });

        $total = (clone $query)->count();
        $this->info("Candidates: {$total}");

        if ($total === 0) {
            return self::SUCCESS;
        }

        $ok = 0;
        $fail = 0;

        $query->orderBy('id')->chunkById($chunk, function ($rows) use ($derivatives, $useQueue, &$ok, &$fail) {
            foreach ($rows as $media) {
                if ($useQueue) {
                    DownloadProductMedia::dispatch($media->id);
                    $ok++;
                    continue;
                }

                try {
                    $built = $derivatives->regenerateFromStored($media->stored_path, (int) $media->product_id);
                    $payload = [
                        'derivatives' => $built,
                        'error_reason' => null,
                    ];
                    $promoted = $derivatives->promoteMasterAndDiscardOriginal($media->stored_path, $built);
                    if ($promoted !== null) {
                        $payload = array_merge($payload, $promoted);
                    }
                    $media->update($payload);
                    $ok++;
                } catch (\Throwable $e) {
                    $media->update(['error_reason' => mb_substr('derivatives_failed: '.$e->getMessage(), 0, 500)]);
                    $this->error("Media {$media->id}: {$e->getMessage()}");
                    $fail++;
                }
            }
        });

        $this->info($useQueue
            ? "Dispatched {$ok} jobs on queue [media]."
            : "Done. ok={$ok} fail={$fail}");

        return $fail > 0 ? self::FAILURE : self::SUCCESS;
    }
}
