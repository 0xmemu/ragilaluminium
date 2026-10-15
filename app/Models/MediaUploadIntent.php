<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Niat unggah satu berkas media.
 *
 * Lihat migrasi `create_media_upload_intents_table` untuk alasannya. Ringkasnya:
 * tabel ini memberi jejak pada fase yang sebelumnya tidak tercatat sama sekali,
 * yaitu sejak admin menekan "Mulai Unggah" sampai berkas benar-benar diterima
 * server. Tanpa jejak itu, menutup tab di tengah unggahan menghilangkan
 * informasinya tanpa sisa.
 */
class MediaUploadIntent extends Model
{
    /** Klien sudah menyatakan niat; hasilnya belum diketahui. */
    public const STATUS_UPLOADING = 'uploading';

    /** Berkas diterima server; `media_asset_id` menunjuk asetnya. */
    public const STATUS_DONE = 'done';

    /** Server menolak berkas; `error_reason` berisi sebabnya. */
    public const STATUS_FAILED = 'failed';

    /** Tidak ada kabar sampai batas waktu (tab ditutup atau koneksi putus). */
    public const STATUS_DISCONNECTED = 'disconnected';

    /**
     * Status yang berarti "tidak perlu ditunggu lagi": klien tidak punya
     * pekerjaan tersisa untuk baris ini.
     */
    public const STATUS_FINAL = [
        self::STATUS_DONE,
        self::STATUS_FAILED,
        self::STATUS_DISCONNECTED,
    ];

    protected $fillable = [
        'user_id',
        'folder_id',
        'client_batch_id',
        'file_name',
        'size_bytes',
        'checksum',
        'status',
        'media_asset_id',
        'error_reason',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'folder_id' => 'integer',
        'size_bytes' => 'integer',
        'media_asset_id' => 'integer',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(MediaFolder::class, 'folder_id');
    }

    /** Apakah baris ini sudah tidak mungkin berubah lagi. */
    public function sudahFinal(): bool
    {
        return in_array($this->status, self::STATUS_FINAL, true);
    }
}
