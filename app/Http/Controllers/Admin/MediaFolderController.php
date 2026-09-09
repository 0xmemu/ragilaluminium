<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
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
            ->orderBy('name')
            ->get();

        return response()->json(['folders' => self::buildTree($folders)]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120', 'regex:/^[^\/\\\\:*?"<>|]+$/'],
            'parent_id' => ['nullable', 'integer', Rule::exists('media_folders', 'id')],
        ]);

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
        ]);

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
            'asset_ids' => ['required', 'array', 'min:1', 'max:200'],
            'asset_ids.*' => ['integer', 'distinct', 'exists:media_assets,id'],
        ]);

        MediaAsset::query()->whereIn('id', $validated['asset_ids'])
            ->update(['folder_id' => $validated['folder_id'] ?? null]);

        return redirect()->back()->with('success', 'Aset dipindahkan.');
    }

    /**
     * Hapus folder/subfolder.
     * Jika folder memiliki aset atau subfolder, seluruh aset otomatis dipindahkan
     * ke folder "Semua Media" (folder_id = null) sebelum folder dihapus.
     */
    public function destroy(Request $request, MediaFolder $folder): RedirectResponse
    {
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