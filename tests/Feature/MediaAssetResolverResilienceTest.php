<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Services\MediaAssetResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Regresi 17 Okt 2026. Impor #10 kehilangan 14 baris karena pemeriksaan
 * keberadaan berkas media melempar exception saat kredensial penyimpanan
 * ditolak, bukan sekadar mengembalikan "tidak ada".
 *
 * Kontrak yang dijaga:
 *  1. Object key yang sudah tercatat di arsip media dianggap internal tanpa
 *     memanggil penyimpanan, apa pun statusnya (aset archived tetap berkas
 *     nyata di bucket).
 *  2. Kegagalan pemeriksaan penyimpanan tidak melempar; hasilnya "bukan aset
 *     internal" supaya pemanggil memakai jalur unduh biasa.
 */
class MediaAssetResolverResilienceTest extends TestCase
{
    use RefreshDatabase;

    /** URL publik yang host-nya dikenali sebagai disk media sendiri. */
    private function internalUrl(string $path): string
    {
        $base = (string) config('filesystems.disks.'.config('media.disk', 'media').'.url', '');

        return rtrim($base, '/').'/'.ltrim($path, '/');
    }

    public function test_object_key_tercatat_dianggap_internal_tanpa_menyentuh_storage(): void
    {
        MediaAsset::create([
            'kind' => 'image',
            'source_url' => 'https://contoh.test/asal.webp',
            'source_url_hash' => hash('sha256', 'asal'),
            'object_key' => 'media-assets/arsip-checksum/pdp.webp',
            // Aset yang pernah diganti tetap tersimpan sebagai arsip.
            'status' => 'archived',
            'visibility' => 'visible',
        ]);

        // Disk dibuat selalu gagal: kalau resolver masih memanggil penyimpanan,
        // hasilnya akan null dan test ini gagal.
        $this->mockStorageFailure();

        $key = app(MediaAssetResolver::class)
            ->internalObjectKeyPublic($this->internalUrl('media-assets/arsip-checksum/pdp.webp'));

        $this->assertSame(
            'media-assets/arsip-checksum/pdp.webp',
            $key,
            'object key yang sudah tercatat tidak boleh bergantung pada pemeriksaan penyimpanan'
        );
    }

    public function test_kegagalan_pemeriksaan_penyimpanan_tidak_melempar(): void
    {
        $this->mockStorageFailure();

        $key = app(MediaAssetResolver::class)
            ->internalObjectKeyPublic($this->internalUrl('media-assets/belum-tercatat/pdp.webp'));

        $this->assertNull(
            $key,
            'kegagalan pemeriksaan harus menghasilkan "bukan aset internal", bukan exception'
        );
    }

    public function test_url_di_luar_host_media_tetap_ditolak(): void
    {
        $this->assertNull(
            app(MediaAssetResolver::class)
                ->internalObjectKeyPublic('https://contoh-lain.test/media-assets/x/pdp.webp')
        );
    }

    /** Disk media yang selalu gagal saat diperiksa, meniru kredensial ditolak. */
    private function mockStorageFailure(): void
    {
        $rusak = \Mockery::mock(\Illuminate\Contracts\Filesystem\Filesystem::class);
        $rusak->shouldReceive('exists')
            ->andThrow(new \RuntimeException('Kredensial penyimpanan ditolak.'));

        Storage::shouldReceive('disk')->andReturn($rusak);
    }
}
