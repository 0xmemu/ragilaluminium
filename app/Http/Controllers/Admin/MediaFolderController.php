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

    /** Hanya folder KOSONG yang boleh dihapus (asset harus dipindah/diarsipkan dulu). */
    public function destroy(Request $request, MediaFolder $folder): RedirectResponse
    {
        if ($folder->assets()->exists() || $folder->children()->exists()) {
            return redirect()->back()->withErrors(['folder' => 'Folder masih berisi asset/subfolder. Pindahkan dulu, atau arsipkan folder.']);
        }

        $folder->delete();

        return redirect()->back()->with('success', 'Folder kosong dihapus.');
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