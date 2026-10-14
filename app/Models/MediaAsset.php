<?php

namespace App\Models;

use App\Jobs\PurgeMediaAssetFiles;
use App\Services\MediaStoragePurger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class MediaAsset extends Model
{
    protected $fillable = [
        'kind',
        'label',
        'source_url_hash',
        'checksum',
        'source_url',
        'object_key',
        'derivatives',
        'mime_type',
        'size_bytes',
        'width_px',
        'height_px',
        'duration_ms',
        'poster_asset_id',
        'folder_id',
        'status',
        'visibility',
        'error_reason',
        'created_by_import_job_id',
        'last_updated_by_import_job_id',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'derivatives' => 'array',
        'size_bytes' => 'integer',
        'width_px' => 'integer',
        'height_px' => 'integer',
        'duration_ms' => 'integer',
    ];

    /**
     * Key penyimpanan yang menunggu dihapus.
     *
     * Dikumpulkan saat event `deleting`, karena pada saat itu atribut model
     * masih terbaca, lalu dipakai saat event `deleted` untuk menjadwalkan
     * pembersihan storage. Tanpa penampung ini, key-nya hilang bersamaan
     * dengan barisnya dan berkas di bucket menjadi yatim.
     *
     * @var list<string>
     */
    public array $purgeKeysOnDelete = [];

    /**
     * Cascade hapus: setiap penghapusan baris aset, dari jalur mana pun
     * (controller, perintah artisan, tinker, atau kode baru di kemudian hari),
     * otomatis menjadwalkan penghapusan berkasnya di disk.
     *
     * Penghapusan berkas dijalankan lewat antrean, bukan langsung, supaya
     * permintaan admin tidak menunggu latensi R2 dan kegagalan jaringan bisa
     * dicoba ulang. Perhatikan bahwa arsip sengaja TIDAK menghapus berkas:
     * aset yang diarsipkan masih bisa dipulihkan.
     */
    protected static function booted(): void
    {
        static::deleting(function (MediaAsset $asset): void {
            $asset->purgeKeysOnDelete = app(MediaStoragePurger::class)->keysForAsset($asset);
        });

        static::deleted(function (MediaAsset $asset): void {
            if ($asset->purgeKeysOnDelete !== []) {
                PurgeMediaAssetFiles::dispatch($asset->purgeKeysOnDelete);
            }
        });
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(ProductMedia::class);
    }

    public function poster(): BelongsTo
    {
        return $this->belongsTo(self::class, 'poster_asset_id');
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(MediaFolder::class, 'folder_id');
    }

    public function scopeReady(Builder $query): Builder
    {
        return $query->where('status', 'ready')->where('visibility', 'visible');
    }

    public function localUrlFor(string $variant = 'card'): ?string
    {
        $variant = in_array($variant, ['thumb', 'card', 'pdp', 'poster', 'video'], true) ? $variant : 'card';
        $derivatives = $this->derivatives ?? [];

        // Video: varian 'video' harus mengembalikan FILE VIDEO (object_key), bukan
        // poster.webp yang seharusnya hanya jadi thumbnail <img>.
        if ($variant === 'video' && $this->object_key && $this->status === 'ready') {
            return $this->publicUrlForPath($this->object_key);
        }

        foreach ([$variant, 'card', 'pdp', 'thumb', 'poster'] as $key) {
            if (! empty($derivatives[$key]['path'])) {
                return $this->publicUrlForPath((string) $derivatives[$key]['path']);
            }
        }

        if ($this->object_key && $this->status === 'ready') {
            return $this->publicUrlForPath($this->object_key);
        }

        foreach ([$variant, 'card', 'pdp', 'thumb', 'poster'] as $key) {
            if (! empty($derivatives[$key]['url'])) {
                return (string) $derivatives[$key]['url'];
            }
        }

        return null;
    }

    public function urlFor(string $variant = 'card'): ?string
    {
        return $this->localUrlFor($variant);
    }

    public function publicUrlForPath(string $path): string
    {
        return Storage::disk(config('media.disk', 'media'))->url(ltrim($path, '/'));
    }
}
