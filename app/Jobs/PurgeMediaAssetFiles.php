<?php

namespace App\Jobs;

use App\Services\MediaStoragePurger;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Hapus berkas media di disk (lokal atau R2) berdasarkan daftar key yang sudah
 * dikumpulkan sebelum baris DB-nya hilang.
 *
 * Dipisah dari event model supaya penghapusan baris tidak menunggu latensi R2,
 * dan supaya kegagalan jaringan bisa dicoba ulang oleh antrean. Key dibekukan
 * di dalam payload, jadi job tetap benar walau barisnya sudah tidak ada saat
 * job berjalan.
 */
class PurgeMediaAssetFiles implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [10, 60, 180];

    /**
     * @param  list<string>  $keys
     */
    public function __construct(public array $keys)
    {
        $this->onQueue('media');
    }

    public function handle(MediaStoragePurger $purger): void
    {
        $purger->purgeKeys($this->keys);
    }
}
