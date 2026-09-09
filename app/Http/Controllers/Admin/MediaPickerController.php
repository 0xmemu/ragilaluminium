<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Support\LikeSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * JSON endpoint untuk MediaPicker di form produk (ADR-020):
 * pilih aset siap pakai dari Media Library tanpa keluar dari form.
 * Mendukung filter folder, pencarian label/produk, dan info produk pemakai.
 */
class MediaPickerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $folderId = $request->query('folder_id');

        $assets = MediaAsset::query()
            ->with(['folder:id,name', 'attachments.product:id,name'])
            ->where('status', 'ready')
            ->where('visibility', '!=', 'archived')
            ->when($folderId !== null && $folderId !== '', function ($query) use ($folderId): void {
                if ($folderId === 'inbox' || $folderId === 'null') {
                    $query->whereNull('folder_id');
                } else {
                    $query->where('folder_id', (int) $folderId);
                }
            })
            ->when($q !== '', function ($query) use ($q): void {
                $query->where(function ($inner) use ($q): void {
                    LikeSearch::whereLike($inner, 'label', $q);
                    $inner->orWhereHas('attachments.product', function ($pQuery) use ($q): void {
                        LikeSearch::whereLike($pQuery, 'name', $q);
                    });
                });
            })
            ->orderByDesc('id')
            ->limit(48)
            ->get(['id', 'label', 'kind', 'status', 'object_key', 'derivatives', 'folder_id']);

        $allFolders = MediaFolder::query()
            ->withCount('assets')
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name']);

        $inboxCount = MediaAsset::query()
            ->where('status', 'ready')
            ->where('visibility', '!=', 'archived')
            ->whereNull('folder_id')
            ->count();

        return response()->json([
            'assets' => $assets->map(function (MediaAsset $asset) {
                $products = $asset->attachments
                    ->map(fn ($att) => $att->product?->name)
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();

                return [
                    'id' => $asset->id,
                    'label' => $asset->label ?: ('Media #'.$asset->id),
                    'kind' => $asset->kind,
                    'thumb_url' => $asset->urlFor('thumb'),
                    'pdp_url' => $asset->urlFor('pdp') ?? $asset->urlFor('card'),
                    'folder_id' => $asset->folder_id,
                    'folder_name' => $asset->folder?->name,
                    'product_names' => $products,
                ];
            })->values()->all(),
            'folders' => $allFolders,
            'inbox_count' => $inboxCount,
        ]);
    }
}
