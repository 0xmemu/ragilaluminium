<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MediaAsset;
use App\Support\LikeSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * JSON endpoint untuk MediaPicker di form produk (ADR-020):
 * pilih aset siap pakai dari Media Library tanpa keluar dari form.
 */
class MediaPickerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $assets = MediaAsset::query()
            ->where('status', 'ready')
            ->where('visibility', '!=', 'archived')
            ->when($q !== '', function ($query) use ($q): void {
                $query->where(fn ($inner) => LikeSearch::whereLike($inner, 'label', $q));
            })
            ->orderByDesc('id')
            ->limit(24)
            ->get(['id', 'label', 'kind', 'status', 'object_key', 'derivatives']);

        return response()->json([
            'assets' => $assets->map(fn (MediaAsset $asset) => [
                'id' => $asset->id,
                'label' => $asset->label ?: ('Media #'.$asset->id),
                'kind' => $asset->kind,
                'thumb_url' => $asset->urlFor('thumb'),
                'pdp_url' => $asset->urlFor('pdp') ?? $asset->urlFor('card'),
            ])->values()->all(),
        ]);
    }
}
