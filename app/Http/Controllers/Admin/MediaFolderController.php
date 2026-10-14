<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsBanner;
use App\Models\CmsGalleryItem;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\ProductMedia;
use App\Support\MediaLibraryFilter;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Folder organisasi Media Library (virtual; tidak mengubah object_key/URL).
 */
class MediaFolderController extends Controller
{
    /** Tree JSON untuk sidebar Media Library. */
    public function tree(): JsonResponse
    {
        $folders = MediaFolder::query()
            ->withCount('assets')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['folders' => self::buildTree($folders)]);
    }

    /**
     * Simpan urutan folder. Hanya mengubah urutan ANTAR-SIBLING: setiap id
     * wajib punya parent_id yang sama dengan parent_id yang dikirim, sehingga
     * folder tidak bisa berpindah ke dalam folder lain lewat drag.
     */
    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'parent_id' => ['nullable', 'integer', Rule::exists('media_folders', 'id')],
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer', 'distinct', Rule::exists('media_folders', 'id')],
        ]);

        $parentId = $validated['parent_id'] ?? null;

        // Tolak bila ada folder yang bukan sibling dari parent yang dikirim.
        $mismatch = MediaFolder::query()
            ->whereIn('id', $validated['ids'])
            ->where(function ($query) use ($parentId) {
                $parentId === null
                    ? $query->whereNotNull('parent_id')
                    : $query->where('parent_id', '!=', $parentId)->orWhereNull('parent_id');
            })
            ->exists();

        if ($mismatch) {
            return redirect()->back()->withErrors([
                'ids' => 'Folder hanya bisa diurutkan antar-folder sejajar (tidak bisa pindah ke dalam folder lain).',
            ]);
        }

        DB::transaction(function () use ($validated) {
            foreach ($validated['ids'] as $index => $id) {
                MediaFolder::where('id', $id)->update(['sort_order' => $index + 1]);
            }
        });

        ActivityLogService::record('media.folders_reordered', 'media_folder', (int) $validated['ids'][0], [
            'parent_id' => $validated['parent_id'] ?? null,
            'count' => count($validated['ids']),
        ], (int) $request->user()->id);

        return redirect()->back()->with('success', 'Urutan folder disimpan.');
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120', 'regex:/^[^\/\\\\:*?"<>|]+$/'],
            'parent_id' => ['nullable', 'integer', Rule::exists('media_folders', 'id')],
        ], [], ['name' => 'Nama folder']);

        $folder = MediaFolder::create([
            'name' => trim($validated['name']),
            'parent_id' => $validated['parent_id'] ?? null,
        ]);

        ActivityLogService::record('media.folder_created', 'media_folder', (int) $folder->id, [
            'name' => $folder->name,
            'parent_id' => $folder->parent_id,
        ], (int) $request->user()->id);

        return redirect()->back()->with('success', 'Folder dibuat.');
    }

    public function rename(Request $request, MediaFolder $folder): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120', 'regex:/^[^\/\\\\:*?"<>|]+$/'],
        ], [], ['name' => 'Nama folder']);

        $folder->update(['name' => trim($validated['name'])]);

        return redirect()->back()->with('success', 'Folder diganti namanya.');
    }

    public function move(Request $request, MediaFolder $folder): RedirectResponse
    {
        $validated = $request->validate([
            'parent_id' => ['nullable', 'integer', Rule::exists('media_folders', 'id')],
        ]);

        $newParent = $validated['parent_id'] ?? null;
        if ($newParent === (int) $folder->id || $this->isDescendant($folder, $newParent)) {
            return redirect()->back()->withErrors(['parent_id' => 'Folder tidak bisa dipindah ke dalam dirinya sendiri atau subfoldernya.']);
        }

        $folder->update(['parent_id' => $newParent]);

        return redirect()->back()->with('success', 'Folder dipindahkan.');
    }

    public function moveAssets(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'folder_id' => ['nullable', 'integer', Rule::exists('media_folders', 'id')],
            // Sama seperti aksi massal lain: daftar id eksplisit ATAU `scope_all`
            // untuk seluruh aset pada folder + filter aktif.
            'asset_ids' => ['nullable', 'array', 'max:200'],
            'asset_ids.*' => ['integer', 'distinct', 'exists:media_assets,id'],
            'scope_all' => ['sometimes', 'boolean'],
        ]);

        $assetIds = $request->boolean('scope_all')
            ? MediaLibraryFilter::apply($request)->pluck('id')->all()
            : ($validated['asset_ids'] ?? []);

        if ($assetIds === []) {
            return redirect()->back()->with('error', 'Tidak ada aset yang dipilih.');
        }

        MediaAsset::query()->whereIn('id', $assetIds)
            ->update(['folder_id' => $validated['folder_id'] ?? null]);

        return redirect()->back()->with('success', 'Aset dipindahkan.');
    }

    /**
     * Hapus folder/subfolder.
     * Jika folder memiliki aset atau subfolder, seluruh aset otomatis dipindahkan
     * ke folder "Semua Media" (folder_id = null) sebelum folder dihapus.
     */
    /**
     * Hapus folder dengan dua pilihan (permintaan owner 2026-10-14).
     *
     * `with_assets = false` (bawaan, perilaku lama): folder dihapus, seluruh
     * aset di dalamnya dipindahkan ke Semua Media (`folder_id` menjadi null).
     *
     * `with_assets = true`: folder DAN isinya dibersihkan. Aset yang masih
     * terpakai produk/banner/galeri DIARSIPKAN, bukan dihapus permanen, supaya
     * halaman yang memakainya tidak kehilangan gambar. Aset yang tidak dipakai
     * mana pun dihapus permanen; berkas di bucket ikut terhapus lewat event
     * deleting/deleted MediaAsset.
     *
     * Kedua cabang juga menghapus seluruh subfolder di bawahnya.
     */
    public function destroy(Request $request, MediaFolder $folder): RedirectResponse
    {
        $withAssets = $request->boolean('with_assets');

        if ($withAssets) {
            [$deletedCount, $archivedCount] = DB::transaction(function () use ($folder, $request): array {
                $folderIds = $this->allDescendantIds($folder);
                $folderIds[] = $folder->id;

                $deletedCount = 0;
                $archivedCount = 0;

                foreach (MediaAsset::query()->whereIn('folder_id', $folderIds)->get() as $asset) {
                    if ($this->assetMasihTerpakai($asset)) {
                        // Terlampir di produk/banner/galeri: jangan hapus, cukup
                        // sembunyikan supaya halaman yang memakainya tetap utuh.
                        $asset->update(['visibility' => 'archived']);
                        $archivedCount++;

                        continue;
                    }

                    // Tidak dipakai mana pun: hapus permanen beserta berkasnya.
                    $asset->delete();
                    $deletedCount++;
                }

                ActivityLogService::record('media.folder_deleted', 'media_folder', (int) $folder->id, [
                    'name' => $folder->name,
                    'with_assets' => true,
                    'deleted_assets_count' => $deletedCount,
                    'archived_assets_count' => $archivedCount,
                    'deleted_folders_count' => count($folderIds),
                ], (int) $request->user()->id);

                MediaFolder::query()->whereIn('id', $folderIds)->delete();

                return [$deletedCount, $archivedCount];
            });

            $pesan = "Folder {$folder->name} dan isinya dihapus.";
            if ($deletedCount > 0) {
                $pesan .= " {$deletedCount} aset dihapus permanen.";
            }
            if ($archivedCount > 0) {
                $pesan .= " {$archivedCount} aset masih dipakai produk sehingga diarsipkan, bukan dihapus.";
            }

            return redirect()->back()->with('success', $pesan);
        }

        $movedCount = DB::transaction(function () use ($folder, $request): int {
            // Kumpulkan ID folder ini dan seluruh subfoldernya secara rekursif
            $folderIds = $this->allDescendantIds($folder);
            $folderIds[] = $folder->id;

            // Pindahkan seluruh aset yang berada di folder ini atau subfoldernya ke Semua Media (folder_id = null)
            $count = MediaAsset::query()
                ->whereIn('folder_id', $folderIds)
                ->update(['folder_id' => null]);

            ActivityLogService::record('media.folder_deleted', 'media_folder', (int) $folder->id, [
                'name' => $folder->name,
                'moved_assets_count' => $count,
                'deleted_folders_count' => count($folderIds),
            ], (int) $request->user()->id);

            // Hapus folder dan seluruh subfoldernya
            MediaFolder::query()->whereIn('id', $folderIds)->delete();

            return $count;
        });

        $message = $movedCount > 0
            ? "Folder {$folder->name} dihapus. {$movedCount} aset di dalamnya dipindahkan ke Semua Media."
            : "Folder {$folder->name} dihapus.";

        return redirect()->back()->with('success', $message);
    }

    /**
     * Apakah aset masih dipakai di tempat lain (produk, banner, atau galeri).
     *
     * Aturannya sama dengan penjaga hapus aset di ProductMediaController:
     * aset yang masih terlampir tidak boleh dihapus permanen.
     */
    private function assetMasihTerpakai(MediaAsset $asset): bool
    {
        return ProductMedia::where('media_asset_id', $asset->id)->exists()
            || CmsBanner::where('media_asset_id', $asset->id)->exists()
            || CmsGalleryItem::where('media_asset_id', $asset->id)->exists();
    }

    /**
     * @return list<int>
     */
    private function allDescendantIds(MediaFolder $folder): array
    {
        $ids = [];
        $children = MediaFolder::query()->where('parent_id', $folder->id)->get();
        foreach ($children as $child) {
            $ids[] = $child->id;
            $ids = array_merge($ids, $this->allDescendantIds($child));
        }

        return $ids;
    }

    public function archive(Request $request, MediaFolder $folder): RedirectResponse
    {
        DB::transaction(function () use ($folder): void {
            $folder->update(['archived_at' => now()]);
            // Asset di dalamnya ikut diarsipkan (keputusan: arsip, bukan hapus).
            $folder->assets()->update(['visibility' => 'archived']);
            foreach ($folder->children as $child) {
                $child->update(['archived_at' => now()]);
            }
        });

        return redirect()->back()->with('success', 'Folder diarsipkan (asset di dalamnya ikut diarsipkan).');
    }

    /** @param \Illuminate\Support\Collection<int, MediaFolder> $folders */
    private static function buildTree($folders, ?int $parentId = null): array
    {
        return $folders
            ->where('parent_id', $parentId)
            ->values()
            ->map(fn (MediaFolder $f) => [
                'id' => $f->id,
                'name' => $f->name,
                'assets_count' => (int) $f->assets_count,
                'children' => self::buildTree($folders, (int) $f->id),
            ])
            ->all();
    }

    private function isDescendant(MediaFolder $folder, ?int $candidateParentId): bool
    {
        if ($candidateParentId === null) {
            return false;
        }

        $cursor = MediaFolder::find($candidateParentId);
        while ($cursor) {
            if ((int) $cursor->id === (int) $folder->id) {
                return true;
            }
            $cursor = $cursor->parent;
        }

        return false;
    }
}