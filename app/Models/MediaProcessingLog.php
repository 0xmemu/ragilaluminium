<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Status pemrosesan media terkini (antre -> diproses -> berhasil / gagal).
 * Polimorfik: menunjuk ke MediaAsset (upload langsung) atau ProductMedia.
 *
 * Satu pekerjaan meninggalkan SATU baris yang statusnya berubah, bukan tumpukan
 * baris per tahap. Kontrak owner 2026-10-14: "Diproses" dan "Antre" adalah status
 * SEMENTARA, jadi harus berhenti begitu pekerjaannya selesai. Sebelumnya setiap
 * tahap menambah baris baru dan tidak pernah memperbarui yang lama, sehingga
 * halaman Riwayat Media menumpuk baris "Diproses" yang sudah lama selesai (pada
 * data nyata 14 Okt: 164 media meninggalkan 326 baris, dua baris per media) dan
 * angkanya terbaca seperti masih banyak pekerjaan berjalan.
 */
class MediaProcessingLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'loggable_type',
        'loggable_id',
        'entity_label',
        'event',
        'message',
        'meta',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function loggable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Kejadian yang menandai pekerjaan sudah berakhir dan tidak akan berubah lagi.
     * Hanya kejadian di luar daftar ini yang boleh diperbarui di tempat.
     */
    private const TERMINAL_EVENTS = ['success', 'failed', 'dedup'];

    /**
     * Catat satu transisi status TANPA menumpuk baris.
     *
     * Kalau entitas ini masih punya baris yang belum berakhir (antre atau
     * diproses), baris itu yang diperbarui, sehingga "Diproses" benar-benar
     * berhenti saat pekerjaannya selesai. Baris yang sudah berakhir tidak pernah
     * ditimpa: percobaan ulang sesudah gagal memang peristiwa baru, jadi layak
     * mendapat barisnya sendiri.
     *
     * Dipakai seluruh penulis log pemrosesan media. `record()` tetap ada sebagai
     * penulis tingkat rendah (menambah baris apa adanya) untuk keperluan uji dan
     * pencatatan kejadian yang memang berdiri sendiri.
     */
    public static function transition(
        Model $loggable,
        string $event,
        ?string $message = null,
        ?array $meta = null,
    ): self {
        $baris = static::query()
            ->where('loggable_type', $loggable->getMorphClass())
            ->where('loggable_id', $loggable->getKey())
            ->whereNotIn('event', self::TERMINAL_EVENTS)
            ->latest('id')
            ->first();

        if ($baris) {
            $baris->update([
                'entity_label' => static::labelFor($loggable),
                'event' => $event,
                'message' => $message,
                'meta' => $meta,
            ]);

            return $baris;
        }

        return static::record($loggable, $event, $message, $meta);
    }

    /**
     * Catat satu transisi status.
     *
     * `$meta` menampung keterangan tambahan yang hanya berlaku untuk sebagian
     * kejadian, misalnya aset TUJUAN pada penggabungan duplikat. Bentuk JSON
     * (bukan kolom per kejadian) supaya kejadian lain bisa ikut memakainya tanpa
     * menambah kolom baru lagi.
     */
    public static function record(
        Model $loggable,
        string $event,
        ?string $message = null,
        ?array $meta = null,
    ): self {
        return static::create([
            'loggable_type' => $loggable->getMorphClass(),
            'loggable_id' => $loggable->getKey(),
            'entity_label' => static::labelFor($loggable),
            'event' => $event,
            'message' => $message,
            'meta' => $meta,
            'created_at' => now(),
        ]);
    }

    private static function labelFor(Model $loggable): string
    {
        if ($loggable instanceof MediaAsset) {
            return $loggable->label ?: ('Aset #'.$loggable->id);
        }

        if ($loggable instanceof ProductMedia) {
            $name = $loggable->product?->name;

            return $name ? ('Media: '.$name) : ('Media #'.$loggable->id);
        }

        return class_basename($loggable).' #'.$loggable->getKey();
    }
}
