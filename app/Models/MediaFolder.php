<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Folder organisasi VIRTUAL untuk Media Library.
 *
 * Folder hanya metadata organisasi manusia; TIDAK mempengaruhi object_key /
 * public_url asset. Rename/move folder = update metadata semata.
 * "Inbox" adalah folder virtual (assets dengan folder_id NULL), tidak disimpan.
 */
class MediaFolder extends Model
{
    protected $fillable = ['parent_id', 'name', 'sort_order', 'archived_at'];

    protected $casts = [
        'archived_at' => 'datetime',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')
            ->orderBy('sort_order')
            ->orderBy('name');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(MediaAsset::class, 'folder_id');
    }

    /**
     * ID folder ini ditambah seluruh folder di bawahnya.
     *
     * Satu folder dianggap memuat media yang tersimpan di subfolder mana pun,
     * supaya folder induk tidak tampak kosong hanya karena isinya diletakkan di
     * subfolder. Dipakai bersama oleh daftar Media Library dan pemilih media,
     * jadi keduanya tidak pernah berbeda pendapat soal cakupan folder.
     *
     * @return list<int>
     */
    public function descendantIds(): array
    {
        [$children] = self::folderIndex();

        $ids = [];
        $pending = [(int) $this->id];
        while ($pending !== []) {
            $current = array_shift($pending);
            $ids[] = $current;
            foreach ($children[$current] ?? [] as $child) {
                $pending[] = $child;
            }
        }

        return $ids;
    }

    /**
     * Peta id folder => jumlah aset folder itu ditambah seluruh subfoldernya.
     *
     * Dihitung sekali untuk seluruh pohon supaya daftar folder di sidebar tidak
     * menembak satu query per folder. Angkanya harus sejalan dengan isi daftar,
     * yang juga memuat aset subfolder.
     *
     * @return array<int, int>
     */
    public static function deepAssetCounts(): array
    {
        [$children, $allIds] = self::folderIndex();

        $direct = [];
        foreach (MediaAsset::query()
            ->whereNotNull('folder_id')
            ->selectRaw('folder_id, count(*) as total')
            ->groupBy('folder_id')
            ->get() as $row) {
            $direct[(int) $row->folder_id] = (int) $row->total;
        }

        $counts = [];
        $sum = function (int $id) use (&$sum, $children, $direct, &$counts): int {
            if (isset($counts[$id])) {
                return $counts[$id];
            }

            $total = $direct[$id] ?? 0;
            foreach ($children[$id] ?? [] as $child) {
                $total += $sum($child);
            }

            return $counts[$id] = $total;
        };

        foreach ($allIds as $id) {
            $sum($id);
        }

        return $counts;
    }

    /**
     * Pohon folder sebagai peta parent_id => daftar id anak, plus daftar
     * seluruh id. Dipakai bersama oleh descendantIds() dan deepAssetCounts()
     * supaya keduanya membaca pohon dengan cara yang sama.
     *
     * @return array{0: array<int, list<int>>, 1: list<int>}
     */
    protected static function folderIndex(): array
    {
        $children = [];
        $allIds = [];
        foreach (self::query()->get(['id', 'parent_id']) as $folder) {
            $id = (int) $folder->id;
            $allIds[] = $id;
            $children[(int) $folder->parent_id][] = $id;
        }

        return [$children, $allIds];
    }
}